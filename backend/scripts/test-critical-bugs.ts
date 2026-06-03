import assert from "node:assert/strict";
import { loadChatAlertSnapshot } from "../lib/live-chat/chatAlertSnapshot";

type ChatRow = {
  id: string;
  visitor_name: string;
  visitor_phone: string | null;
  status: "waiting" | "active" | "closed";
  created_at: string;
  last_message_at: string;
};

type MessageRow = {
  id: string;
  chat_id: string;
  sender_role: "user" | "admin" | "system";
  created_at: string;
};

const chats: ChatRow[] = [
  {
    id: "chat-a",
    visitor_name: "Alice",
    visitor_phone: "+3591",
    status: "active",
    created_at: "2026-06-03T08:00:00.000Z",
    last_message_at: "2026-06-03T10:05:00.000Z",
  },
  {
    id: "chat-b",
    visitor_name: "Bob",
    visitor_phone: null,
    status: "waiting",
    created_at: "2026-06-03T09:00:00.000Z",
    last_message_at: "2026-06-03T10:03:00.000Z",
  },
  {
    id: "chat-closed",
    visitor_name: "Closed",
    visitor_phone: null,
    status: "closed",
    created_at: "2026-06-03T07:00:00.000Z",
    last_message_at: "2026-06-03T07:30:00.000Z",
  },
];

const messages: MessageRow[] = [
  {
    id: "old-a",
    chat_id: "chat-a",
    sender_role: "user",
    created_at: "2026-06-03T09:30:00.000Z",
  },
  {
    id: "latest-a",
    chat_id: "chat-a",
    sender_role: "user",
    created_at: "2026-06-03T10:05:00.000Z",
  },
  {
    id: "admin-a",
    chat_id: "chat-a",
    sender_role: "admin",
    created_at: "2026-06-03T10:06:00.000Z",
  },
  {
    id: "latest-b",
    chat_id: "chat-b",
    sender_role: "user",
    created_at: "2026-06-03T10:03:00.000Z",
  },
  {
    id: "closed-user",
    chat_id: "chat-closed",
    sender_role: "user",
    created_at: "2026-06-03T07:30:00.000Z",
  },
];

const messageQueries: Array<{ chatId: string; limit: number | null }> = [];

function makeSupabaseStub() {
  return {
    from(table: string) {
      if (table === "live_chats") {
        return {
          select() {
            return {
              in(column: string, values: string[]) {
                assert.equal(column, "status");
                return Promise.resolve({
                  data: chats.filter((chat) => values.includes(chat.status)),
                  error: null,
                });
              },
            };
          },
        };
      }

      if (table === "live_chat_messages") {
        let chatId: string | null = null;
        let senderRole: string | null = null;
        let limitValue: number | null = null;

        const query = {
          select() {
            return query;
          },
          eq(column: string, value: string) {
            if (column === "chat_id") chatId = value;
            if (column === "sender_role") senderRole = value;
            return query;
          },
          order(column: string, opts: { ascending: boolean }) {
            assert.equal(column, "created_at");
            assert.equal(opts.ascending, false);
            return query;
          },
          limit(n: number) {
            limitValue = n;
            return query;
          },
          maybeSingle() {
            assert.ok(chatId, "message query must be scoped to one chat");
            assert.equal(senderRole, "user");
            messageQueries.push({ chatId, limit: limitValue });
            const [latest] = messages
              .filter((message) => message.chat_id === chatId && message.sender_role === senderRole)
              .sort((a, b) => b.created_at.localeCompare(a.created_at));
            return Promise.resolve({
              data: latest ? { id: latest.id, created_at: latest.created_at } : null,
              error: null,
            });
          },
        };

        return query;
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

async function testChatAlertSnapshotUsesPerChatLatestMessages() {
  const snapshot = await loadChatAlertSnapshot(makeSupabaseStub() as never);

  assert.deepEqual(snapshot.waiting, [
    {
      id: "chat-b",
      visitorName: "Bob",
      visitorPhone: null,
      createdAt: "2026-06-03T09:00:00.000Z",
    },
  ]);

  assert.deepEqual(
    snapshot.userMessages.map((message) => ({
      chatId: message.chatId,
      messageId: message.messageId,
      visitorName: message.visitorName,
    })),
    [
      { chatId: "chat-a", messageId: "latest-a", visitorName: "Alice" },
      { chatId: "chat-b", messageId: "latest-b", visitorName: "Bob" },
    ],
  );

  assert.deepEqual(messageQueries, [
    { chatId: "chat-a", limit: 1 },
    { chatId: "chat-b", limit: 1 },
  ]);
}

await testChatAlertSnapshotUsesPerChatLatestMessages();

console.log("critical bug regressions passed");
