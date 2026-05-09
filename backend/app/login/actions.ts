"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Schema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  next: z.string().optional(),
});

/** Converts a phone number to the internal Supabase Auth email format. */
function resolveEmail(input: string): string {
  const trimmed = input.trim();
  // If it looks like a phone number (contains only digits, spaces, +, -, (, ))
  if (/^[\d\s+\-().]+$/.test(trimmed) && !/^[\w.-]+@[\w.-]+\.\w+$/.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, "");
    return `staff_${digits}@smolyanklima.internal`;
  }
  return trimmed;
}

export async function loginAction(formData: FormData) {
  const parsed = Schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    redirect("/login?error=invalid_input");
  }

  const email = resolveEmail(parsed.data.email);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
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
    .select("id,is_active,role")
    .eq("id", user.id)
    .maybeSingle();

  if (adminErr || !adminRow || !adminRow.is_active) {
    redirect(`/login?reason=not_admin&next=${encodeURIComponent(parsed.data.next || "/admin")}`);
  }

  // service_staff goes directly to their task view
  if (!parsed.data.next || parsed.data.next === "/admin") {
    if (adminRow.role === "service_staff") {
      redirect("/admin/service");
    }
  }

  redirect(parsed.data.next || "/admin");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
