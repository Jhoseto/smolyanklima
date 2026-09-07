"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Loader2, Unlink } from "lucide-react";

export interface ProductMatchSuggestion {
  product_id: string;
  label: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  indoor_unit_serial?: string | null;
  outdoor_unit_serial?: string | null;
}

interface Props {
  protocolId: string | null;
  productId: string | null;
  disabled?: boolean;
  onLink: (productId: string | null) => void;
}

const CONFIDENCE_LABEL: Record<ProductMatchSuggestion["confidence"], string> = {
  high: "Високо",
  medium: "Средно",
  low: "Ниско",
};

export function ProtocolProductLinkPanel({ protocolId, productId, disabled, onLink }: Props) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<ProductMatchSuggestion[]>([]);
  const [loaded, setLoaded] = useState(false);

  const loadSuggestions = useCallback(async () => {
    if (!protocolId || productId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/service/repair-protocols/${protocolId}/product-match`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const json = await res.json() as { data?: { suggestions?: ProductMatchSuggestion[] } };
      setSuggestions(json.data?.suggestions ?? []);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [protocolId, productId]);

  useEffect(() => {
    if (!protocolId || productId) {
      setSuggestions([]);
      setLoaded(false);
      return;
    }
    void loadSuggestions();
  }, [protocolId, productId, loadSuggestions]);

  if (!protocolId) return null;

  if (productId) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Link2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="min-w-0">
            Свързан с продукт от каталога.
            {" "}
            <a
              href={`/admin/products?highlight=${productId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              Отвори в Продукти
            </a>
          </span>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={() => onLink(null)}
            className="shrink-0 inline-flex items-center gap-1 text-xs text-emerald-800 hover:text-emerald-950"
            title="Премахни връзката"
          >
            <Unlink className="w-3.5 h-3.5" />
            Премахни
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          Свързване с продукт
        </p>
        {!loaded && !loading && (
          <button
            type="button"
            onClick={() => void loadSuggestions()}
            disabled={disabled}
            className="text-xs text-brand-blue-600 hover:underline disabled:opacity-50"
          >
            Търси съвпадения
          </button>
        )}
      </div>
      <p className="text-[11px] text-slate-500 leading-snug">
        Старите протоколи имат марка/модел и серийни номера в едно поле (напр. „563CEX2 / 563CEX2“).
        Системата търси по разделените части — потвърди предложението или избери от каталога по-горе.
      </p>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Търсене…
        </div>
      )}
      {!loading && loaded && suggestions.length === 0 && (
        <p className="text-sm text-slate-500">Няма автоматични съвпадения — избери ръчно от „Марка и модел“.</p>
      )}
      {!loading && suggestions.length > 0 && (
        <ul className="space-y-1.5">
          {suggestions.map((s) => (
            <li key={s.product_id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onLink(s.product_id)}
                className="w-full text-left rounded-lg border border-white bg-white px-2.5 py-2 hover:border-brand-blue-200 hover:bg-brand-blue-50/50 disabled:opacity-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800 truncate">{s.label}</span>
                  <span className="text-[10px] shrink-0 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    {CONFIDENCE_LABEL[s.confidence]}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{s.reason}</p>
                {(s.indoor_unit_serial || s.outdoor_unit_serial) && (
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono truncate">
                    {[s.indoor_unit_serial, s.outdoor_unit_serial].filter(Boolean).join(" / ")}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
