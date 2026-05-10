"use client";

import Link from "next/link";
import { CalendarClock, FolderOpen, ChevronRight } from "lucide-react";

/**
 * Мобилен избор: задачи (календар) или документи (протоколи).
 * Desktop страницата продължава да ползва директни линкове в страничната лента.
 */
export function ServiceHub() {
  return (
    <div className="w-full max-w-lg mx-auto space-y-3 p-1">
      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-900">Сервиз</h1>
        <p className="text-sm text-slate-500 mt-0.5">Изберете модул</p>
      </div>

      <Link
        href="/admin/service/tasks"
        className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm active:bg-slate-50 transition-colors no-underline text-inherit"
      >
        <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
          <CalendarClock className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-900">Задачи</div>
          <div className="text-xs text-slate-500 mt-0.5">Календар и сервизни позиции</div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
      </Link>

      <Link
        href="/admin/service/documents"
        className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm active:bg-slate-50 transition-colors no-underline text-inherit"
      >
        <div className="w-12 h-12 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
          <FolderOpen className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-900">Документи</div>
          <div className="text-xs text-slate-500 mt-0.5">Приемно-предавателни протоколи</div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
      </Link>
    </div>
  );
}
