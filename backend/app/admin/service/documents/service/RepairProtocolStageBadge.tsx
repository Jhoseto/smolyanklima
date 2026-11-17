import { CheckCircle, ClipboardCheck, FilePenLine, LogOut, Wrench } from "lucide-react";
import type { RepairWorkflowStage } from "@/lib/repair-protocol-fields";
import { REPAIR_STAGE_LABELS } from "@/lib/repair-protocol-presentation";

const styles = {
  intake: { icon: FilePenLine, color: "bg-slate-100 text-slate-700" },
  received: { icon: ClipboardCheck, color: "bg-brand-blue-100 text-brand-blue-900" },
  issuing: { icon: LogOut, color: "bg-amber-100 text-amber-900" },
  issued: { icon: CheckCircle, color: "bg-emerald-100 text-emerald-900" },
  legacy_signed: { icon: Wrench, color: "bg-slate-100 text-slate-700" },
};

export function RepairProtocolStageBadge({ stage }: { stage: RepairWorkflowStage }) {
  const { icon: Icon, color } = styles[stage];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${color}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {REPAIR_STAGE_LABELS[stage]}
    </span>
  );
}
