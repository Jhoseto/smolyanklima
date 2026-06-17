"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AccessoryFormFields,
  emptyAccessoryForm,
  buildAccessoryPostBody,
  type AdminAccessoryForm,
} from "../AccessoryForm";
import { SectionTitle, Card, Button } from "../../ui";
import { Save } from "lucide-react";

type Brand = { id: string; name: string };

export default function NewAccessoryPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [canEditPrice, setCanEditPrice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
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
      const [bRes, wRes] = await Promise.all([
        fetch("/api/admin/meta/brands", { credentials: "include" }),
        fetch("/api/admin/whoami", { credentials: "include" }),
      ]);
      const b = await bRes.json();
      const w = await wRes.json();
      setBrands(b.data ?? []);
      const role = (w.data?.admin?.role as string) ?? "master_admin";
      setCanEditPrice(role === "master_admin" || role === "office_staff" || role === "service_staff");
    })().catch((e) => setError(String(e?.message ?? e)));
  }, []);

  async function doSubmit() {
    if (!form.name.trim()) {
      setError("Въведете име на аксесоара.");
      setToast({ kind: "err", text: "Въведете име." });
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/accessories", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAccessoryPostBody(form)),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (json as { error?: string }).error || "Грешка при създаване";
        setError(msg);
        setToast({ kind: "err", text: msg });
        return;
      }
      setToast({ kind: "ok", text: "Създадено" });
      router.push(`/admin/accessories/${(json as { data: { id: string } }).data.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  function submit() {
    if (pendingPhotos > 0) {
      setPendingPhotosConfirm({ proceed: () => void doSubmit() });
      return;
    }
    void doSubmit();
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

      <div className="md:pt-0">
        <h1 className="text-base md:text-xl font-bold text-slate-900 leading-tight">
          <SectionTitle title="Нов аксесоар" />
        </h1>
        <p className="mt-0.5 md:mt-1 text-[12px] md:text-[13px] text-slate-500 leading-snug">
          Име, цена, описание и снимки. Марката е по избор.
        </p>
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
        <Button variant="primary" size="lg" onClick={submit} disabled={submitting} className="gap-2 shadow-sm">
          <Save className="w-5 h-5" />
          {submitting ? "Създавам..." : "Създай аксесоар"}
        </Button>
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-40 md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-sm px-3 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <Button variant="primary" className="w-full justify-center gap-2 !py-3 text-sm font-bold rounded-xl" onClick={submit} disabled={submitting}>
          <Save className="w-4 h-4" />
          {submitting ? "Създавам..." : "Създай аксесоар"}
        </Button>
      </div>

      {pendingPhotosConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-slate-950/55 backdrop-blur-md"
        >
          <div
            className="w-full md:max-w-lg overflow-hidden rounded-t-3xl md:rounded-3xl border border-white/70 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-100 bg-amber-50/60 px-6 py-5">
              <div className="text-xl font-black text-slate-950">
                Имаш {pendingPhotos} {pendingPhotos === 1 ? "снимка" : "снимки"} в preview
              </div>
            </div>
            <div className="p-6 text-sm text-slate-700">
              Ако продължиш, аксесоарът ще се създаде без тях. Препоръчително е първо „Качи в Cloudinary“.
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button variant="secondary" onClick={() => setPendingPhotosConfirm(null)}>
                Назад към снимките
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  const cb = pendingPhotosConfirm.proceed;
                  setPendingPhotosConfirm(null);
                  cb();
                }}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                Създай без качване
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
