import { redirect } from "next/navigation";
import { Suspense } from "react";
import { adminSession } from "@/lib/admin/db";
import { OffersClient } from "./OffersClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Оферти | Смолян Клима" };

export default async function OffersPage() {
  try {
    await adminSession();
  } catch {
    redirect("/login");
  }

  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Зареждане…</div>}>
      <OffersClient />
    </Suspense>
  );
}
