import Link from "next/link";
import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin/db";
import {
  FileSignature,
  Wrench,
  ShieldCheck,
  FileText,
  Receipt,
  ChevronRight,
  Clock,
} from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Документи | Смолян Клима" };

/**
 * Hub на сервизните документи. Тук НЕ показваме конкретни записи —
 * показваме каталог от видове документи, всеки от които е напълно
 * самостоятелен (собствен route, форма, таблица в БД, API, PDF шаблон).
 *
 * Когато добавяме нов вид документ, само добавяме нов елемент в `DOC_KINDS`
 * (`href` сочи към новата подпапка). `enabled: false` показва „Скоро“ карта
 * за неготови видове — за да са видими бъдещите модули и да не се изненадат
 * потребителите.
 */

type DocKind = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  tone: "blue" | "emerald" | "amber" | "violet" | "rose";
  enabled: boolean;
};

const DOC_KINDS: DocKind[] = [
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
    tone: "emerald",
    enabled: true,
  },
  {
    id: "warranty",
    title: "Гаранционни карти",
    description:
      "Гаранционна карта към клиент с условия и срокове — поражда се при покупка/монтаж.",
    icon: ShieldCheck,
    href: "/admin/service/documents/warranty",
    tone: "violet",
    enabled: false,
  },
  {
    id: "offers",
    title: "Оферти",
    description:
      "Предварителна оферта към клиент преди монтаж/сервиз — със спецификации и цени.",
    icon: FileText,
    href: "/admin/service/documents/offers",
    tone: "amber",
    enabled: false,
  },
  {
    id: "invoices",
    title: "Фактури",
    description:
      "Изходящи фактури към клиенти и компании — с автоматичен номер и подаване в счетоводство.",
    icon: Receipt,
    href: "/admin/service/documents/invoices",
    tone: "rose",
    enabled: false,
  },
];

const TONE_CLASSES: Record<DocKind["tone"], { iconBg: string; iconText: string; ring: string }> = {
  blue:    { iconBg: "bg-blue-50",    iconText: "text-blue-600",    ring: "hover:ring-blue-200" },
  emerald: { iconBg: "bg-emerald-50", iconText: "text-emerald-600", ring: "hover:ring-emerald-200" },
  amber:   { iconBg: "bg-amber-50",   iconText: "text-amber-600",   ring: "hover:ring-amber-200" },
  violet:  { iconBg: "bg-violet-50",  iconText: "text-violet-600",  ring: "hover:ring-violet-200" },
  rose:    { iconBg: "bg-rose-50",    iconText: "text-rose-600",    ring: "hover:ring-rose-200" },
};

export default async function ServiceDocumentsHubPage() {
  try {
    await adminSession();
  } catch {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Хедър ── */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-base font-bold text-slate-900">Документи</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Изберете вид документ за работа. Всеки тип има отделна форма, история и PDF шаблон.
        </p>
      </div>

      {/* ── Списък с видове ── */}
      <div className="p-4 space-y-3 max-w-3xl mx-auto">
        {DOC_KINDS.map((doc) => {
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
                title="Този вид документ ще бъде наличен скоро"
              >
                {inner}
              </div>
            );
          }

          return (
            <Link
              key={doc.id}
              href={doc.href}
              className={`block bg-white rounded-2xl border border-slate-100 p-4 ring-2 ring-transparent transition-shadow ${tone.ring} shadow-sm active:scale-[0.99]`}
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
