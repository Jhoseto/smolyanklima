import { redirect } from "next/navigation";

/** Календарът и операциите са на основното табло (/admin). */
export default function AdminOperationsRedirectPage() {
  redirect("/admin");
}
