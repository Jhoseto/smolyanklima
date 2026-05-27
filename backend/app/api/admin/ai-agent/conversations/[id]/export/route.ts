import { NextRequest, NextResponse } from "next/server";
import { withCors, corsPreflight } from "@/lib/http/cors";
import { requireMasterAdminAgentSession } from "@/lib/ai/agent/agentAuth";
import { threadToMarkdown } from "@/lib/ai/agent/agentExport";
import type { AgentBlock } from "@/lib/ai/agent/types";

type Params = { params: Promise<{ id: string }> };

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest, ctx: Params) {
  let session;
  try {
    session = await requireMasterAdminAgentSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Forbidden" }, { status: 403 }));
  }

  const { id } = await ctx.params;
  const { data: conv } = await session.db
    .from("admin_agent_conversations")
    .select("id,title")
    .eq("id", id)
    .eq("admin_user_id", session.userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!conv) return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));

  const { data: messages } = await session.db
    .from("admin_agent_messages")
    .select("role,content,created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  const md = threadToMarkdown(
    conv.title,
    (messages ?? []).filter((m) => m.role === "user" || m.role === "assistant") as Array<{
      role: string;
      content: { text?: string; blocks?: AgentBlock[] };
      created_at: string;
    }>,
  );

  const filename = `ai-agent-${conv.title.replace(/[^\w\u0400-\u04FF-]+/g, "-").slice(0, 40)}.md`;
  return withCors(
    req,
    new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    }),
  );
}
