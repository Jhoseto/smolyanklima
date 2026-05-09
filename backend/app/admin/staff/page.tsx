import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin/db";
import { StaffPageClient } from "./StaffPageClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Персонал | Смолян Клима Админ" };

export default async function StaffPage() {
  let session;
  try {
    session = await adminSession();
  } catch {
    redirect("/login");
  }

  if (session.role !== "master_admin") {
    redirect("/admin");
  }

  return <StaffPageClient currentUserId={session.userId} />;
}
