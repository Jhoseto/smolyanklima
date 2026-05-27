import { redirect } from "next/navigation";
import { adminSession } from "@/lib/admin/db";
import { getEnv } from "@/lib/env";
import AiAgentClient from "./AiAgentClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI Agent | Смолян Клима Админ" };

export default async function AdminAiAgentPage() {
  try {
    const session = await adminSession();
    if (session.role !== "master_admin") {
      redirect("/admin");
    }
  } catch {
    redirect("/login");
  }

  const env = getEnv();
  const aiEnabled = env.AI_ENABLED !== false && Boolean(env.GEMINI_API_KEY);

  return <AiAgentClient aiEnabled={aiEnabled} />;
}
