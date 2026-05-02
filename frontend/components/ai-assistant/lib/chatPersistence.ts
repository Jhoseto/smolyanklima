/**
 * Локално (само браузър) запазване на AI чат за:
 * — синхрон между табове чрез storage events + BroadcastChannel
 * — оцеляване при refresh в същия браузър
 * Не се изпраща към сървър.
 */

import type { Conversation, Message } from '../types';

export const CHAT_STATE_STORAGE_KEY = 'smolyan-klima-ai-chat-state-v1';

const SCHEMA_VERSION = 1 as const;
const MAX_MESSAGE_COUNT = 60;
const MAX_MESSAGE_CONTENT = 5000;
const MAX_STATE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface PersistedChatBlob {
  v: typeof SCHEMA_VERSION;
  messages: Message[];
  conversation: Conversation;
  savedAt: number;
  writerTabId: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidMessage(m: unknown): m is Message {
  if (!isPlainObject(m)) return false;
  if (typeof m.id !== 'string' || m.id.length < 1) return false;
  if (m.role !== 'user' && m.role !== 'assistant' && m.role !== 'system') return false;
  if (typeof m.content !== 'string' || m.content.length < 1 || m.content.length > MAX_MESSAGE_CONTENT) return false;
  if (typeof m.timestamp !== 'number') return false;
  return true;
}

function isValidConversation(c: unknown): c is Conversation {
  if (!isPlainObject(c)) return false;
  if (typeof c.id !== 'string' || c.id.length < 8) return false;
  if (!Array.isArray(c.messages)) return false;
  if (!isPlainObject(c.context)) return false;
  if (typeof (c.context as Conversation['context']).conversationStage !== 'string') return false;
  if (typeof c.createdAt !== 'number' || typeof c.updatedAt !== 'number') return false;
  if (!isPlainObject(c.metadata)) return false;
  const md = c.metadata as Conversation['metadata'];
  if (typeof md.messageCount !== 'number') return false;
  if (typeof md.convertedToQuote !== 'boolean' || typeof md.convertedToPurchase !== 'boolean') return false;
  return true;
}

export function validatePersistedBlob(raw: unknown): PersistedChatBlob | null {
  if (!isPlainObject(raw)) return null;
  if (raw.v !== SCHEMA_VERSION) return null;
  if (typeof raw.savedAt !== 'number') return null;
  if (Date.now() - raw.savedAt > MAX_STATE_AGE_MS) return null;
  if (typeof raw.writerTabId !== 'string') return null;
  if (!Array.isArray(raw.messages) || raw.messages.length > MAX_MESSAGE_COUNT) return null;
  if (!raw.messages.every(isValidMessage)) return null;
  if (!isValidConversation(raw.conversation)) return null;
  return raw as PersistedChatBlob;
}

export function loadPersistedChat(): PersistedChatBlob | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(CHAT_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return validatePersistedBlob(parsed);
  } catch {
    return null;
  }
}

export function savePersistedChat(blob: Omit<PersistedChatBlob, 'v'>): void {
  try {
    if (typeof window === 'undefined') return;
    const full: PersistedChatBlob = { v: SCHEMA_VERSION, ...blob };
    localStorage.setItem(CHAT_STATE_STORAGE_KEY, JSON.stringify(full));
  } catch {
    // квота / private mode
  }
}

export function clearPersistedChat(): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CHAT_STATE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Има ли смисъл да се приложи отдалечено състояние (избягва ненужни re-render цикли). */
export function chatStateDiffers(local: Message[], remote: Message[]): boolean {
  if (remote.length !== local.length) return true;
  for (let i = 0; i < local.length; i++) {
    if (local[i].id !== remote[i].id || local[i].content !== remote[i].content) return true;
  }
  return false;
}
