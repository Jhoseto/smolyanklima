import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin/db";
import SettingsPageClient from "./SettingsPageClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Настройки | Смолян Клима Админ" };

export default async function AdminSettingsPage() {
  try {
    const session = await adminSession();
    if (session.role !== "master_admin") {
      redirect("/admin");
    }
  } catch {
    redirect("/login");
  }

  return <SettingsPageClient />;
}
