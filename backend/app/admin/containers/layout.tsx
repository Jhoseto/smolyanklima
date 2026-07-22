import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin/db";

export default async function AdminContainersLayout({ children }: { children: React.ReactNode }) {
  try {
    const session = await adminSession();
    if (session.role === "service_staff") {
      redirect("/admin");
    }
  } catch {
    redirect("/login");
  }
  return <>{children}</>;
}
