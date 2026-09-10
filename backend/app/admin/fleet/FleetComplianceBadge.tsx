import type { FleetComplianceSummaryItem } from "@/lib/admin/fleetTypes";
import { fleetComplianceKindLabel } from "@/lib/admin/fleetTypes";
import { FleetStatusDot } from "./FleetStatusDot";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const [y, m, d] = iso.slice(0, 10).split("-");
    return `${d}.${m}.${y?.slice(2)}`;
  } catch {
    return iso;
  }
}

export function FleetComplianceBadge({
  item,
  compact = false,
  label,
}: {
  item: FleetComplianceSummaryItem | null;
  compact?: boolean;
  label?: string;
}) {
  const level = item?.level ?? "missing";
  const text = fmtDate(item?.expires_on ?? null);

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-xs tabular-nums">
        <FleetStatusDot level={level} size="sm" />
        <span className="font-medium text-slate-700">{text}</span>
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <FleetStatusDot level={level} title={label ?? fleetComplianceKindLabel(item?.kind ?? "vignette")} />
      <div className="min-w-0">
        {label && <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>}
        <div className="text-sm font-medium tabular-nums text-slate-800">{text}</div>
      </div>
    </div>
  );
}

export function FleetComplianceMiniBadge({
  shortLabel,
  item,
}: {
  shortLabel: string;
  item: FleetComplianceSummaryItem | null;
}) {
  const level = item?.level ?? "missing";
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600"
      title={`${item?.kind ? fleetComplianceKindLabel(item.kind) : shortLabel}: ${item?.expires_on ?? "липсва"}`}
    >
      <FleetStatusDot level={level} size="sm" />
      {shortLabel}
    </span>
  );
}
