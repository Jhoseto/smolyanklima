import { WorkItemsPlanner } from "../WorkItemsPlanner";

export const dynamic = "force-dynamic";

export default function AdminOperationsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, color: "#0f172a" }}>Операции</h1>
      <p style={{ color: "#64748b", fontSize: 12, marginTop: 0, marginBottom: 12 }}>
        Едно място за продажби, сервизни задачи и зареждане на стока.
      </p>
      <WorkItemsPlanner />
    </div>
  );
}
