import type { FleetComplianceLevel } from "@/lib/admin/fleetTypes";
import { fleetComplianceDotClass } from "@/lib/admin/fleetComplianceStatus";

export function FleetStatusDot({
  level,
  size = "md",
  title,
}: {
  level: FleetComplianceLevel;
  size?: "sm" | "md";
  title?: string;
}) {
  const dim = size === "sm" ? "w-2 h-2" : "w-2.5 h-2.5";
  return (
    <span
      className={`inline-block shrink-0 rounded-full ${dim} ${fleetComplianceDotClass(level)}`}
      title={title}
      aria-hidden={title ? undefined : true}
    />
  );
}
