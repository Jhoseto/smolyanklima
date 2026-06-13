import type { ReactNode, ComponentProps } from "react";
import { Info } from "lucide-react";
import { useAdminBackHandler } from "@/lib/admin/useAdminBackHandler";

/** Кратко обяснение при hover/focus върху иконки и компактни бутони. */
export function HoverTip({
  tip,
  children,
  className = "",
}: {
  tip: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`group/hovertip relative inline-flex ${className}`} title={tip}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 z-[80] hidden w-max max-w-[14rem] -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-1.5 text-center text-[11px] font-semibold leading-snug text-white shadow-lg group-hover/hovertip:block group-focus-within/hovertip:block"
      >
        {tip}
      </span>
    </span>
  );
}

export function InfoDot({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-blue-50 text-brand-blue-700 cursor-help shrink-0"
    >
      <Info className="w-3.5 h-3.5" />
    </span>
  );
}

/** Backdrop за admin modals — bottom sheet на mobile, центриран на desktop. */
export const ADMIN_MODAL_BACKDROP =
  "fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-slate-950/60 p-0 md:p-6 backdrop-blur-md";

/** Панел за admin modals — с safe area отдолу на mobile. */
export const ADMIN_MODAL_PANEL =
  "w-full max-h-[92dvh] md:max-h-[calc(100vh-3rem)] md:max-w-2xl overflow-hidden rounded-t-3xl md:rounded-3xl border border-white/60 bg-white shadow-2xl flex flex-col pb-safe md:pb-0";

export function AdminModalDragHandle() {
  return (
    <div className="flex justify-center pt-3.5 pb-1 md:hidden shrink-0">
      <div className="w-12 h-1.5 rounded-full bg-slate-200" />
    </div>
  );
}

/** Modal backdrop з Android back → onClose (не излиза от PWA). */
export { useAdminBackHandler } from "@/lib/admin/useAdminBackHandler";

export function AdminModalBackdrop({
  open,
  onClose,
  busy = false,
  children,
  className = "",
  layerId,
}: {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
  className?: string;
  layerId?: string;
}) {
  useAdminBackHandler(open, onClose, layerId);
  if (!open) return null;
  return (
    <div
      className={`${ADMIN_MODAL_BACKDROP} ${className}`.trim()}
      data-admin-overlay="true"
      onClick={() => !busy && onClose()}
    >
      {children}
    </div>
  );
}

export function InfoBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full whitespace-nowrap">
      {text}
    </span>
  );
}

export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 max-w-full min-w-0">
      <span className="text-slate-900 font-bold text-sm md:text-base leading-snug">{title}</span>
      {hint ? <InfoDot text={hint} /> : null}
    </span>
  );
}

export function HelpRow({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <InfoBadge key={item} text={item} />
      ))}
    </div>
  );
}

export function Labeled({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
        {label}
        {hint && <InfoDot text={hint} />}
      </span>
      {children}
    </label>
  );
}

// ─── Core UI Components ───────────────────────────────────────────────────────

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-slate-200/80 rounded-2xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function HelpCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-gradient-to-b from-white to-slate-50 border border-slate-200/80 rounded-2xl p-3 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  const baseStyles =
    "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] touch-action-manipulation";

  const variants = {
    primary:
      "bg-brand-orange-500 text-white hover:bg-brand-orange-600 focus:ring-brand-orange-500 shadow-sm shadow-brand-orange-200",
    secondary:
      "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-200 shadow-sm",
    danger:
      "bg-white text-red-600 border border-red-200 hover:bg-red-50 focus:ring-red-200",
    ghost:
      "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-200",
  };

  const sizes = {
    sm:  "px-3 py-2 text-xs min-h-[40px] gap-1.5",
    md:  "px-4 py-2.5 text-sm min-h-[44px] gap-2",
    lg:  "px-5 py-3 text-[15px] min-h-[48px] gap-2",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-base md:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-orange-500 focus:ring-2 focus:ring-brand-orange-500/20 transition-shadow min-h-[44px] ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={`w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-base md:text-sm text-slate-900 focus:outline-none focus:border-brand-orange-500 focus:ring-2 focus:ring-brand-orange-500/20 transition-shadow appearance-none min-h-[44px] ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={`w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-base md:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-orange-500 focus:ring-2 focus:ring-brand-orange-500/20 transition-shadow resize-y min-h-[88px] ${className}`}
      {...props}
    />
  );
}

export function Table({
  children,
  className = "",
  tableClassName = "",
  stickyHeader = false,
}: {
  children: ReactNode;
  className?: string;
  tableClassName?: string;
  stickyHeader?: boolean;
}) {
  return (
    <div
      className={`${
        stickyHeader ? "w-full" : "w-full overflow-x-auto"
      } bg-white border border-slate-200/80 rounded-2xl shadow-sm ${className}`}
    >
      <table
        className={`w-full text-left ${stickyHeader ? "border-separate border-spacing-0" : "border-collapse"} ${tableClassName}`}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({ className = "", ...props }: ComponentProps<"th">) {
  return (
    <th
      className={`px-3.5 py-2.5 text-xs font-bold text-slate-600 bg-slate-50 border-b border-slate-200 ${className}`}
      {...props}
    />
  );
}

export function Td({ className = "", ...props }: ComponentProps<"td">) {
  return (
    <td
      className={`px-3.5 py-2.5 text-sm text-slate-700 border-b border-slate-100 ${className}`}
      {...props}
    />
  );
}

export {
  AdminPhoneLink,
  AdminFieldValue,
  AdminContactMetaLine,
  AdminLabeledBox,
  AdminContactSuggestRow,
} from "./components/AdminContactLinks";
