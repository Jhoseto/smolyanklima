/**
 * Client payload shaping for POST /api/ai/chat.
 * Backend builds trusted system prompt; client sends advisorContext only.
 */

export type AIChatMessage = { role: 'user' | 'assistant'; content: string };

const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 2000;
const MAX_ADVISOR_CONTEXT_CHARS = 8000;

export function prepareAIChatPayload(
  messages: AIChatMessage[],
  advisorContext?: string,
): { messages: AIChatMessage[]; advisorContext?: string } {
  const normalized = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter((m) => m.content.length > 0)
    .slice(-MAX_MESSAGES);

  const trimmedContext =
    advisorContext && advisorContext.length > 0
      ? advisorContext.slice(0, MAX_ADVISOR_CONTEXT_CHARS)
      : undefined;

  return { messages: normalized, advisorContext: trimmedContext };
}

export async function callBackendAIChat(
  messages: AIChatMessage[],
  advisorContext?: string,
): Promise<{ content: string }> {
  const payload = prepareAIChatPayload(messages, advisorContext);
  if (payload.messages.length === 0) {
    throw new Error('No messages to send');
  }

  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error('AI request failed') as Error & {
      code?: string;
      details?: unknown;
    };
    const errorCode =
      typeof body === 'object' && body && 'error' in body
        ? String((body as { error?: string }).error)
        : undefined;
    err.code =
      res.status === 429 || errorCode === 'RATE_LIMIT_EXCEEDED'
        ? 'RATE_LIMIT_EXCEEDED'
        : errorCode ?? `HTTP_${res.status}`;
    err.details = body;
    throw err;
  }

  const data = (await res.json()) as { content?: string };
  return { content: data.content ?? '' };
}
