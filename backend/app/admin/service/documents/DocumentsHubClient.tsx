"use client";

import { useRouter } from "next/navigation";
import { FileSignature, Wrench, ShieldCheck, FileText, Receipt, ChevronRight, Clock } from "lucide-react";
import type { ComponentType } from "react";

type DocKind = {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
  tone: "blue" | "brand" | "amber" | "violet" | "rose";
  enabled: boolean;
};

const TONE_CLASSES: Record<DocKind["tone"], { iconBg: string; iconText: string; ring: string }> = {
  blue: { iconBg: "bg-blue-50", iconText: "text-blue-600", ring: "hover:ring-blue-200" },
  brand: { iconBg: "bg-brand-orange-50", iconText: "text-brand-blue-700", ring: "hover:ring-brand-blue-200" },
  amber: { iconBg: "bg-amber-50", iconText: "text-amber-600", ring: "hover:ring-amber-200" },
  violet: { iconBg: "bg-violet-50", iconText: "text-violet-600", ring: "hover:ring-violet-200" },
  rose: { iconBg: "bg-rose-50", iconText: "text-rose-600", ring: "hover:ring-rose-200" },
};

export function DocumentsHubClient({ kinds }: { kinds: DocKind[] }) {
  const router = useRouter();

  return (
    <div className="p-4 space-y-3 max-w-3xl mx-auto w-full">
      {kinds.map((doc) => {
        const Icon = doc.icon;
        const tone = TONE_CLASSES[doc.tone];

        const inner = (
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${tone.iconBg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-6 h-6 ${tone.iconText}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-bold text-slate-900 truncate">{doc.title}</p>
                {!doc.enabled && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
                    <Clock className="w-2.5 h-2.5" />
                    Скоро
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{doc.description}</p>
            </div>
            {doc.enabled && <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />}
          </div>
        );

        if (!doc.enabled) {
          return (
            <div
              key={doc.id}
              className="bg-white/70 rounded-2xl border border-slate-100 p-4 cursor-not-allowed opacity-70 select-none"
              aria-disabled="true"
            >
              {inner}
            </div>
          );
        }

        return (
          <button
            key={doc.id}
            type="button"
            onClick={() => router.push(doc.href)}
            className={`block w-full text-left bg-white rounded-2xl border border-slate-100 p-4 ring-2 ring-transparent transition-shadow ${tone.ring} shadow-sm active:scale-[0.99] min-h-[44px]`}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}

export const DOCUMENT_HUB_KINDS: DocKind[] = [
  {
    id: "acceptance",
    title: "Приемно-предавателни протоколи",
    description:
      "При монтаж на климатик — фиксира оборудване, материали, цена и подписи на двете страни.",
    icon: FileSignature,
    href: "/admin/service/documents/acceptance",
    tone: "blue",
    enabled: true,
  },
  {
    id: "service",
    title: "Сервизни протоколи",
    description:
      "При профилактика, ремонт или диагностика — описва открити проблеми, извършена работа и резервни части.",
    icon: Wrench,
    href: "/admin/service/documents/service",
    tone: "brand",
    enabled: true,
  },
  {
    id: "warranty",
    title: "Гаранционни карти",
    description: "Гаранционна карта към клиент с условия и срокове — поражда се при покупка/монтаж.",
    icon: ShieldCheck,
    href: "/admin/service/documents/warranty",
    tone: "violet",
    enabled: false,
  },
  {
    id: "offers",
    title: "Оферти",
    description: "Предварителна оферта към клиент преди монтаж/сервиз — със спецификации и цени.",
    icon: FileText,
    href: "/admin/service/documents/offers",
    tone: "amber",
    enabled: false,
  },
  {
    id: "invoices",
    title: "Фактури",
    description: "Изходящи фактури към клиенти и компании — с автоматичен номер и подаване в счетоводство.",
    icon: Receipt,
    href: "/admin/service/documents/invoices",
    tone: "rose",
    enabled: false,
  },
];
