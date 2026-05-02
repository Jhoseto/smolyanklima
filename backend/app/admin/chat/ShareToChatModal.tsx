"use client";

import { useEffect, useState, useCallback } from "react";
import { X, MessageCircle, Loader2, User, Clock, CheckCircle2, Search } from "lucide-react";

type ActiveChat = { id: string; visitor_name: string; status: string; last_message_at?: string | null };

interface Props {
  product: {
    id: string;
    name: string;
    slug: string;
    image_url?: string | null;
    price_from?: number | null;
    brand_name?: string | null;
  };
  onClose: () => void;
}

export function ShareToChatModal({ product, onClose }: Props) {
  const [chats, setChats] = useState<ActiveChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/chat?status=active")
      .then(r => r.ok ? r.json() : { data: [] })
      .then(data => setChats(data.data ?? []))
      .finally(() => setLoading(false));
    // Also load waiting chats
    fetch("/api/admin/chat?status=waiting")
      .then(r => r.ok ? r.json() : { data: [] })
      .then(data => setChats(prev => {
        const ids = new Set(prev.map(c => c.id));
        return [...prev, ...(data.data ?? []).filter((c: ActiveChat) => !ids.has(c.id))];
      }));
  }, []);

  const handleSend = useCallback(async (chatId: string) => {
    setSending(chatId);
    try {
      const res = await fetch(`/api/admin/chat/${chatId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `Препоръчан продукт: ${product.name}${product.price_from ? ` — от ${product.price_from.toLocaleString("bg-BG")} лв.` : ""}`,
          metadata: {
            type: "product_card",
            product: {
              id: product.id,
              name: product.name,
              slug: product.slug,
              image_url: product.image_url,
              price_from: product.price_from,
              brand_name: product.brand_name,
            },
          },
        }),
      });
      if (res.ok) setSent(prev => new Set([...prev, chatId]));
    } finally {
      setSending(null);
    }
  }, [product]);

  const filtered = chats.filter(c =>
    c.visitor_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-sm font-bold text-slate-900">Сподели в чат</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[280px]">{product.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product preview */}
        <div className="flex items-center gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100">
          {product.image_url && (
            <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0">
              <img src={product.image_url} alt={product.name} className="w-full h-full object-contain p-1" />
            </div>
          )}
          <div>
            {product.brand_name && <p className="text-[10px] font-bold text-sky-600 uppercase">{product.brand_name}</p>}
            <p className="text-sm font-bold text-slate-900">{product.name}</p>
            {product.price_from && <p className="text-sm font-bold text-orange-500">{product.price_from.toLocaleString("bg-BG")} лв.</p>}
          </div>
        </div>

        {/* Search */}
        <div className="px-5 pt-3 pb-2">
          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Търси по име..." className="flex-1 bg-transparent text-sm focus:outline-none text-slate-700 placeholder:text-slate-400" />
          </div>
        </div>

        {/* Chat list */}
        <div className="max-h-64 overflow-y-auto px-3 pb-3">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-300" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <MessageCircle className="w-8 h-8 text-slate-200" />
              <p className="text-xs text-slate-400">Няма активни чатове</p>
            </div>
          ) : (
            filtered.map(chat => {
              const isSent = sent.has(chat.id);
              const isSending = sending === chat.id;
              return (
                <div key={chat.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{chat.visitor_name}</p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      {chat.status === "waiting" ? <><Clock className="w-3 h-3 text-amber-400" />Изчаква</> : <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />Активен</>}
                    </p>
                  </div>
                  <button
                    onClick={() => !isSent && handleSend(chat.id)}
                    disabled={isSending || isSent}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSent
                        ? "bg-emerald-50 border border-emerald-200 text-emerald-700 cursor-default"
                        : "bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
                    }`}
                  >
                    {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                     isSent ? <><CheckCircle2 className="w-3.5 h-3.5" />Изпратен</> :
                     <><MessageCircle className="w-3.5 h-3.5" />Сподели</>}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
