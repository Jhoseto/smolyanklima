export const dynamic = "force-dynamic";

export default function AdminDashboardPage() {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Табло</h1>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
        Фаза 3: базов админ скелет. Следва Фаза 4: CRUD екрани.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        {[
          { label: "Продукти", value: "—" },
          { label: "Публикувани статии", value: "—" },
          { label: "Нови запитвания", value: "—" },
          { label: "Имейли за изпращане", value: "—" },
        ].map((card) => (
          <div key={card.label} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 14 }}>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{card.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

