"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users, Plus, ShieldCheck, Briefcase, Wrench,
  CheckCircle2, XCircle, Pencil, Trash2, KeyRound,
  Loader2, X, Eye, EyeOff, Phone,
} from "lucide-react";
import { Button, Input, Select } from "../ui";

type AdminRole = "master_admin" | "office_staff" | "service_staff";

interface StaffMember {
  id: string;
  phone: string | null;
  name: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
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

export function StaffPageClient({ currentUserId }: { currentUserId: string }) {
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

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/staff", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Грешка при зареждане");
      setStaff(data.staff);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Грешка");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

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
          <p className="text-xs text-slate-500 mt-0.5">Само Master Admin може да добавя и управлява служители.</p>
        </div>
        <Button onClick={() => setShowAddForm(v => !v)} className="flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Нов служител
        </Button>
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
      {showAddForm && (
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
                  placeholder="+359 888 123 456"
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
                  placeholder="Мин. 4 символа"
                  autoComplete="new-password"
                  className="pr-8"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
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
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Служител</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500 hidden sm:table-cell">Роля</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500 hidden md:table-cell">Последен вход</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-slate-500">Статус</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-500">Действия</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((m, i) => (
                  <tr key={m.id} className={`border-b border-slate-100 last:border-0 ${i % 2 === 0 ? "" : "bg-slate-50/50"}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0">
                          {m.name.charAt(0).toUpperCase()}
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
                      <button onClick={() => handleToggleActive(m)}
                        disabled={m.id === currentUserId}
                        title={m.is_active ? "Деактивирай" : "Активирай"}
                        className="disabled:opacity-40 disabled:cursor-not-allowed">
                        {m.is_active
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                          : <XCircle className="w-4 h-4 text-slate-300 mx-auto" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(m)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                          title="Редактирай">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {m.id !== currentUserId && (
                          <button onClick={() => setConfirmDelete(m)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                            title="Изтрий">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Edit modal */}
      {editMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Редактирай служител</h2>
              <button onClick={() => setEditMember(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
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
                    placeholder="+359 888 123 456"
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
                    placeholder="Мин. 4 символа"
                    autoComplete="new-password"
                    className="pr-8"
                  />
                  <button type="button" onClick={() => setShowEditPw(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
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
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
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
    </div>
  );
}
