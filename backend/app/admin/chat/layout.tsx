import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin/db";

export const dynamic = "force-dynamic";

export default async function AdminChatLayout({ children }: { children: React.ReactNode }) {
  const session = await adminSession();
  if (session.role === "service_staff") {
    redirect("/admin");
  }
  return <>{children}</>;
}
