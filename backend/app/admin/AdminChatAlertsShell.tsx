"use client";

import type { ReactNode } from "react";
import type { AdminRole } from "@/lib/admin/db";
import { AdminChatAlertsProvider } from "./AdminChatAlertsProvider";

export function AdminChatAlertsShell({
  role,
  children,
}: {
  role: AdminRole;
  children: ReactNode;
}) {
  return <AdminChatAlertsProvider role={role}>{children}</AdminChatAlertsProvider>;
}
