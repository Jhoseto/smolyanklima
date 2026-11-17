import { z } from "zod";
import type { RepairProtocolStatus, RepairWorkflowStage } from "@/lib/repair-protocol-fields";
import { combineLegacySerialField } from "@/lib/protocol-contact-fields";
import type { AdminRole } from "./db";
import { canEditSignedRepairProtocol } from "./repairProtocolAccess";
import { hydrateRepairProtocolClientFields } from "./matchRepairProtocolProduct";
import { adminLocalDateKey } from "./localDateKey";

function optionalText(limit: number) {
  return z.string().trim().max(limit).transform(value => value || null).nullable().optional();
}

const FormSchema = z.object({
  work_item_id:     z.string().uuid().nullable().optional(),
  date:             z.iso.date().optional(),
  service_kind:     z.enum(["client", "recycle"]).optional(),

  client_name:      optionalText(200),
  ac_brand:         z.string().max(120).optional().nullable(),
  ac_model:         z.string().max(200).optional().nullable(),
  serial_number:    optionalText(203),
  address:          optionalText(500),
  paid_amount:      z.number().nonnegative().optional().nullable(),
  client_email:     optionalText(200),
  client_phone:     optionalText(30),

  product_id:            z.string().uuid().optional().nullable(),
  indoor_unit_serial:    optionalText(100),
  outdoor_unit_serial:   optionalText(100),

  is_japanese_brand:   z.boolean().optional().nullable(),
  freon_charge_method: z.enum(["none", "scale", "standard"]).optional().nullable(),
  refrigerant_type:     optionalText(40),
  refrigerant_amount_g: z.number().nonnegative().optional().nullable(),

  vacuum_cleaning_done:   z.boolean().optional().nullable(),
  valves_ok:              z.boolean().optional().nullable(),
  outdoor_bearings_state: z.enum(["ok", "noisy", "lubricated", "replaced"]).optional().nullable(),
  indoor_bearings_state:  z.enum(["ok", "noisy", "lubricated", "replaced"]).optional().nullable(),

  pressure_cold_bar:  z.number().optional().nullable(),
  pressure_hot_bar:   z.number().optional().nullable(),
  consumption_cold_kw: z.number().optional().nullable(),
  consumption_hot_kw:  z.number().optional().nullable(),

  original_remote:     z.boolean().optional().nullable(),
  outdoor_noise_level: z.enum(["quiet", "normal", "elevated", "loud", "very_loud"]).optional().nullable(),

  welds_indoor_heat_exchanger:  z.boolean().optional().nullable(),
  welds_outdoor_heat_exchanger: z.boolean().optional().nullable(),
  welds_pipes:                  z.boolean().optional().nullable(),
  indoor_mechanism_repaired:    z.boolean().optional().nullable(),
  broken_turbine:               z.boolean().optional().nullable(),

  service_rating: z.number().int().min(1).max(5).optional().nullable(),

  notes:            z.string().max(2000).optional().nullable(),
  signature_team:   z.string().optional().nullable(),
  status:           z.enum(["prepared", "in_progress", "signed"]).optional(),
});

/**
 * Списък с технически полета, които при наличие на стойност (вкл. false)
 * показват че екипът реално работи на място → преход prepared → in_progress.
 */
const TECHNICAL_FIELDS = [
  "freon_charge_method", "refrigerant_type", "refrigerant_amount_g", "vacuum_cleaning_done", "valves_ok",
  "outdoor_bearings_state", "indoor_bearings_state",
  "pressure_cold_bar", "pressure_hot_bar",
  "consumption_cold_kw", "consumption_hot_kw",
  "original_remote", "outdoor_noise_level",
  "welds_indoor_heat_exchanger", "welds_outdoor_heat_exchanger", "welds_pipes",
  "indoor_mechanism_repaired", "broken_turbine",
  "service_rating",
] as const;

export const RepairWriteSchema = FormSchema.extend({
  phase: z.enum(["intake", "issue"]).optional().default("intake"),
  complete: z.boolean().optional(),
  expected_updated_at: z.iso.datetime({ offset: true }).optional(),
  creation_id: z.string().uuid().optional(),
});

export type RepairForm = z.infer<typeof FormSchema>;
export type RepairWrite = z.infer<typeof RepairWriteSchema>;
export type StoredRepair = RepairForm & {
  id: string;
  created_by: string | null;
  updated_at: string;
  workflow_stage: RepairWorkflowStage;
  status: RepairProtocolStatus;
  issue_data: RepairForm | null;
};

type WriteResult =
  | { ok: true; patch: RepairForm & { workflow_stage: RepairWorkflowStage; issue_data?: RepairForm }; syncProduct: boolean }
  | { ok: false; status: 400 | 403 | 409; error: string };

const unitFields = [
  "work_item_id", "service_kind", "product_id", "ac_brand", "ac_model",
  "serial_number", "indoor_unit_serial", "outdoor_unit_serial",
] as const;

