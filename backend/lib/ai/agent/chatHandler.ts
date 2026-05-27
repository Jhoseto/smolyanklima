import type { AdminSession } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { blocksToPlainText } from "@/lib/ai/agent/blocksText";
import {
  assertAgentDailyBudget,
  assertConversationMessageLimit,
  rollbackFailedAgentTurn,
} from "@/lib/ai/agent/agentLimits";
import type { AgentProgressEvent } from "@/lib/ai/agent/agentProgress";
import { generateConversationTitle } from "@/lib/ai/agent/agentTitle";
import { runAgentTurn } from "@/lib/ai/agent/orchestrator";
import type { AgentBlock } from "@/lib/ai/agent/types";
import { getEnv } from "@/lib/env";
import { containsJailbreak } from "@/lib/ai/publicAdvisorPrompt";

export type AgentChatInput = {
  conversationId?: string;
  message?: string;
  regenerate?: boolean;
};

export type AgentChatResult = {
  conversationId: string;
  blocks: AgentBlock[];
  usage: { promptTokens: number; completionTokens: number; totalTokens: number; model: string };
  toolCallsCount: number;
  title?: string;
};

export type AgentChatOptions = {
  signal?: AbortSignal;
  onProgress?: (event: AgentProgressEvent) => void;
  onTextDelta?: (chunk: string) => void;
};

export async function handleAgentChat(
  session: AdminSession,
  input: AgentChatInput,
  options: AgentChatOptions = {},
): Promise<AgentChatResult> {
  const env = getEnv();
  await assertAgentDailyBudget(session.db, session.userId, env);

  let conversationId = input.conversationId;
  let isNewConversation = false;
  let userMessageId: string | null = null;
  let message = input.message?.trim() ?? "";
  let isRegenerate = Boolean(input.regenerate);

  if (isRegenerate) {
    if (!conversationId) throw new Error("Липсва conversationId за regenerate.");
    const { data: existing } = await session.db
      .from("admin_agent_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("admin_user_id", session.userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!existing) throw new Error("Разговорът не е намерен.");

    const { data: allMsgs } = await session.db
      .from("admin_agent_messages")
      .select("id,role,content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    const msgs = allMsgs ?? [];
    const lastAssistantIdx = [...msgs].reverse().findIndex((m) => m.role === "assistant");
    if (lastAssistantIdx < 0) throw new Error("Няма отговор за регенериране.");

    const assistantIdx = msgs.length - 1 - lastAssistantIdx;
    await session.db.from("admin_agent_messages").delete().eq("id", msgs[assistantIdx].id);

    const userBefore = [...msgs.slice(0, assistantIdx)].reverse().find((m) => m.role === "user");
    if (!userBefore) throw new Error("Няма user съобщение за regenerate.");
    const c = userBefore.content as { text?: string };
    message = c.text ?? "";
    if (!message) throw new Error("Празно user съобщение.");
  } else {
    if (!message) throw new Error("Празно съобщение.");
  }

  if (!isRegenerate && containsJailbreak(message)) {
    throw new Error(
      "Заявката не може да бъде обработена. Мога да помогна с управление на бизнеса, продажби, склад, сервиз и анализи по данни от админ панела.",
    );
  }

  if (!conversationId) {
    isNewConversation = true;
    const title = message.slice(0, 80) || "Нов разговор";
    const { data: conv, error: convErr } = await session.db
      .from("admin_agent_conversations")
      .insert({ admin_user_id: session.userId, title })
      .select("id")
      .single();
    if (convErr || !conv) throw new Error(convErr?.message ?? "Failed to create conversation");
    conversationId = conv.id;
  } else if (!isRegenerate) {
    const { data: existing, error: exErr } = await session.db
      .from("admin_agent_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("admin_user_id", session.userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (exErr || !existing) throw new Error("Разговорът не е намерен.");
  }

  if (!conversationId) throw new Error("Conversation ID missing");
  const activeConversationId = conversationId;

  if (!isRegenerate) {
    await assertConversationMessageLimit(session.db, activeConversationId, env);
  }

  const { data: priorMessages } = await session.db
    .from("admin_agent_messages")
    .select("role,content")
    .eq("conversation_id", activeConversationId)
    .order("created_at", { ascending: true })
    .limit(100);

  const history: Array<{ role: "user" | "assistant"; text: string }> = [];
  for (const m of priorMessages ?? []) {
    if (m.role === "user") {
      const c = m.content as { text?: string };
      history.push({ role: "user", text: c.text ?? String(m.content) });
    } else if (m.role === "assistant") {
      const blocks = (m.content as { blocks?: AgentBlock[] }).blocks ?? [];
      history.push({ role: "assistant", text: blocksToPlainText(blocks) });
    }
  }

  if (!isRegenerate) {
    const { data: userMsg, error: userMsgErr } = await session.db
      .from("admin_agent_messages")
      .insert({
        conversation_id: activeConversationId,
        role: "user",
        content: { text: message },
      })
      .select("id")
      .single();
    if (userMsgErr || !userMsg) throw new Error(userMsgErr?.message ?? "Failed to save message");
    userMessageId = userMsg.id;
  }

  let result;
  try {
    result = await runAgentTurn(session, message, history, {
      signal: options.signal,
      onProgress: options.onProgress,
      onTextDelta: options.onTextDelta,
    });
  } catch (turnErr) {
    if (!isRegenerate) {
      await rollbackFailedAgentTurn(session.db, {
        conversationId: activeConversationId,
        userMessageId,
        isNewConversation,
      });
    }
    throw turnErr;
  }

  await session.db.from("admin_agent_messages").insert({
    conversation_id: activeConversationId,
    role: "assistant",
    content: { blocks: result.blocks },
    token_usage: result.usage,
  });

  let title: string | undefined;
  const isFirstExchange = history.length === 0 && !isRegenerate;
  if (isFirstExchange || isNewConversation) {
    title = await generateConversationTitle(message);
  }

  await session.db
    .from("admin_agent_conversations")
    .update(
      title
        ? { updated_at: new Date().toISOString(), title }
        : { updated_at: new Date().toISOString() },
    )
    .eq("id", activeConversationId);

  await logAdminActivity({
    action: "agent_query",
    entityType: "ai_agent",
    entityId: activeConversationId,
    details: {
      model: result.model,
      toolCallsCount: result.toolCallsCount,
      totalTokens: result.usage.totalTokens,
      regenerate: isRegenerate,
    },
  });

  return {
    conversationId: activeConversationId,
    blocks: result.blocks,
    usage: result.usage,
    toolCallsCount: result.toolCallsCount,
    title,
  };
}
