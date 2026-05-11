import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin/db";

export const metadata = { title: "Оценки | Смолян Клима Админ" };

export default async function RatingsLayout({ children }: { children: React.ReactNode }) {
  try {
    const session = await adminSession();
    if (session.role !== "master_admin") {
      redirect("/admin");
    }
  } catch {
    redirect("/login");
  }
  return <>{children}</>;
}
