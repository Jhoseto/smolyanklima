"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import {
  Users, Plus, ShieldCheck, Briefcase, Wrench,
  CheckCircle2, XCircle, Pencil, Trash2, KeyRound,
  Loader2, X, Eye, EyeOff, Phone, ImagePlus,
} from "lucide-react";
import { Button, Input, Select, ADMIN_MODAL_BACKDROP, ADMIN_MODAL_PANEL, AdminModalDragHandle } from "../ui";
import { StaffAvatarCropModal } from "./StaffAvatarCropModal";

type AdminRole = "master_admin" | "office_staff" | "service_staff";

interface StaffMember {
  id: string;
  phone: string | null;
  name: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  avatar_url: string | null;
}

const ROLE_LABELS: Record<AdminRole, string> = {
  master_admin: "Master Admin",
  office_staff: "Офис служител",
  service_staff: "Сервизен техник",
};

const ROLE_COLORS: Record<AdminRole, string> = {
  master_admin: "bg-purple-100 text-purple-700 border-purple-200",
  office_staff: "bg-brand-blue-100 text-brand-blue-700 border-brand-blue-200",
  service_staff: "bg-amber-100 text-amber-700 border-amber-200",
};

const ROLE_ICONS: Record<AdminRole, React.ReactNode> = {
  master_admin: <ShieldCheck className="w-3 h-3" />,
  office_staff: <Briefcase className="w-3 h-3" />,
  service_staff: <Wrench className="w-3 h-3" />,
};

