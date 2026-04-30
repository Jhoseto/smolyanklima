"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  next: z.string().optional(),
});

export async function loginAction(formData: FormData) {
  const parsed = Schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    redirect("/login?error=invalid_input");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?error=Невалидна сесия. Опитайте отново.");
  }

  const { data: adminRow, error: adminErr } = await supabase
    .from("admin_users")
    .select("id,is_active")
    .eq("id", user.id)
    .maybeSingle();

  // If admin_users is missing/inactive, block access early (prevents confusing RLS 403 later).
  if (adminErr || !adminRow || !adminRow.is_active) {
    redirect(`/login?reason=not_admin&next=${encodeURIComponent(parsed.data.next || "/admin")}`);
  }

  redirect(parsed.data.next || "/admin");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

