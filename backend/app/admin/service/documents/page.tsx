import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin/db";
import { DocumentsHubClient, DOCUMENT_HUB_KINDS } from "./DocumentsHubClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Документи | Смолян Клима" };

/**
 * Hub на сервизните документи. Тук НЕ показваме конкретни записи —
 * показваме каталог от видове документи, всеки от които е напълно
 * самостоятелен (собствен route, форма, таблица в БД, API, PDF шаблон).
 */
export default async function ServiceDocumentsHubPage() {
  try {
    await adminSession();
  } catch {
    redirect("/login");
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-50 w-full min-w-0">
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10 shrink-0">
        <h1 className="text-base font-bold text-slate-900">Документи</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Изберете вид документ за работа. Всеки тип има отделна форма, история и PDF шаблон.
        </p>
      </div>

      <DocumentsHubClient kinds={DOCUMENT_HUB_KINDS} />
    </div>
  );
}
