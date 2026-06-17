"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card } from "../ui";

type CheckResult = {
  ok: boolean;
  checks: Record<string, { ok: boolean; detail?: string }>;
  migrationHint?: string | null;
};

export function SchemaHealthCheck() {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/health/schema-check", { credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? "Грешка при проверка");
        if (!cancelled) setResult(json as CheckResult);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Грешка");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <Card className="p-4 space-y-3">
      <div>
        <h2 className="text-sm font-bold text-slate-900">Състояние на базата данни</h2>
        <p className="text-xs text-slate-500 mt-1">
          Проверка на критични миграции (напр. 0091 — снимки в протоколи).
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Проверява се…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {!loading && result && (
        <>
          <div className={`flex items-center gap-2 text-sm font-semibold ${result.ok ? "text-emerald-700" : "text-amber-800"}`}>
            {result.ok ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            {result.ok ? "Всички проверки минаха успешно." : "Има липсващи миграции."}
          </div>
          <ul className="text-xs text-slate-600 space-y-1">
            {Object.entries(result.checks).map(([key, check]) => (
              <li key={key} className="flex items-center gap-2">
                <span className={check.ok ? "text-emerald-600" : "text-red-600"}>
                  {check.ok ? "✓" : "✗"}
                </span>
                <code className="bg-slate-100 px-1 rounded">{key}</code>
                {check.detail && <span className="text-red-600">{check.detail}</span>}
              </li>
            ))}
          </ul>
          {result.migrationHint && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {result.migrationHint}
            </p>
          )}
        </>
      )}
    </Card>
  );
}
