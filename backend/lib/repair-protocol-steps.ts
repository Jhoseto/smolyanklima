import { formatAdminDateOnly } from "./admin/formatEuro";
import { hydrateRepairProtocolClientFields } from "./admin/matchRepairProtocolProduct";
import { BEARINGS_LABEL, FREON_CHARGE_LABEL, NOISE_LABEL, SERVICE_KIND_LABEL } from "./repair-protocol-fields";

type Field = {
  key: string;
  label: string;
  unit?: string;
  labels?: Record<string, string>;
};

export const REPAIR_PROTOCOL_STEPS: ReadonlyArray<{ title: string; fields: Field[] }> = [
  { title: "Тип, климатик и дата", fields: [
    { key: "service_kind", label: "Тип сервиз", labels: SERVICE_KIND_LABEL },
    { key: "date", label: "Дата" },
    { key: "client_name", label: "Клиент" }, { key: "client_phone", label: "Телефон" },
    { key: "client_email", label: "Имейл" }, { key: "address", label: "Адрес" },
    { key: "ac_brand", label: "Марка" }, { key: "ac_model", label: "Модел" },
    { key: "product_id", label: "Бройка от каталога" },
    { key: "indoor_unit_serial", label: "Сериен № вътрешно тяло" },
    { key: "outdoor_unit_serial", label: "Сериен № външно тяло" },
  ] },
  { title: "Фреон и почистване", fields: [
    { key: "is_japanese_brand", label: "Японски климатик" },
    { key: "freon_charge_method", label: "Фреон / зареждане", labels: FREON_CHARGE_LABEL },
    { key: "refrigerant_type", label: "Хладилен агент" },
    { key: "refrigerant_amount_g", label: "Количество", unit: "г" },
    { key: "vacuum_cleaning_done", label: "Почистване с прахосмукачка" },
  ] },
  { title: "Клапи, лагери и дистанционно", fields: [
    { key: "valves_ok", label: "Клапи в ред" },
    { key: "outdoor_bearings_state", label: "Лагери на външно тяло", labels: BEARINGS_LABEL },
    { key: "indoor_bearings_state", label: "Лагери на вътрешно тяло", labels: BEARINGS_LABEL },
    { key: "original_remote", label: "Оригинално дистанционно" },
  ] },
  { title: "Налягания и консумация", fields: [
    { key: "pressure_cold_bar", label: "Налягане при охлаждане", unit: "bar" },
    { key: "pressure_hot_bar", label: "Налягане при отопление", unit: "bar" },
    { key: "consumption_cold_kw", label: "Консумация при охлаждане", unit: "kW" },
    { key: "consumption_hot_kw", label: "Консумация при отопление", unit: "kW" },
  ] },
  { title: "Шум и заварки", fields: [
    { key: "outdoor_noise_level", label: "Шум на външното тяло", labels: NOISE_LABEL },
    { key: "welds_indoor_heat_exchanger", label: "Заварки на вътрешния топлообменник" },
    { key: "welds_outdoor_heat_exchanger", label: "Заварки на външния топлообменник" },
    { key: "welds_pipes", label: "Заварки на тръбите" },
  ] },
  { title: "Ремонти и оценка", fields: [
    { key: "indoor_mechanism_repaired", label: "Ремонт на механиката на вътрешното тяло" },
    { key: "broken_turbine", label: "Счупена турбина" },
    { key: "service_rating", label: "Сервизна оценка" },
  ] },
  { title: "Забележки и подпис", fields: [{ key: "notes", label: "Забележки" }] },
];

export function repairProtocolStepRows(data: Record<string, unknown>, step: number) {
  if (step === 0) {
    data = { ...data, ...hydrateRepairProtocolClientFields(data), service_kind: data.service_kind ?? "client" };
  }
  return REPAIR_PROTOCOL_STEPS[step].fields
    .filter(({ key }) => key !== "product_id" || data.product_id)
    .filter(({ key }) => data.service_kind !== "recycle" || !["client_name", "client_phone", "client_email", "address"].includes(key))
    .map(({ key, label, unit, labels }) => {
      const raw = data[key];
      let value = "—";
      if (typeof raw === "boolean") value = raw ? "Да" : "Не";
      else if (raw != null && String(raw).trim()) {
        if (key === "date") value = formatAdminDateOnly(String(raw));
        else if (key === "product_id") value = String(raw).slice(-8);
        else if (key === "service_rating") value = `${raw} / 5`;
        else if (unit) value = `${raw} ${unit}`;
        else value = labels?.[String(raw)] ?? String(raw);
      }
      return { label, value };
    });
}
