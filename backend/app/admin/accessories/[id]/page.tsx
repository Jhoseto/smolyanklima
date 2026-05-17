"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  AccessoryFormFields,
  emptyAccessoryForm,
  mapLoadedAccessoryToForm,
  buildAccessoryPutBody,
  type AdminAccessoryForm,
} from "../AccessoryForm";
import { SectionTitle, Card, Button } from "../../ui";
import { Save } from "lucide-react";

type Brand = { id: string; name: string };

export default function EditAccessoryPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [brands, setBrands] = useState<Brand[]>([]);
  const [canEditPrice, setCanEditPrice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<AdminAccessoryForm>(emptyAccessoryForm);
  const [pendingPhotos, setPendingPhotos] = useState(0);
  const [pendingPhotosConfirm, setPendingPhotosConfirm] = useState<null | { proceed: () => void }>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [bRes, aRes, wRes] = await Promise.all([
        fetch("/api/admin/meta/brands", { credentials: "include" }),
        fetch(`/api/admin/accessories/${id}`, { credentials: "include" }),
        fetch("/api/admin/whoami", { credentials: "include" }),
      ]);
      const b = await bRes.json();
      const a = await aRes.json();
      const w = await wRes.json();
      setBrands(b.data ?? []);
      const role = (w.data?.admin?.role as string) ?? "master_admin";
      setCanEditPrice(role === "master_admin" || role === "office_staff" || role === "service_staff");
      if (!aRes.ok) throw new Error(a.error || "Неуспешно зареждане");
      setForm(mapLoadedAccessoryToForm(a.data));
    })()
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [id]);

  async function doSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/accessories/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAccessoryPutBody(form)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (json as { error?: string }).error || "Грешка при запис";
        setError(msg);
        setToast({ kind: "err", text: msg });
        return;
      }
      setToast({ kind: "ok", text: "Запазено" });
    } finally {
      setSaving(false);
    }
  }

  function save() {
    if (pendingPhotos > 0) {
      setPendingPhotosConfirm({ proceed: () => void doSave() });
      return;
    }
    void doSave();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-500 text-sm font-medium">
        Зареждане…
      </div>
    );
  }

  return (
    <div className="w-full max-w-none space-y-3 pb-24 md:space-y-4 md:pb-4">
      {toast && (
        <div
          className={`fixed top-2 left-2 right-2 md:top-4 md:left-auto md:right-4 z-50 px-3 py-2.5 md:px-4 md:py-3 rounded-xl shadow-lg border font-bold text-xs md:text-sm ${
            toast.kind === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"
          }`}
          role="status"
        >
          {toast.text}
        </div>
      )}

      <div>
        <h1 className="text-base md:text-xl font-bold text-slate-900 leading-tight">
          <SectionTitle title="Редакция на аксесоар" />
        </h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm font-medium">{error}</div>
      )}

      <Card className="p-2 sm:p-3 md:p-6 shadow-sm border-slate-200/90 max-md:rounded-lg">
        <AccessoryFormFields
          brands={brands}
          form={form}
          setForm={setForm}
          canEditPrice={canEditPrice}
          onPendingPhotosChange={setPendingPhotos}
        />
      </Card>

      <div className="hidden md:flex justify-end">
        <Button variant="primary" size="lg" onClick={save} disabled={saving} className="gap-2 shadow-sm">
          <Save className="w-5 h-5" />
          {saving ? "Записвам..." : "Запази"}
        </Button>
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-40 md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-sm px-3 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button variant="primary" className="w-full justify-center gap-2 !py-3 text-sm font-bold rounded-xl" onClick={save} disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? "Записвам..." : "Запази"}
        </Button>
      </div>

      {pendingPhotosConfirm && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-slate-950/55" onClick={() => setPendingPhotosConfirm(null)}>
          <div className="w-full md:max-w-lg rounded-t-3xl md:rounded-3xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-slate-700 mb-4">
              Имаш {pendingPhotos} неприбрани снимки. Да запазя без тях?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPendingPhotosConfirm(null)}>Отказ</Button>
              <Button
                variant="primary"
                onClick={() => {
                  const cb = pendingPhotosConfirm.proceed;
                  setPendingPhotosConfirm(null);
                  cb();
                }}
              >
                Запази без качване
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}