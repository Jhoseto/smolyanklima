import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin/db";
import { DocumentsClient } from "./DocumentsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Документи | Смолян Клима" };

export default async function ServiceDocumentsPage() {
  let session;
  try {
    session = await adminSession();
  } catch {
    redirect("/login");
  }

  if (session.role === "office_staff") {
    redirect("/admin");
  }

  return <DocumentsClient role={session.role} />;
}
