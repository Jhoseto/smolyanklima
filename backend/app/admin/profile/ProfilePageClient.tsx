"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ImagePlus, Trash2, Save, LogOut, KeyRound } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { Button, Card, Input, SectionTitle } from "../ui";
import { StaffAvatarCropModal } from "../staff/StaffAvatarCropModal";
import { ProfilePushNotifications } from "./ProfilePushNotifications";

type AdminRole = "master_admin" | "office_staff" | "service_staff";

type ProfileRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
};

const ROLE_LABELS: Record<AdminRole, string> = {
  master_admin: "Главен администратор",
  office_staff: "Офис служител",
  service_staff: "Сервизен техник",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("bg-BG", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export function ProfilePageClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [row, setRow] = useState<ProfileRow | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/profile", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Грешка при зареждане");
      const d = json.data as ProfileRow;
      setRow(d);
      setName(d.name ?? "");
      setPhone(d.phone ?? "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Грешка");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!avatarCropSrc) return;
    return () => {
      URL.revokeObjectURL(avatarCropSrc);
    };
  }, [avatarCropSrc]);

  const uploadAvatarFile = async (file: File) => {
    if (!row) return;
    if (file.size > 6 * 1024 * 1024) {
      setError("Снимката е прекалено голяма (макс. 6 MB).");
      return;
    }
    setAvatarBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "staff");
      fd.append("slug", row.id);
      const up = await fetch("/api/admin/uploads/image", { method: "POST", body: fd, credentials: "include" });
      const upJson = await up.json();
      if (!up.ok) throw new Error(upJson.error ?? "Качването неуспешно");
      const url = upJson.data?.url as string | undefined;
      if (!url) throw new Error("Липсва URL от Cloudinary");
      const res = await fetch("/api/admin/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: url }),
      });
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error ?? "Грешка при запис");
      setRow((prev) => (prev ? { ...prev, avatar_url: url } : null));
      setToast("Снимката е обновена.");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Грешка");
    } finally {
      setAvatarBusy(false);
      if (avatarFileRef.current) avatarFileRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Грешка");
      setRow((prev) => (prev ? { ...prev, avatar_url: null } : null));
      setToast("Снимката е премахната.");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Грешка");
    } finally {
      setAvatarBusy(false);
    }
  };

  async function save() {
    setError(null);
    const n = name.trim();
    if (n.length < 2) {
      setError("Името трябва да е поне 2 знака.");
      return;
    }
    if (pw1 || pw2) {
      if (pw1.length < 6) {
        setError("Паролата трябва да е поне 6 знака.");
        return;
      }
      if ((pw1.match(/\d/g) ?? []).length < 2) {
        setError("Паролата трябва да съдържа поне 2 цифри.");
        return;
      }
      if (pw1 !== pw2) {
        setError("Паролите не съвпадат.");
        return;
      }
    }
    const phoneTrim = phone.trim();
    if (phoneTrim.length > 0 && phoneTrim.length < 6) {
      setError("Телефонът трябва да е поне 6 знака или празен.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: n,
        phone: phoneTrim === "" ? null : phoneTrim,
      };
      if (pw1) body.password = pw1;

      const res = await fetch("/api/admin/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Грешка при запис");
      setPw1("");
      setPw2("");
      setToast("Профилът е запазен.");
      await load();
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Грешка");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue-500" />
        <span className="text-sm font-medium">Зареждане на профила…</span>
      </div>
    );
  }

  if (!row) {
    return <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-4 text-sm font-medium">{error ?? "Няма данни."}</div>;
  }

  return (
    <div className="w-full max-w-lg mx-auto space-y-4 pb-28 md:pb-6">
      {toast && (
        <div
          className="fixed left-4 right-4 z-50 md:left-auto md:right-4 md:w-auto px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold shadow-lg text-center"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
        >
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
          <SectionTitle title="Моят профил" hint="Име, телефон, снимка и парола. Имейлът се управлява от главния администратор при нужда." />
        </h1>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm font-medium">{error}</div>
      )}

      <Card className="p-4 md:p-5 space-y-5">
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-24 h-24 rounded-full overflow-hidden ring-2 ring-slate-200 bg-brand-blue-50 shrink-0">
            {row.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-black text-brand-blue-600">
                {(row.name || "?").trim().charAt(0).toUpperCase() || "?"}
              </div>
            )}
            {avatarBusy && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin text-brand-blue-600" />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setAvatarCropSrc(URL.createObjectURL(f));
            }} />
            <Button type="button" variant="secondary" size="sm" className="gap-1.5" disabled={avatarBusy} onClick={() => avatarFileRef.current?.click()}>
              <ImagePlus className="w-4 h-4" /> Нова снимка
            </Button>
            {row.avatar_url && (
              <Button type="button" variant="secondary" size="sm" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50" disabled={avatarBusy} onClick={() => void removeAvatar()}>
                <Trash2 className="w-4 h-4" /> Махни
              </Button>
            )}
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Име</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" autoComplete="name" />
        </label>

        <label className="block">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Телефон</span>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" inputMode="tel" autoComplete="tel" placeholder="За вход и връзка" />
        </label>

        <ProfilePushNotifications />

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Имейл</span>
            <span className="font-semibold text-slate-800 truncate max-w-[14rem]" title={row.email}>{row.email}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Роля</span>
            <span className="font-semibold text-slate-800">{ROLE_LABELS[row.role] ?? row.role}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Статус</span>
            <span className={row.is_active ? "font-semibold text-emerald-700" : "font-semibold text-red-600"}>
              {row.is_active ? "Активен" : "Неактивен"}
            </span>
          </div>
          <div className="flex justify-between gap-2 text-xs">
            <span className="text-slate-500">Последен вход</span>
            <span className="text-slate-700">{fmtDate(row.last_login_at)}</span>
          </div>
          <div className="flex justify-between gap-2 text-xs">
            <span className="text-slate-500">Създаден</span>
            <span className="text-slate-700">{fmtDate(row.created_at)}</span>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            <KeyRound className="w-4 h-4" /> Нова парола <span className="font-normal normal-case text-slate-400">(по избор)</span>
          </div>
          <Input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} autoComplete="new-password" placeholder="Мин. 6 знака, 2 цифри" />
          <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" placeholder="Повтори паролата" />
        </div>

        <Button type="button" variant="primary" className="w-full gap-2" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Запис…" : "Запази промените"}
        </Button>
      </Card>

      <Card className="p-4 md:p-5 border-red-100">
        <p className="text-sm text-slate-600 mb-3">Изход от административния панел. Ще бъдете пренасочени към екрана за вход.</p>
        <form action={logoutAction}>
          <Button type="submit" variant="danger" className="w-full gap-2">
            <LogOut className="w-4 h-4" />
            Изход от системата
          </Button>
        </form>
      </Card>

      {avatarCropSrc && (
        <StaffAvatarCropModal
          imageSrc={avatarCropSrc}
          onCancel={() => {
            URL.revokeObjectURL(avatarCropSrc);
            setAvatarCropSrc(null);
          }}
          onConfirm={async (file) => {
            URL.revokeObjectURL(avatarCropSrc);
            setAvatarCropSrc(null);
            await uploadAvatarFile(file);
          }}
        />
      )}
    </div>
  );
}
