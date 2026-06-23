import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin/db";
import { AboutPageClient } from "./AboutPageClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "За приложението | Смолян Клима Админ",
};

export default async function AboutPage() {
  try {
    const session = await adminSession();
    if (session.role !== "master_admin" && session.role !== "office_staff") {
      redirect("/admin");
    }
  } catch {
    redirect("/login");
  }

  return <AboutPageClient />;
}
