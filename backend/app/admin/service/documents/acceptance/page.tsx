import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin/db";
import { DocumentsClient } from "./DocumentsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Приемно-предавателни протоколи | Смолян Клима" };

/**
 * Страница за приемно-предавателни протоколи — документ, който се
 * подписва между фирмата и клиента при монтаж на климатик. Това е първият
 * от планираните видове документи в /admin/service/documents.
 *
 * Hub-ът (родителската страница) обединява всички видове документи; този
 * route обслужва само конкретния тип, заедно с form wizard-а и preview-то.
 */
export default async function AcceptanceProtocolsPage() {
  let session;
  try {
    session = await adminSession();
  } catch {
    redirect("/login");
  }

  return <DocumentsClient role={session.role} />;
}
