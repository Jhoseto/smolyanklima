import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin/db";
import { ServiceHub } from "./ServiceHub";

export const dynamic = "force-dynamic";
export const metadata = { title: "Сервиз | Смолян Клима" };

export default async function ServiceRootPage() {
  let session;
  try {
    session = await adminSession();
  } catch {
    redirect("/login");
  }

  if (session.role === "office_staff") {
    redirect("/admin");
  }

  if (session.role === "service_staff") {
    redirect("/admin/service/tasks");
  }

  return <ServiceHub />;
}
