import type { RepairWorkflowStage } from "./repair-protocol-fields";

export const REPAIR_STAGE_LABELS: Record<RepairWorkflowStage, string> = {
  intake: "В процес на завеждане",
  received: "Заведен",
  issuing: "В процес на издаване",
  issued: "Издаден",
  legacy_signed: "Подписан по стария образец",
};

/** Rows created before the two-part form have no recorded issue stage. */
export function repairProtocolDisplayStage(row: { workflow_stage?: unknown; status?: unknown }): RepairWorkflowStage {
  const stage = row.workflow_stage;
  if (stage === "received" || stage === "issuing" || stage === "issued" || stage === "intake" || stage === "legacy_signed") {
    return stage;
  }
  return row.status === "signed" ? "legacy_signed" : "intake";
}

export type RepairProtocolPart = Record<string, unknown> & {
  signature_team?: string | null;
};

export type RepairProtocolDocument = RepairProtocolPart & {
  protocol_number: string;
  status?: string | null;
  workflow_stage?: RepairWorkflowStage | null;
  issue_data?: RepairProtocolPart | null;
};

export function repairProtocolDocumentParts(row: RepairProtocolDocument) {
  const stage = repairProtocolDisplayStage(row);
  const parts = [{
    title: stage === "legacy_signed" ? "Сервизен запис" : "Завеждане",
    data: row as RepairProtocolPart,
  }];
  if ((stage === "issuing" || stage === "issued") && row.issue_data) {
    parts.push({ title: "Издаване", data: { service_kind: row.service_kind, ...row.issue_data } });
  }
  return parts;
}
