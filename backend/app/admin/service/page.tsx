import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin/db";
import { ServiceDashboard } from "./ServiceDashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Мои задачи | Смолян Клима" };

export default async function ServicePage() {
  let session;
  try {
    session = await adminSession();
  } catch {
    redirect("/login");
  }

  // Only service_staff uses this page; others go to main admin
  if (session.role !== "service_staff") {
    redirect("/admin");
  }

  return <ServiceDashboard userId={session.userId} userName={session.name} />;
}