function RoleBadge({ role }: { role: AdminRole }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${ROLE_COLORS[role]}`}>
      {ROLE_ICONS[role]}
      {ROLE_LABELS[role]}
    </span>
  );
}

export function StaffPageClient({
  currentUserId,
  canManage = false,
}: {
  currentUserId: string;
  /** Добавяне/редакция/изтриване — само master_admin. */
  canManage?: boolean;
}) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState<"office_staff" | "service_staff">("office_staff");
  const [showPw, setShowPw] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit modal
  const [editMember, setEditMember] = useState<StaffMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<AdminRole>("office_staff");
  const [editPw, setEditPw] = useState("");
  const [showEditPw, setShowEditPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<StaffMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/staff", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Грешка при зареждане");
      const rows = (data.staff ?? []) as StaffMember[];
      setStaff(rows.map((r) => ({ ...r, avatar_url: r.avatar_url ?? null })));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Грешка");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  useEffect(() => {
    if (!editMember && avatarCropSrc) {
      URL.revokeObjectURL(avatarCropSrc);
      setAvatarCropSrc(null);
    }
  }, [editMember, avatarCropSrc]);

  const uploadStaffAvatar = async (file: File, staffId: string) => {
    if (file.size > 6 * 1024 * 1024) {
      setEditError("Снимката е прекалено голяма (макс. 6 MB).");
      return;
    }
    setEditError(null);
    setAvatarBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "staff");
      fd.append("slug", staffId);
      const up = await fetch("/api/admin/uploads/image", { method: "POST", body: fd, credentials: "include" });
      const upJson = await up.json();
      if (!up.ok) throw new Error(upJson.error ?? "Качването неуспешно");
      const url = upJson.data?.url as string | undefined;
      if (!url) throw new Error("Липсва URL от Cloudinary");
      const res = await fetch(`/api/admin/staff/${staffId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: url }),
      });
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error ?? "Грешка при запис");
      setEditMember((prev) => (prev && prev.id === staffId ? { ...prev, avatar_url: url } : prev));
      void fetchStaff();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Грешка");
    } finally {
      setAvatarBusy(false);
      if (avatarFileRef.current) avatarFileRef.current.value = "";
    }
  };

  const removeStaffAvatar = async () => {
    if (!editMember?.avatar_url) return;
    setEditError(null);
    setAvatarBusy(true);
    try {
      const res = await fetch(`/api/admin/staff/${editMember.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: null }),
      });
      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error ?? "Грешка");
      setEditMember((prev) => (prev ? { ...prev, avatar_url: null } : null));
      void fetchStaff();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Грешка");
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleAdd = async () => {
    setAddError(null);
    if (!addName.trim() || !addPhone.trim() || !addPassword.trim()) {
      setAddError("Всички полета са задължителни."); return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName.trim(), phone: addPhone.trim(), password: addPassword, role: addRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Грешка");
      setShowAddForm(false);
      setAddName(""); setAddPhone(""); setAddPassword(""); setAddRole("office_staff");
      fetchStaff();
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Грешка");
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (member: StaffMember) => {
    const res = await fetch(`/api/admin/staff/${member.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !member.is_active }),
    });
    if (res.ok) fetchStaff();
  };

  const openEdit = (m: StaffMember) => {
    setEditMember(m);
    setEditName(m.name);
    setEditPhone(m.phone ?? "");
    setEditRole(m.role);
    setEditPw("");
    setEditError(null);
  };

  const handleSaveEdit = async () => {
    if (!editMember) return;
    setEditError(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = { name: editName.trim(), role: editRole };
      if (editPhone.trim()) body.phone = editPhone.trim();
      if (editPw.trim()) body.password = editPw.trim();
      const res = await fetch(`/api/admin/staff/${editMember.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Грешка");
      setEditMember(null);
      fetchStaff();
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : "Грешка");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/staff/${confirmDelete.id}`, { method: "DELETE", credentials: "include" });
    setDeleting(false);
    if (res.ok) { setConfirmDelete(null); fetchStaff(); }
  };

  const counts = {
    total: staff.length,
    active: staff.filter(s => s.is_active).length,
    office: staff.filter(s => s.role === "office_staff").length,
    service: staff.filter(s => s.role === "service_staff").length,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-400" /> Управление на персонала
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {canManage
              ? "Само Master Admin може да добавя и управлява служители."
              : "Преглед на екипа — промените се правят от главния администратор."}
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowAddForm(v => !v)} className="flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Нов служител
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Общо", value: counts.total, color: "text-slate-700" },
          { label: "Активни", value: counts.active, color: "text-emerald-600" },
          { label: "Офис", value: counts.office, color: "text-brand-blue-500" },
          { label: "Сервизни", value: counts.service, color: "text-amber-600" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Add form */}
      {canManage && showAddForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-bold text-slate-800">Добави нов служител</p>
            <button onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Имe *</label>
              <Input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Иван Петров" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Телефон *</label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="tel"
                  value={addPhone}
                  onChange={e => setAddPhone(e.target.value)}
                  placeholder="+359 878 581 616"
                  autoComplete="off"
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Парола *</label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={addPassword}
                  onChange={e => setAddPassword(e.target.value)}
                  placeholder="Мин. 6 знака, 2 цифри"
                  autoComplete="new-password"
                  className="pr-8"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
                  {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Роля *</label>
              <Select value={addRole} onChange={e => setAddRole(e.target.value as "office_staff" | "service_staff")}>
                <option value="office_staff">Офис служител</option>
                <option value="service_staff">Сервизен техник</option>
              </Select>
            </div>
          </div>
          {addError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{addError}</p>
          )}
          <div className="flex gap-2 pt-1">
            <Button onClick={handleAdd} disabled={adding}>
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Добави служител
            </Button>
            <Button variant="secondary" onClick={() => setShowAddForm(false)}>Отказ</Button>
          </div>
        </div>
      )}

      {/* Staff list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {staff.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Все още няма добавени служители.</p>
            </div>
          ) : (
            <>
            <div className="md:hidden divide-y divide-slate-100">
              {staff.map((m) => (
                <div key={m.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0 overflow-hidden ring-1 ring-slate-200/80">
                    {m.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      m.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-800 text-sm">{m.name}
                        {m.id === currentUserId && <span className="ml-1 text-[10px] text-slate-400">(ти)</span>}
                      </p>
                      <RoleBadge role={m.role} />
                    </div>
                    {m.phone ? (
                      <a href={`tel:${m.phone}`} className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />{m.phone}
                      </a>
                    ) : (
                      <p className="text-xs text-slate-300 italic mt-0.5">без телефон</p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1">
                      {m.last_login_at
                        ? `Вход: ${new Date(m.last_login_at).toLocaleDateString("bg-BG", { day: "2-digit", month: "short" })}`
                        : "Няма вход"}
                      · {m.is_active ? "Активен" : "Неактивен"}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={() => openEdit(m)}
                        className="p-2 min-h-11 min-w-11 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors flex items-center justify-center"
                        title="Редактирай">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {m.id !== currentUserId && (
                        <>
                          <button onClick={() => handleToggleActive(m)}
                            className="p-2 min-h-11 min-w-11 rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-center"
                            title={m.is_active ? "Деактивирай" : "Активирай"}>
                            {m.is_active ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-slate-300" />}
                          </button>
                          <button onClick={() => setConfirmDelete(m)}
                            className="p-2 min-h-11 min-w-11 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors flex items-center justify-center"
                            title="Изтрий">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <table className="w-full text-xs hidden md:table">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Служител</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500 hidden sm:table-cell">Роля</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500 hidden md:table-cell">Последен вход</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-slate-500">Статус</th>
                  {canManage && (
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-500">Действия</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {staff.map((m, i) => (
                  <tr key={m.id} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0 overflow-hidden ring-1 ring-slate-200/80">
                          {m.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            m.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{m.name}
                            {m.id === currentUserId && <span className="ml-1.5 text-[10px] text-slate-400">(ти)</span>}
                          </p>
                          {m.phone ? (
                            <p className="text-slate-400 flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" />{m.phone}
                            </p>
                          ) : (
                            <p className="text-slate-300 italic">без телефон</p>
                          )}
                          <span className="sm:hidden"><RoleBadge role={m.role} /></span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell"><RoleBadge role={m.role} /></td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell">
                      {m.last_login_at
                        ? new Date(m.last_login_at).toLocaleDateString("bg-BG", { day: "2-digit", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {canManage ? (
                        <button onClick={() => handleToggleActive(m)}
                          disabled={m.id === currentUserId}
                          title={m.is_active ? "Деактивирай" : "Активирай"}
                          className="disabled:opacity-40 disabled:cursor-not-allowed">
                          {m.is_active
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                            : <XCircle className="w-4 h-4 text-slate-300 mx-auto" />}
                        </button>
                      ) : (
                        m.is_active
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                          : <XCircle className="w-4 h-4 text-slate-300 mx-auto" />
                      )}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(m)}
                            className="p-2 min-h-11 min-w-11 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors flex items-center justify-center"
                            title="Редактирай">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {m.id !== currentUserId && (
                            <button onClick={() => setConfirmDelete(m)}
                              className="p-2 min-h-11 min-w-11 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors flex items-center justify-center"
                              title="Изтрий">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editMember && (
        <div className={ADMIN_MODAL_BACKDROP}>
          <div className={`${ADMIN_MODAL_PANEL} max-w-md`} onClick={(e) => e.stopPropagation()}>
            <AdminModalDragHandle />
            <div className="overflow-y-auto flex-1 min-h-0 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Редактирай служител</h2>
              <button onClick={() => setEditMember(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 pb-4 border-b border-slate-100">
              <div className="relative w-24 h-24 rounded-full bg-slate-100 overflow-hidden ring-2 ring-slate-200/90 shadow-inner">
                {editMember.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editMember.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-slate-400">
                    {(editName.trim() || editMember.name).charAt(0).toUpperCase() || "?"}
                  </div>
                )}
                {avatarBusy ? (
                  <div className="absolute inset-0 bg-white/75 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-blue-600" />
                  </div>
                ) : null}
              </div>
              <input
                ref={avatarFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f || !editMember) return;
                  if (f.size > 6 * 1024 * 1024) {
                    setEditError("Снимката е прекалено голяма (макс. 6 MB).");
                    e.target.value = "";
                    return;
                  }
                  setEditError(null);
                  const url = URL.createObjectURL(f);
                  setAvatarCropSrc(url);
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap gap-2 justify-center">
                <Button
                  type="button"
                  variant="secondary"
                  className="text-xs"
                  disabled={avatarBusy}
                  onClick={() => avatarFileRef.current?.click()}
                >
                  <ImagePlus className="w-3.5 h-3.5 mr-1 shrink-0" />
                  Качи снимка
                </Button>
                {editMember.avatar_url ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="text-xs"
                    disabled={avatarBusy}
                    onClick={() => void removeStaffAvatar()}
                  >
                    Махни снимката
                  </Button>
                ) : null}
              </div>
              <p className="text-[10px] text-slate-400 text-center leading-snug max-w-xs">
                Първо позиционирай в кръга (като във Facebook), после се качва в{" "}
                <span className="font-mono">smolyanklima/personal/…</span>
                {" · "}до 6 MB оригинал
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Имe</label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Телефон</label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="tel"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    placeholder="+359 878 581 616"
                    autoComplete="off"
                    className="pl-8"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Роля</label>
                <Select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value as AdminRole)}
                  disabled={editMember.id === currentUserId}
                >
                  <option value="master_admin">Master Admin</option>
                  <option value="office_staff">Офис служител</option>
                  <option value="service_staff">Сервизен техник</option>
                </Select>
                {editMember.id === currentUserId && (
                  <p className="text-[11px] text-slate-400 mt-1">Не можеш да промениш собствената си роля.</p>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  <KeyRound className="w-3 h-3 inline mr-1" />
                  Нова парола <span className="text-slate-400 font-normal">(остави празно за без промяна)</span>
                </label>
                <div className="relative">
                  <Input
                    type={showEditPw ? "text" : "password"}
                    value={editPw}
                    onChange={e => setEditPw(e.target.value)}
                    placeholder="Мин. 6 знака, 2 цифри"
                    autoComplete="new-password"
                    className="pr-8"
                  />
                  <button type="button" onClick={() => setShowEditPw(v => !v)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center">
                    {showEditPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
            {editError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{editError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Запази
              </Button>
              <Button variant="secondary" onClick={() => setEditMember(null)}>Отказ</Button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className={ADMIN_MODAL_BACKDROP}>
          <div className={`${ADMIN_MODAL_PANEL} max-w-sm p-5 space-y-4`} onClick={(e) => e.stopPropagation()}>
            <AdminModalDragHandle />
            <h2 className="text-sm font-bold text-slate-800">Изтрий служител</h2>
            <p className="text-xs text-slate-600">
              Сигурен ли си, че искаш да изтриеш <strong>{confirmDelete.name}</strong>? Акаунтът ще бъде изтрит окончателно.
            </p>
            <div className="flex gap-2">
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Изтрий
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Отказ</Button>
            </div>
          </div>
        </div>
      )}

      {avatarCropSrc && editMember ? (
        <StaffAvatarCropModal
          imageSrc={avatarCropSrc}
          onCancel={() => {
            URL.revokeObjectURL(avatarCropSrc);
            setAvatarCropSrc(null);
          }}
          onConfirm={async (file) => {
            const id = editMember.id;
            URL.revokeObjectURL(avatarCropSrc);
            setAvatarCropSrc(null);
            await uploadStaffAvatar(file, id);
          }}
        />
      ) : null}
    </div>
  );
}
