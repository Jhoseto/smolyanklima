import type { ReactNode, ComponentProps } from "react";
import { Info } from "lucide-react";

export function InfoDot({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-50 text-blue-600 cursor-help"
    >
      <Info className="w-3.5 h-3.5" />
    </span>
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
    <div className="inline-flex items-center gap-1.5">
      <span className="text-slate-900 font-bold text-base leading-snug">{title}</span>
      {hint && <InfoDot text={hint} />}
    </div>
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

// --- New Reusable Modern Components ---

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-lg shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function HelpCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-gradient-to-b from-white to-slate-50 border border-slate-200 rounded-lg p-3 shadow-sm ${className}`}>
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
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" | "ghost", size?: "sm" | "md" | "lg" }) {
  
  const baseStyles = "inline-flex items-center justify-center font-semibold rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-sky-600 text-white hover:bg-sky-700 focus:ring-sky-500",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-200",
    danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50 focus:ring-red-200",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-200",
  };
  
  const sizes = {
    sm: "px-2 py-1.5 text-xs",
    md: "px-3 py-2 text-sm",
    lg: "px-3.5 py-2 text-sm",
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
      className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-shadow ${className}`}
      {...props}
    />
  );
}

export function Select({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <select 
      className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-shadow appearance-none ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return (
    <textarea 
      className={`w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-shadow resize-y min-h-[3rem] ${className}`}
      {...props}
    />
  );
}

export function Table({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`w-full overflow-x-auto bg-white border border-slate-200 rounded-lg shadow-sm ${className}`}>
      <table className="w-full text-left border-collapse">
        {children}
      </table>
    </div>
  );
}

export function Th({ className = "", ...props }: ComponentProps<"th">) {
  return (
    <th
      className={`px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 border-b border-slate-200 ${className}`}
      {...props}
    />
  );
}

export function Td({ className = "", ...props }: ComponentProps<"td">) {
  return (
    <td
      className={`px-3 py-2 text-sm text-slate-700 border-b border-slate-100 ${className}`}
      {...props}
    />
  );
}
