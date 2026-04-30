import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EmailOutboxDrain } from "./EmailOutboxDrain";

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
      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Табло</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
        Фаза 4: CRUD и публични API са активни. Следващи стъпки: deploy (Docker/Cloud Run), email worker при нужда.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        {[
          { label: "Продукти", value: String(nProducts) },
          { label: "Публикувани статии", value: String(nArticles) },
          { label: "Нови запитвания", value: String(nInquiries) },
          { label: "Имейли в опашка (pending)", value: String(nOutbox) },
        ].map((card) => (
          <div key={card.label} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{card.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <EmailOutboxDrain pendingCount={nOutbox} />
      </div>
    </div>
  );
}
