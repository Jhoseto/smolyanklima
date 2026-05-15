import { Suspense } from "react";
import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin/db";
import { InquiriesClient } from "./InquiriesClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Запитвания | Смолян Клима" };

export default async function AdminInquiriesPage() {
  try {
    await adminSession();
  } catch {
    redirect("/login");
  }

  return (
    <div className="w-full min-h-0">
      <Suspense fallback={<div className="p-6 text-sm text-slate-500">Зареждане...</div>}>
        <InquiriesClient />
      </Suspense>
    </div>
  );
}
