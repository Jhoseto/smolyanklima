"use client";

import type { ReactNode } from "react";
import { Search, Phone, X, Loader2 } from "lucide-react";
import { Card, Input, AdminTableLoading } from "../ui";

type ContactKind = "client" | "supplier";

type ContactRow = {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  contact_kind?: ContactKind | null;
  customer_status?: "new" | "active" | "vip" | "lost" | null;
  next_follow_up_at?: string | null;
};

type Theme = {
  title: string;
  titleSingular: string;
  accentText: string;
  accentRing: string;
};

type Props = {
  kind: ContactKind;
  theme: Theme;
  q: string;
  debouncedQ: string;
  loading: boolean;
  items: ContactRow[];
  selected: string;
  contactsTotal: number;
  mobileHidden: boolean;
  highlight: (text: string, query: string) => ReactNode;
  onQueryChange: (value: string) => void;
  onSelect: (id: string) => void;
  onNewContact: () => void;
};

export function ContactsListColumn({
  kind,
  theme,
  q,
  debouncedQ,
  loading,
  items,
  selected,
  contactsTotal,
  mobileHidden,
  highlight,
  onQueryChange,
  onSelect,
  onNewContact,
}: Props) {
  const term = debouncedQ.trim();
  const isClient = kind === "client";

  return (
    <div className={`${mobileHidden ? "hidden lg:flex" : "flex"} flex-col min-h-0`}>
      <Card className="flex flex-col overflow-hidden border-slate-200 shadow-sm max-h-[calc(100dvh-11rem)] lg:max-h-[calc(100vh-9.5rem)]">
        <div className="p-3 border-b border-slate-100 space-y-2 shrink-0 bg-white">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black uppercase tracking-wide text-slate-700">
              {term ? "Резултати" : `Всички ${theme.title.toLowerCase()}`}
            </span>
            <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
              {loading ? "…" : contactsTotal.toLocaleString("bg-BG")}
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              value={q}
              onChange={(e) => onQueryChange(e.target.value)}
              className={`pl-9 pr-9 ${theme.accentRing}`}
              placeholder={
                isClient
                  ? "Търси на живо — име, телефон, имейл, адрес…"
                  : "Търси доставчик — име, телефон, имейл…"
              }
            />
            {loading && q.trim() ? (
              <Loader2 className="absolute right-9 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
            ) : null}
            {q ? (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="Изчисти"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
          {term ? (
            <p className="text-[11px] text-slate-500">
              Филтър: <span className="font-semibold text-slate-700">„{term}"</span>
            </p>
          ) : (
            <p className="text-[11px] text-slate-400">Започни да пишеш — списъкът се обновява автоматично.</p>
          )}
        </div>

        <div className="overflow-y-auto flex-1 p-2 space-y-1 min-h-[240px]">
          {loading && items.length === 0 ? (
            <AdminTableLoading size="sm" />
          ) : null}

          {!loading && items.length === 0 ? (
            <div className="text-center py-10 px-4">
              <Search className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-600">
                {term ? `Няма ${theme.titleSingular} за „${term}"` : `Няма ${theme.title.toLowerCase()} в базата`}
              </p>
              <button
                type="button"
                onClick={onNewContact}
                className={`mt-3 text-xs font-bold ${theme.accentText} hover:underline`}
              >
                + Добави нов {theme.titleSingular}
              </button>
            </div>
          ) : null}

          {items.map((c) => {
            const isSelected = selected === c.id;
            const selectedClass = isClient
              ? "bg-brand-blue-50 border-brand-blue-300 ring-1 ring-brand-blue-200"
              : "bg-brand-orange-50 border-brand-orange-300 ring-1 ring-brand-orange-200";
            const hoverClass = isClient
              ? "bg-white border-slate-200 hover:border-brand-blue-300 hover:bg-brand-blue-50/50"
              : "bg-white border-slate-200 hover:border-brand-orange-300 hover:bg-brand-orange-50/50";
            const phoneBtnClass = isClient
              ? "text-brand-blue-700 hover:bg-brand-blue-50 active:bg-brand-blue-100"
              : "text-brand-orange-700 hover:bg-brand-orange-50 active:bg-brand-orange-100";

            return (
              <div
                key={c.id}
                className={`rounded-xl border transition-colors ${isSelected ? selectedClass : hoverClass}`}
              >
                <button type="button" onClick={() => onSelect(c.id)} className="w-full text-left p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-slate-900 text-sm leading-tight truncate">
                      {highlight(c.full_name, term)}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {c.contact_kind === "supplier" && isClient && (
                        <span className="text-[9px] font-bold bg-brand-orange-100 text-brand-orange-700 px-1.5 py-0.5 rounded-full">
                          Дост.
                        </span>
                      )}
                      {c.contact_kind === "client" && !isClient && (
                        <span className="text-[9px] font-bold bg-brand-blue-100 text-brand-blue-700 px-1.5 py-0.5 rounded-full">
                          Клиент
                        </span>
                      )}
                      {c.customer_status === "vip" && isClient && (
                        <span className="text-[9px] font-bold bg-yellow-200 text-amber-900 px-1.5 py-0.5 rounded-full">
                          VIP
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 mt-1 truncate">{highlight(c.phone || "—", term)}</div>
                  {(c.email || c.address) && (
                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {c.email ? highlight(c.email, term) : null}
                      {c.email && c.address ? " · " : null}
                      {c.address ? highlight(c.address, term) : null}
                    </div>
                  )}
                  {c.next_follow_up_at && (
                    <div className={`text-[10px] font-semibold mt-1 ${theme.accentText}`}>
                      → {new Date(c.next_follow_up_at).toLocaleDateString("bg-BG")}
                    </div>
                  )}
                </button>
                <div className="flex border-t border-slate-100 lg:hidden">
                  <a
                    href={`tel:${c.phone}`}
                    className={`flex-1 text-center py-2 text-xs font-semibold rounded-b-xl ${phoneBtnClass}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="w-3.5 h-3.5 inline mr-1" />
                    Обади се
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