function normalizeIntake(form: RepairForm, previous?: RepairForm): RepairForm {
  const kind = form.service_kind ?? previous?.service_kind ?? "client";
  const result = { ...form };
  if (!previous) {
    result.date ??= adminLocalDateKey();
    result.service_kind = kind;
  }
  if (kind === "recycle") {
    result.client_name = result.client_phone = result.address = result.client_email = result.serial_number = null;
  } else if (form.indoor_unit_serial !== undefined || form.outdoor_unit_serial !== undefined) {
    const indoor = form.indoor_unit_serial === undefined ? previous?.indoor_unit_serial : form.indoor_unit_serial;
    const outdoor = form.outdoor_unit_serial === undefined ? previous?.outdoor_unit_serial : form.outdoor_unit_serial;
    result.serial_number = combineLegacySerialField(indoor, outdoor) ?? (form.serial_number?.trim() || null);
  }
  return result;
}

function statusAfterSave(form: RepairForm, complete: boolean | undefined, requested?: RepairProtocolStatus): RepairProtocolStatus {
  if (complete === true) return "signed";
  if (complete === undefined) {
    if (requested) return requested;
    if (form.signature_team?.trim() || form.status === "signed") return "signed";
  }
  return form.status === "in_progress" || !!form.signature_team?.trim() || TECHNICAL_FIELDS.some(key => form[key] != null)
    ? "in_progress" : "prepared";
}

export function repairProtocolWrite(current: StoredRepair | null, input: RepairWrite, role: AdminRole): WriteResult {
  const { phase, complete, expected_updated_at, creation_id: _creationId, ...form } = input;
  if (current && expected_updated_at && current.updated_at !== expected_updated_at) {
    return { ok: false, status: 409, error: "Протоколът е променен. Отворете го отново, за да видите последния запис." };
  }
  const missingSignature = { ok: false, status: 400, error: "За завършване е нужен подпис на сервизния техник." } as const;

  if (phase === "issue") {
    if (!current || current.workflow_stage === "intake") {
      return { ok: false, status: 409, error: "Първо завършете завеждането на климатика." };
    }
    if (current.workflow_stage === "issued") {
      if (!canEditSignedRepairProtocol(role)) {
        return { ok: false, status: 403, error: "Издаденият протокол е само за преглед." };
      }
      if (complete !== true || !expected_updated_at) {
        return { ok: false, status: 409, error: "Корекцията на издаден протокол изисква потвърждаване на актуалната версия." };
      }
    }
    const hydrated = hydrateRepairProtocolClientFields(current);
    const unit = {
      ...current, ...hydrated,
      serial_number: current.service_kind === "recycle" ? null :
        combineLegacySerialField(hydrated.indoor_unit_serial, hydrated.outdoor_unit_serial) ?? current.serial_number,
    };
    for (const key of unitFields) {
      const incoming = form[key]?.trim() || null;
      if (form[key] !== undefined && incoming !== (current[key]?.trim() || null) && incoming !== (unit[key]?.trim() || null)) {
        return { ok: false, status: 400, error: "Издаването трябва да бъде за същия климатик и вид сервиз като завеждането." };
      }
    }
    const issue: RepairForm = {
      date: adminLocalDateKey(),
      client_name: current.client_name, address: current.address,
      client_email: current.client_email, client_phone: current.client_phone,
      is_japanese_brand: current.is_japanese_brand,
      ...current.issue_data, ...form,
    };
    for (const key of unitFields) Object.assign(issue, { [key]: unit[key] || null });
    if (current.service_kind === "recycle") {
      issue.client_name = issue.address = issue.client_email = issue.client_phone = null;
    }
    issue.status = statusAfterSave(issue, complete, form.status);
    if (issue.status === "signed" && !issue.signature_team?.trim()) return missingSignature;
    if (current.date && issue.date && issue.date < current.date) {
      return { ok: false, status: 400, error: "Датата на издаване предхожда датата на завеждане." };
    }
    return { ok: true, patch: {
      issue_data: issue, workflow_stage: issue.status === "signed" ? "issued" : "issuing",
    }, syncProduct: false };
  }

  if (current && ["received", "issuing", "issued"].includes(current.workflow_stage)) {
    return { ok: false, status: 409, error: "Завеждането вече е завършено. Данните му се пазят за сравнение при издаването." };
  }
  if (current?.workflow_stage === "legacy_signed" && !canEditSignedRepairProtocol(role)) {
    return { ok: false, status: 403, error: "Подписаният протокол е само за преглед." };
  }
  if (current?.workflow_stage === "legacy_signed" && complete === false) {
    return { ok: false, status: 409, error: "Потвърдете корекцията на подписания протокол." };
  }
  const patch = normalizeIntake(form, current ?? undefined);
  const merged = { ...current, ...patch };
  const status = statusAfterSave(merged, complete, form.status);
  if (current?.workflow_stage === "legacy_signed" && status !== "signed" && role !== "master_admin") {
    return { ok: false, status: 400, error: "Подписан протокол не може да се върне назад." };
  }
  if (status === "signed" && !merged.signature_team?.trim()) return missingSignature;
  const workflow_stage = status !== "signed" ? "intake" : current?.workflow_stage === "legacy_signed" ? "legacy_signed" : "received";
  return { ok: true, patch: { ...patch, status, workflow_stage }, syncProduct: merged.service_kind === "recycle" };
}
