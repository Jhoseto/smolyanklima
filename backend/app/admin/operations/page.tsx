import { WorkItemsPlanner } from "../WorkItemsPlanner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Поръчки & Монтажи | Смолян Клима Админ" };

export default function AdminOperationsPage() {
  return (
    <div className="space-y-4">
      <WorkItemsPlanner />
    </div>
  );
}
