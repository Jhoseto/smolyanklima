import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin/db";
import { ServiceDocumentsClient } from "./ServiceDocumentsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Сервизни протоколи | Смолян Клима" };

/**
 * Страница за сервизни (профилактика/ремонт/диагностика) протоколи.
 * Огледало на /admin/service/documents/acceptance, но за втория тип
 * документ — със собствена таблица в БД (service_repair_protocols)
 * и собствени полета (Japanese flag, фреон, лагери, налягания и т.н.).
 */
export default async function ServiceProtocolsPage() {
  let session;
  try {
    session = await adminSession();
  } catch {
    redirect("/login");
  }

  return <ServiceDocumentsClient role={session.role} />;
}
