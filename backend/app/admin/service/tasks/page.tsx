import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin/db";
import { WorkItemsPlanner } from "../../WorkItemsPlanner";
import { ServiceTasksClient } from "./ServiceTasksClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Сервизни задачи | Смолян Клима" };

export default async function ServiceTasksPage() {
  let session;
  try {
    session = await adminSession();
  } catch {
    redirect("/login");
  }

  if (session.role === "office_staff") {
    redirect("/admin");
  }

  // service_staff → mobile-first task view
  if (session.role === "service_staff") {
    return (
      <ServiceTasksClient
        userId={session.userId}
        userName={session.name}
        role={session.role}
      />
    );
  }

  // master_admin → full calendar planner
  return (
    <div className="w-full space-y-2">
      <div>
        <h1 className="text-lg font-bold text-slate-900 leading-tight">Сервизни задачи</h1>
        <p className="text-xs text-slate-500 mt-0.5">Всички задачи за обслужване по дни</p>
      </div>
      <WorkItemsPlanner />
    </div>
  );
}
