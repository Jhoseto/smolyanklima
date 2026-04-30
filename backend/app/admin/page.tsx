import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmailOutboxDrain } from "./EmailOutboxDrain";
import { WorkItemsPlanner } from "./WorkItemsPlanner";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();

  const [products, articles, inquiriesNew, outboxPending] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("articles").select("id", { count: "exact", head: true }).eq("is_published", true),
    supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const nProducts = products.count ?? 0;
  const nArticles = articles.count ?? 0;
  const nInquiries = inquiriesNew.count ?? 0;
  const nOutbox = outboxPending.count ?? 0;

  return (
    <div>
      <h1 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, color: "#0f172a" }}>Табло</h1>
      <p style={{ color: "#64748b", fontSize: 12, marginBottom: 12 }}>
        Обзор на каталога, статиите, запитванията и имейл опашката.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        {[
          { label: "Продукти", value: String(nProducts) },
          { label: "Публикувани статии", value: String(nArticles) },
          { label: "Нови запитвания", value: String(nInquiries) },
          { label: "Имейли в опашка (pending)", value: String(nOutbox) },
        ].map((card) => (
          <div key={card.label} style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 14, background: "white" }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{card.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: "#0f172a" }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <EmailOutboxDrain pendingCount={nOutbox} />
      </div>
      <WorkItemsPlanner />
    </div>
  );
}
