import type { SupabaseClient } from "@supabase/supabase-js";
import type { getEnv } from "@/lib/env";
import { logAdminActivity } from "@/lib/admin/audit";
import { DOMAIN_SCHEMA_CATALOG } from "@/lib/ai/agent/domainSchema";
import {
  countSupplierWebCallsToday,
  isPrivateOrLocalHost,
  workItemAdminHref,
} from "@/lib/ai/agent/agentLimits";
import {
  findSupplierByContactId,
  isUrlAllowedForSupplier,
  loadSupplierRegistry,
  type SupplierRegistryEntry,
} from "@/lib/ai/agent/supplierRegistry";
import { truncateToolResult } from "@/lib/ai/agent/truncateToolResult";
import {
  searchAdminContactIds,
  searchAdminInquiryIds,
  searchAdminProductIds,
} from "@/lib/ai/agent/agentSearch";
import { sanitizeIlikeTerm } from "@/lib/security/sanitizeSearchTerm";
import { loadCatalogSyncRow } from "@/lib/ai/agent/agentTitle";
import { describeActivityLog, formatActivityAction, formatActivityEntityType, formatActivityUser, humanizeAdminDisplayText } from "@/lib/admin/activityLogLabels";

export type ToolContext = {
  db: SupabaseClient;
  env: ReturnType<typeof getEnv>;
  suppliers: SupplierRegistryEntry[];
  supplierWebCallsThisTurn: { count: number };
  adminUserId: string;
  /** Per-turn cache — avoids serverless module-level singleton stale data. */
  dashboardCache?: { at: number; payload: Record<string, unknown> };
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
}

const DASHBOARD_CACHE_MS = 60_000;

const MAX_HISTORY_MONTHS = 24;

function floorHistoryDate(iso?: string): string {
  const d = new Date();
  d.setMonth(d.getMonth() - MAX_HISTORY_MONTHS);
  const floor = d.toISOString().slice(0, 10);
  if (!iso?.trim()) return floor;
  const from = iso.trim().slice(0, 10);
  return from < floor ? floor : from;
}

function countByField(rows: Record<string, unknown>[], field: string): Array<{ label: string; count: number }> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = humanizeAdminDisplayText(String(row[field] ?? "—"));
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function formatWhenBg(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("bg-BG", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

function activityRangeIso(from?: string, to?: string): { from: string; to: string } {
  const now = new Date();
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 7);
  const fromDate = from?.trim().slice(0, 10) ?? defaultFrom.toISOString().slice(0, 10);
  const toDate = to?.trim().slice(0, 10) ?? now.toISOString().slice(0, 10);
  return {
    from: `${floorHistoryDate(fromDate)}T00:00:00.000Z`,
    to: `${toDate}T23:59:59.999Z`,
  };
}

export const AGENT_FUNCTION_DECLARATIONS = [
  { name: "describe_schema", description: "Column detail for one database table", parameters: { type: "OBJECT", properties: { table: { type: "STRING" } }, required: ["table"] } },
  { name: "get_dashboard_summary", description: "KPI counts: products, new inquiries, work today/overdue, outbox", parameters: { type: "OBJECT", properties: {} } },
  { name: "query_products", description: "List products with filters", parameters: { type: "OBJECT", properties: { q: { type: "STRING" }, stockStatus: { type: "STRING" }, brandName: { type: "STRING" }, limit: { type: "INTEGER" } } } },
  { name: "query_work_items", description: "Work items / sales / service / calendar", parameters: { type: "OBJECT", properties: { eventCode: { type: "STRING" }, status: { type: "STRING" }, from: { type: "STRING" }, to: { type: "STRING" }, q: { type: "STRING" }, limit: { type: "INTEGER" } } } },
  { name: "query_inquiries", description: "Customer inquiries with period summary for analysis", parameters: { type: "OBJECT", properties: { status: { type: "STRING" }, from: { type: "STRING" }, to: { type: "STRING" }, q: { type: "STRING" }, limit: { type: "INTEGER" } } } },
  { name: "query_contacts", description: "CRM contacts", parameters: { type: "OBJECT", properties: { kind: { type: "STRING" }, q: { type: "STRING" }, limit: { type: "INTEGER" } } } },
  { name: "aggregate_sales", description: "Sales aggregates by month", parameters: { type: "OBJECT", properties: { from: { type: "STRING" }, to: { type: "STRING" } } } },
  { name: "aggregate_inventory", description: "Inventory counts by stock_status and brand", parameters: { type: "OBJECT", properties: {} } },
  { name: "query_activity_logs", description: "Admin activity with Bulgarian labels; use aggregate=true for weekly charts", parameters: { type: "OBJECT", properties: { from: { type: "STRING" }, to: { type: "STRING" }, limit: { type: "INTEGER" }, aggregate: { type: "BOOLEAN" } } } },
  { name: "query_ratings_summary", description: "Product ratings aggregates and top-rated products", parameters: { type: "OBJECT", properties: { productId: { type: "STRING" }, minReviews: { type: "INTEGER" }, limit: { type: "INTEGER" } } } },
  { name: "query_suppliers", description: "All suppliers from CRM with websites and counts", parameters: { type: "OBJECT", properties: {} } },
  { name: "query_supplier_products", description: "Products for a supplier contact id", parameters: { type: "OBJECT", properties: { supplierContactId: { type: "STRING" }, q: { type: "STRING" }, limit: { type: "INTEGER" } }, required: ["supplierContactId"] } },
  { name: "query_supplier_orders", description: "Supplier orders work_items", parameters: { type: "OBJECT", properties: { supplierContactId: { type: "STRING" }, status: { type: "STRING" }, limit: { type: "INTEGER" } } } },
  { name: "get_supplier_sync_status", description: "Last catalog sync status from settings", parameters: { type: "OBJECT", properties: { catalogSlug: { type: "STRING" } } } },
  { name: "lookup_product_at_supplier", description: "Find product source_url by brand/model query", parameters: { type: "OBJECT", properties: { q: { type: "STRING" }, supplierContactId: { type: "STRING" } }, required: ["q"] } },
  { name: "fetch_supplier_page", description: "Fetch whitelisted supplier webpage text", parameters: { type: "OBJECT", properties: { supplierContactId: { type: "STRING" }, url: { type: "STRING" } }, required: ["supplierContactId", "url"] } },
  { name: "research_supplier_online", description: "Google search scoped to supplier site", parameters: { type: "OBJECT", properties: { supplierContactId: { type: "STRING" }, query: { type: "STRING" } }, required: ["supplierContactId", "query"] } },
  { name: "query_accessories", description: "Accessories and spare parts catalog", parameters: { type: "OBJECT", properties: { q: { type: "STRING" }, kind: { type: "STRING" }, activeOnly: { type: "BOOLEAN" }, limit: { type: "INTEGER" } } } },
  { name: "query_articles", description: "Blog articles", parameters: { type: "OBJECT", properties: { q: { type: "STRING" }, publishedOnly: { type: "BOOLEAN" }, limit: { type: "INTEGER" } } } },
  { name: "query_live_chats", description: "Live chat sessions with message counts", parameters: { type: "OBJECT", properties: { status: { type: "STRING" }, limit: { type: "INTEGER" } } } },
  { name: "query_service_protocols", description: "Acceptance and repair service protocols", parameters: { type: "OBJECT", properties: { type: { type: "STRING" }, status: { type: "STRING" }, limit: { type: "INTEGER" } } } },
  { name: "query_email_outbox", description: "Outgoing email queue", parameters: { type: "OBJECT", properties: { status: { type: "STRING" }, limit: { type: "INTEGER" } } } },
  { name: "query_staff", description: "Admin users (no secrets)", parameters: { type: "OBJECT", properties: { role: { type: "STRING" }, activeOnly: { type: "BOOLEAN" } } } },
  { name: "query_settings", description: "System settings and catalog sync metadata", parameters: { type: "OBJECT", properties: {} } },
  { name: "query_newsletter", description: "Newsletter subscribers stats and recent list", parameters: { type: "OBJECT", properties: { status: { type: "STRING" }, limit: { type: "INTEGER" } } } },
];

const GATED_SUPPLIER_RESEARCH = "research_supplier_online";

export function getAgentFunctionDeclarations(env: ReturnType<typeof getEnv>) {
  if (env.AI_AGENT_ALLOW_SUPPLIER_RESEARCH) return AGENT_FUNCTION_DECLARATIONS;
  return AGENT_FUNCTION_DECLARATIONS.filter((d) => d.name !== GATED_SUPPLIER_RESEARCH);
}

export async function executeAgentTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<Record<string, unknown>> {
  const limit = Math.min(Number(args.limit ?? 30) || 30, 200);
  const today = todayKey();

  switch (name) {
    case "describe_schema": {
      const table = String(args.table ?? "");
      const entry = (DOMAIN_SCHEMA_CATALOG.tables as Record<string, unknown>)[table];
      return truncateToolResult({ table, schema: entry ?? null });
    }

    case "get_dashboard_summary": {
      if (ctx.dashboardCache && Date.now() - ctx.dashboardCache.at < DASHBOARD_CACHE_MS) {
        return truncateToolResult(ctx.dashboardCache.payload);
      }
      const [products, inquiriesNew, workToday, workOverdue, outboxPending, outboxFailed] = await Promise.all([
        ctx.db.from("products").select("id", { count: "exact", head: true }),
        ctx.db.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
        ctx.db.from("work_items").select("id", { count: "exact", head: true }).eq("due_date", today).in("status", ["planned", "in_progress"]).neq("event_code", "supplier_order"),
        ctx.db.from("work_items").select("id", { count: "exact", head: true }).lt("due_date", today).in("status", ["planned", "in_progress"]).neq("event_code", "supplier_order"),
        ctx.db.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "pending"),
        ctx.db.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "failed"),
      ]);
      const payload = {
        date: today,
        products: products.count ?? 0,
        inquiriesNew: inquiriesNew.count ?? 0,
        workToday: workToday.count ?? 0,
        workOverdue: workOverdue.count ?? 0,
        outboxPending: outboxPending.count ?? 0,
        outboxFailed: outboxFailed.count ?? 0,
      };
      ctx.dashboardCache = { at: Date.now(), payload };
      return truncateToolResult(payload);
    }

    case "query_products": {
      const term = sanitizeIlikeTerm(String(args.q ?? ""));
      let rows: Record<string, unknown>[] = [];

      if (term) {
        const ids = await searchAdminProductIds(ctx.db, term, limit);
        if (ids.length > 0) {
          const { data, error } = await ctx.db
            .from("products")
            .select("id,name,slug,price,stock_status,stock_location,indoor_unit_serial,outdoor_unit_serial,source_url,brands:brand_id(name)")
            .in("id", ids)
            .limit(limit);
          if (error) return { error: error.message };
          rows = data ?? [];
        } else {
          const { data, error } = await ctx.db
            .from("products")
            .select("id,name,slug,price,stock_status,stock_location,indoor_unit_serial,outdoor_unit_serial,source_url,brands:brand_id(name)")
            .or(
              `name.ilike.%${term}%,model_code.ilike.%${term}%,indoor_unit_serial.ilike.%${term}%,outdoor_unit_serial.ilike.%${term}%`,
            )
            .order("updated_at", { ascending: false })
            .limit(limit);
          if (error) return { error: error.message };
          rows = data ?? [];
        }
      } else {
        const { data, error } = await ctx.db
          .from("products")
          .select("id,name,slug,price,stock_status,stock_location,indoor_unit_serial,outdoor_unit_serial,source_url,brands:brand_id(name)")
          .order("updated_at", { ascending: false })
          .limit(limit);
        if (error) return { error: error.message };
        rows = data ?? [];
      }

      if (args.stockStatus) {
        rows = rows.filter((r) => r.stock_status === String(args.stockStatus));
      }
      const brandName = String(args.brandName ?? "").trim();
      if (brandName) {
        rows = rows.filter((r) => {
          const b = r.brands as { name?: string } | null;
          return b?.name?.toLowerCase().includes(brandName.toLowerCase());
        });
      }
      return truncateToolResult({
        data: rows.map((r) => ({
          id: r.id,
          name: r.name,
          brand: (r.brands as { name?: string } | null)?.name ?? null,
          price: r.price,
          stock_status: r.stock_status,
          indoor_serial: r.indoor_unit_serial,
          outdoor_serial: r.outdoor_unit_serial,
          source_url: r.source_url,
          admin_href: `/admin/products/${r.id}`,
        })),
      });
    }

    case "query_work_items": {
      let q = ctx.db
        .from("work_items")
        .select("id,title,event_code,status,due_date,customer_name,total_amount,sale_install_state,created_at")
        .order("due_date", { ascending: true })
        .limit(limit);
      if (args.eventCode) q = q.eq("event_code", String(args.eventCode));
      if (args.status) q = q.eq("status", String(args.status));
      if (args.from) q = q.gte("due_date", String(args.from).slice(0, 10));
      if (args.to) q = q.lte("due_date", String(args.to).slice(0, 10));
      const term = String(args.q ?? "").trim();
      if (term) q = q.or(`title.ilike.%${term}%,customer_name.ilike.%${term}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      const rows = (data ?? []) as Record<string, unknown>[];
      const byEvent = countByField(rows, "event_code");
      const byStatus = countByField(rows, "status");
      return truncateToolResult({
        period: args.from || args.to ? { from: args.from, to: args.to } : undefined,
        summary: {
          total: rows.length,
          byEvent,
          byStatus,
          salesCount: rows.filter((r) => r.event_code === "sale").length,
          installsCount: rows.filter((r) => r.event_code === "service_installation").length,
        },
        chartSuggestion: byEvent.length
          ? {
              chartType: "bar",
              title: "Работа по тип",
              labels: byEvent.slice(0, 8).map((x) => x.label),
              values: byEvent.slice(0, 8).map((x) => x.count),
            }
          : undefined,
        sample: rows.slice(0, 8).map((r) => ({
          ...r,
          admin_href: workItemAdminHref(r as Parameters<typeof workItemAdminHref>[0]),
        })),
        note: "Използвай summary/chartSuggestion за KPI и графика — не изброявай всички редове.",
      });
    }

    case "query_inquiries": {
      const term = sanitizeIlikeTerm(String(args.q ?? ""));
      let q = ctx.db
        .from("inquiries")
        .select("id,customer_name,customer_phone,status,service_type,created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (args.status) q = q.eq("status", String(args.status));
      if (args.from) q = q.gte("created_at", `${String(args.from).slice(0, 10)}T00:00:00.000Z`);
      if (args.to) q = q.lte("created_at", `${String(args.to).slice(0, 10)}T23:59:59.999Z`);
      if (term) {
        const ids = await searchAdminInquiryIds(ctx.db, term, limit);
        if (ids.length > 0) q = q.in("id", ids);
        else q = q.or(`customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%,message.ilike.%${term}%`);
      }
      const { data, error } = await q;
      if (error) return { error: error.message };
      const rows = (data ?? []) as Record<string, unknown>[];
      const byStatus = countByField(rows, "status");
      const byService = countByField(rows, "service_type");
      return truncateToolResult({
        period: args.from || args.to ? { from: args.from, to: args.to } : undefined,
        summary: {
          total: rows.length,
          byStatus,
          byService,
          done: rows.filter((r) => r.status === "done").length,
          newCount: rows.filter((r) => r.status === "new").length,
        },
        chartSuggestion: byStatus.length
          ? {
              chartType: "bar",
              title: "Запитвания по статус",
              labels: byStatus.map((x) => x.label),
              values: byStatus.map((x) => x.count),
            }
          : undefined,
        sample: rows.slice(0, 8).map((r) => ({ ...r, admin_href: `/admin/inquiries/${r.id}` })),
        note: "Използвай summary/chartSuggestion за анализ — не dump на всички запитвания.",
      });
    }

    case "query_contacts": {
      const term = sanitizeIlikeTerm(String(args.q ?? ""));
      let q = ctx.db
        .from("contacts")
        .select("id,full_name,phone,email,contact_kind,customer_status,notes")
        .order("full_name")
        .limit(limit);
      if (args.kind) q = q.eq("contact_kind", String(args.kind));
      if (term) {
        const ids = await searchAdminContactIds(ctx.db, term, limit);
        if (ids.length > 0) q = q.in("id", ids);
        else q = q.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
      }
      const { data, error } = await q;
      if (error) return { error: error.message };
      return truncateToolResult({ data: data ?? [] });
    }

    case "aggregate_sales": {
      const from = floorHistoryDate(args.from ? String(args.from) : undefined);
      let q = ctx.db
        .from("work_items")
        .select("due_date,created_at,total_amount")
        .eq("event_code", "sale")
        .neq("status", "cancelled")
        .gte("created_at", `${from}T00:00:00.000Z`);
      if (args.to) q = q.lte("created_at", String(args.to));
      const { data, error } = await q.limit(500);
      if (error) return { error: error.message };
      const byMonth: Record<string, { count: number; total: number }> = {};
      for (const row of data ?? []) {
        const d = String(row.created_at ?? row.due_date ?? "").slice(0, 7);
        if (!d) continue;
        if (!byMonth[d]) byMonth[d] = { count: 0, total: 0 };
        byMonth[d].count += 1;
        byMonth[d].total += Number(row.total_amount ?? 0);
      }
      return truncateToolResult({ byMonth, totalSales: (data ?? []).length });
    }

    case "aggregate_inventory": {
      const { data, error } = await ctx.db.from("products").select("stock_status, brands:brand_id(name)").limit(1000);
      if (error) return { error: error.message };
      const byStatus: Record<string, number> = {};
      const byBrand: Record<string, number> = {};
      for (const row of data ?? []) {
        const st = String(row.stock_status ?? "unknown");
        byStatus[st] = (byStatus[st] ?? 0) + 1;
        const brand = (row.brands as { name?: string } | null)?.name ?? "—";
        byBrand[brand] = (byBrand[brand] ?? 0) + 1;
      }
      return truncateToolResult({ byStatus, byBrand, total: (data ?? []).length });
    }

    case "query_activity_logs": {
      const range = activityRangeIso(
        args.from ? String(args.from) : undefined,
        args.to ? String(args.to) : undefined,
      );
      const aggregate = args.aggregate === true || args.aggregate === "true";
      const lim = Math.min(Number(args.limit ?? (aggregate ? 500 : 40)) || 40, aggregate ? 500 : 50);

      const { data, error } = await ctx.db
        .from("activity_logs")
        .select("action,entity_type,created_at,details,user_id,admin_users:user_id(name,email)")
        .gte("created_at", range.from)
        .lte("created_at", range.to)
        .order("created_at", { ascending: false })
        .limit(lim);
      if (error) return { error: error.message };

      const rows = data ?? [];

      if (aggregate) {
        const byAction = new Map<string, { actionLabel: string; section: string; count: number }>();
        for (const row of rows) {
          const label = formatActivityAction(String(row.action ?? ""));
          const section = formatActivityEntityType(row.entity_type);
          const key = String(row.action ?? label);
          const prev = byAction.get(key);
          if (prev) prev.count += 1;
          else byAction.set(key, { actionLabel: label, section, count: 1 });
        }
        const summary = [...byAction.values()].sort((a, b) => b.count - a.count);
        return truncateToolResult({
          period: { from: range.from.slice(0, 10), to: range.to.slice(0, 10) },
          totalEvents: rows.length,
          byAction: summary,
          chartSuggestion: {
            chartType: "bar",
            title: "Активност в админ панела",
            labels: summary.map((s) => s.actionLabel),
            values: summary.map((s) => s.count),
          },
          note: "Aggregate data — използвай за pattern analysis, НЕ копирай като „Топ действия“ таблица без интерпретация.",
        });
      }

      const events = rows.map((row) => {
        const adminUser = row.admin_users as { name?: string | null; email?: string | null } | null;
        const described = describeActivityLog({
          action: String(row.action ?? ""),
          entity_type: row.entity_type,
          details: (row.details as Record<string, unknown> | null) ?? null,
        });
        return {
          when: row.created_at,
          whenDisplay: formatWhenBg(String(row.created_at ?? "")),
          adminName: formatActivityUser(adminUser).name,
          actionLabel: described.actionLabel,
          section: described.entityLabel,
          summary: described.detailsText.split("\n")[0] || described.actionLabel,
        };
      });

      return truncateToolResult({
        period: { from: range.from.slice(0, 10), to: range.to.slice(0, 10) },
        totalEvents: events.length,
        events,
        note: "Копирай adminName, whenDisplay, actionLabel от events. Забранено е да измисляш имена или дати.",
      });
    }

    case "query_ratings_summary": {
      const productId = args.productId ? String(args.productId) : null;
      const minReviews = Math.max(Number(args.minReviews ?? 1) || 1, 0);
      const topLimit = Math.min(Number(args.limit ?? 20) || 20, 50);

      if (productId) {
        const [{ data: product, error: prodErr }, { data: stars, error: starsErr }, { count: totalVotes }] =
          await Promise.all([
            ctx.db.from("products").select("id,name,slug,rating,reviews_count").eq("id", productId).maybeSingle(),
            ctx.db.from("product_ratings").select("stars").eq("product_id", productId).limit(500),
            ctx.db.from("product_ratings").select("id", { count: "exact", head: true }).eq("product_id", productId),
          ]);
        if (prodErr) return { error: prodErr.message };
        if (starsErr) return { error: starsErr.message };
        const breakdown: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
        for (const row of stars ?? []) {
          const k = String((row as { stars: number }).stars);
          if (breakdown[k] !== undefined) breakdown[k] += 1;
        }
        return truncateToolResult({
          product: product
            ? { ...product, admin_href: `/admin/products/${product.id}`, admin_ratings_href: "/admin/ratings" }
            : null,
          starBreakdown: breakdown,
          totalVotes: totalVotes ?? 0,
        });
      }

      const [{ data: topProducts, error: topErr }, { count: totalRatings }, { count: productsWithReviews }] =
        await Promise.all([
          ctx.db
            .from("products")
            .select("id,name,slug,rating,reviews_count,brands:brand_id(name)")
            .gte("reviews_count", minReviews)
            .order("reviews_count", { ascending: false })
            .limit(topLimit),
          ctx.db.from("product_ratings").select("id", { count: "exact", head: true }),
          ctx.db.from("products").select("id", { count: "exact", head: true }).gt("reviews_count", 0),
        ]);
      if (topErr) return { error: topErr.message };
      return truncateToolResult({
        totalRatings: totalRatings ?? 0,
        productsWithReviews: productsWithReviews ?? 0,
        topProducts: (topProducts ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          brand: (r.brands as { name?: string } | null)?.name ?? null,
          rating: r.rating,
          reviews_count: r.reviews_count,
          admin_href: `/admin/products/${r.id}`,
        })),
        admin_ratings_href: "/admin/ratings",
      });
    }

    case "query_suppliers": {
      const fresh = await loadSupplierRegistry(ctx.db, true);
      ctx.suppliers = fresh;
      const { data: settings } = await loadCatalogSyncRow(ctx.db);
      return truncateToolResult({
        suppliers: fresh.map((s) => ({
          contactId: s.contactId,
          name: s.displayName,
          websites: s.websiteUrls,
          hostnames: s.allowedHostnames,
          products: s.productCount,
          accessories: s.accessoryCount,
          catalogSlug: s.catalogSlug,
        })),
        sync: settings
          ? {
              bulclima: settings.bulclima_last_sync_at,
              climacom: settings.climacom_last_sync_at,
              condex: settings.condex_last_sync_at,
              bittel: settings.bittel_last_sync_at,
            }
          : null,
      });
    }

    case "query_supplier_products": {
      const sid = String(args.supplierContactId);
      let q = ctx.db
        .from("products")
        .select("id,name,price,stock_status,source_url,indoor_unit_serial,outdoor_unit_serial")
        .eq("supplier_id", sid)
        .order("name")
        .limit(limit);
      const term = String(args.q ?? "").trim();
      if (term) q = q.or(`name.ilike.%${term}%,model_code.ilike.%${term}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return truncateToolResult({
        data: (data ?? []).map((r) => ({ ...r, admin_href: `/admin/products/${r.id}` })),
      });
    }

    case "query_supplier_orders": {
      let q = ctx.db
        .from("work_items")
        .select("id,title,event_code,status,due_date,customer_name,contact_id,created_at")
        .eq("event_code", "supplier_order")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (args.status) q = q.eq("status", String(args.status));
      if (args.supplierContactId) q = q.eq("contact_id", String(args.supplierContactId));
      const { data, error } = await q;
      if (error) return { error: error.message };
      return truncateToolResult({
        data: (data ?? []).map((r) => ({
          ...r,
          admin_href: workItemAdminHref(r),
        })),
      });
    }

    case "get_supplier_sync_status": {
      const { data, error } = await ctx.db.from("product_catalog_settings").select("*").eq("id", 1).maybeSingle();
      if (error) return { error: error.message };
      const slug = String(args.catalogSlug ?? "").trim();
      if (slug === "bulclima") {
        return truncateToolResult({
          at: data?.bulclima_last_sync_at,
          status: data?.bulclima_last_sync_status,
          summary: data?.bulclima_last_sync_summary,
        });
      }
      if (slug === "climacom") {
        return truncateToolResult({
          at: data?.climacom_last_sync_at,
          status: data?.climacom_last_sync_status,
          summary: data?.climacom_last_sync_summary,
        });
      }
      if (slug === "condex") {
        return truncateToolResult({
          at: data?.condex_last_sync_at,
          status: data?.condex_last_sync_status,
          summary: data?.condex_last_sync_summary,
        });
      }
      if (slug === "bittel") {
        return truncateToolResult({
          at: data?.bittel_last_sync_at,
          status: data?.bittel_last_sync_status,
          summary: data?.bittel_last_sync_summary,
        });
      }
      return truncateToolResult({
        bulclima: { at: data?.bulclima_last_sync_at, status: data?.bulclima_last_sync_status },
        climacom: { at: data?.climacom_last_sync_at, status: data?.climacom_last_sync_status },
        condex: { at: data?.condex_last_sync_at, status: data?.condex_last_sync_status },
        bittel: { at: data?.bittel_last_sync_at, status: data?.bittel_last_sync_status },
      });
    }

    case "lookup_product_at_supplier": {
      let q = ctx.db
        .from("products")
        .select("id,name,source_url,price,supplier_id,brands:brand_id(name)")
        .not("source_url", "is", null)
        .limit(limit);
      const term = String(args.q ?? "").trim();
      if (term) q = q.or(`name.ilike.%${term}%,model_code.ilike.%${term}%`);
      if (args.supplierContactId) q = q.eq("supplier_id", String(args.supplierContactId));
      const { data, error } = await q;
      if (error) return { error: error.message };
      return truncateToolResult({
        data: (data ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          brand: (r.brands as { name?: string } | null)?.name,
          source_url: r.source_url,
          price: r.price,
        })),
      });
    }

    case "fetch_supplier_page": {
      const perTurnLimit = ctx.env.AI_AGENT_MAX_SUPPLIER_WEB_CALLS_PER_TURN ?? 5;
      const perDayLimit = ctx.env.AI_AGENT_MAX_SUPPLIER_WEB_CALLS_PER_DAY ?? 20;
      const fetchTimeoutMs = ctx.env.AI_AGENT_SUPPLIER_FETCH_TIMEOUT_MS ?? 30000;

      if (ctx.supplierWebCallsThisTurn.count >= perTurnLimit) {
        return { error: "Лимит на live web заявки за този turn." };
      }

      const usedToday = await countSupplierWebCallsToday(ctx.db, ctx.adminUserId);
      if (usedToday >= perDayLimit) {
        return { error: "Достигнат дневен лимит на supplier web заявки." };
      }

      ctx.supplierWebCallsThisTurn.count += 1;
      const entry = findSupplierByContactId(ctx.suppliers, String(args.supplierContactId));
      if (!entry) return { error: "Доставчикът не е намерен." };
      const url = String(args.url ?? "");
      if (!isUrlAllowedForSupplier(entry, url)) {
        return { error: "URL не е в whitelist за този доставчик." };
      }
      const host = new URL(url).hostname;
      if (isPrivateOrLocalHost(host)) {
        return { error: "Блокиран частен/локален URL." };
      }

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), fetchTimeoutMs);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { "User-Agent": "SmolyanKlimaAdminAgent/1.0" },
        });
        const html = await res.text();
        await logAdminActivity({
          action: "agent_supplier_web",
          entityType: "supplier",
          entityId: entry.contactId,
          details: { url, status: res.status },
        });
        return truncateToolResult({
          url,
          status: res.status,
          supplier: entry.displayName,
          text: stripHtml(html),
        });
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Fetch failed" };
      } finally {
        clearTimeout(t);
      }
    }

    case "research_supplier_online": {
      if (!ctx.env.AI_AGENT_ALLOW_SUPPLIER_RESEARCH) {
        return {
          error: "research_supplier_online е изключен. Ползвай query_suppliers, lookup_product_at_supplier или fetch_supplier_page.",
        };
      }
      const perTurnLimit = ctx.env.AI_AGENT_MAX_SUPPLIER_WEB_CALLS_PER_TURN ?? 5;
      const perDayLimit = ctx.env.AI_AGENT_MAX_SUPPLIER_WEB_CALLS_PER_DAY ?? 20;

      if (ctx.supplierWebCallsThisTurn.count >= perTurnLimit) {
        return { error: "Лимит на live web заявки за този turn." };
      }

      const usedToday = await countSupplierWebCallsToday(ctx.db, ctx.adminUserId);
      if (usedToday >= perDayLimit) {
        return { error: "Достигнат дневен лимит на supplier web заявки." };
      }

      ctx.supplierWebCallsThisTurn.count += 1;
      const entry = findSupplierByContactId(ctx.suppliers, String(args.supplierContactId));
      if (!entry || entry.allowedHostnames.length === 0) {
        return { error: "Доставчик без регистриран сайт в Контакти." };
      }
      const host = entry.allowedHostnames[0];
      const query = String(args.query ?? "");
      const model = ctx.env.GEMINI_AGENT_MODEL ?? ctx.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";
      const prompt = `Search site:${host.replace(/^www\./, "")} for: ${query}. Summarize findings in Bulgarian as JSON {"summary":"","sources":[]}`;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(ctx.env.GEMINI_API_KEY!)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { error: `Gemini search error ${res.status}` };
      const text =
        (body as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? "")
          .join("") ?? "";
      await logAdminActivity({
        action: "agent_supplier_web",
        entityType: "supplier",
        entityId: entry.contactId,
        details: { host, query },
      });
      return truncateToolResult({ supplier: entry.displayName, host, raw: text.slice(0, 4000) });
    }

    case "query_accessories": {
      let q = ctx.db
        .from("accessories")
        .select("id,name,slug,kind,price,stock_status,stock_quantity,is_active,supplier_id")
        .order("name")
        .limit(limit);
      if (args.activeOnly !== false) q = q.eq("is_active", true);
      if (args.kind) q = q.eq("kind", String(args.kind));
      const term = String(args.q ?? "").trim();
      if (term) q = q.or(`name.ilike.%${term}%,slug.ilike.%${term}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return truncateToolResult({
        data: (data ?? []).map((r) => ({ ...r, admin_href: `/admin/accessories/${r.id}` })),
      });
    }

    case "query_articles": {
      let q = ctx.db
        .from("articles")
        .select("id,title,slug,is_published,published_at,category_slug,updated_at")
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (args.publishedOnly !== false) q = q.eq("is_published", true);
      const term = String(args.q ?? "").trim();
      if (term) q = q.or(`title.ilike.%${term}%,slug.ilike.%${term}%`);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return truncateToolResult({
        data: (data ?? []).map((r) => ({ ...r, admin_href: `/admin/articles/${r.id}` })),
      });
    }

    case "query_live_chats": {
      let q = ctx.db
        .from("live_chats")
        .select("id,visitor_name,status,created_at,last_message_at,visitor_email")
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(limit);
      if (args.status) q = q.eq("status", String(args.status));
      const { data, error } = await q;
      if (error) return { error: error.message };
      const chats = data ?? [];
      const ids = chats.map((c) => c.id);
      const counts: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: msgs } = await ctx.db.from("live_chat_messages").select("chat_id").in("chat_id", ids);
        for (const m of msgs ?? []) {
          const id = m.chat_id as string;
          counts[id] = (counts[id] ?? 0) + 1;
        }
      }
      return truncateToolResult({
        data: chats.map((c) => ({
          ...c,
          message_count: counts[c.id] ?? 0,
          admin_href: "/admin/chat",
        })),
      });
    }

    case "query_service_protocols": {
      const typeFilter = String(args.type ?? "all");
      const status = args.status ? String(args.status) : null;
      const half = Math.ceil(limit / 2);
      const out: Array<Record<string, unknown>> = [];

      if (typeFilter === "all" || typeFilter === "acceptance") {
        let q = ctx.db
          .from("service_protocols")
          .select("id,customer_name,status,date,work_item_id,created_at")
          .order("date", { ascending: false })
          .limit(half);
        if (status) q = q.eq("status", status);
        const { data } = await q;
        for (const r of data ?? []) {
          out.push({ ...r, protocol_type: "acceptance", admin_href: "/admin/service/documents/acceptance" });
        }
      }

      if (typeFilter === "all" || typeFilter === "repair") {
        let q = ctx.db
          .from("service_repair_protocols")
          .select("id,customer_name,status,date,work_item_id,created_at")
          .order("date", { ascending: false })
          .limit(half);
        if (status) q = q.eq("status", status);
        const { data } = await q;
        for (const r of data ?? []) {
          out.push({ ...r, protocol_type: "repair", admin_href: "/admin/service/documents/service" });
        }
      }

      return truncateToolResult({ data: out.slice(0, limit) });
    }

    case "query_email_outbox": {
      let q = ctx.db
        .from("email_outbox")
        .select("id,kind,to_email,subject,status,attempts,last_error,created_at,sent_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (args.status) q = q.eq("status", String(args.status));
      const { data, error } = await q;
      if (error) return { error: error.message };
      return truncateToolResult({ data: data ?? [] });
    }

    case "query_staff": {
      let q = ctx.db
        .from("admin_users")
        .select("id,name,email,role,is_active,created_at")
        .order("name");
      if (args.role) q = q.eq("role", String(args.role));
      if (args.activeOnly !== false) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return truncateToolResult({
        data: (data ?? []).map((r) => ({ ...r, admin_href: "/admin/staff" })),
      });
    }

    case "query_settings": {
      const [{ data: kv, error: kvErr }, catalog] = await Promise.all([
        ctx.db.from("settings").select("key,value,description,updated_at").order("key"),
        loadCatalogSyncRow(ctx.db),
      ]);
      if (kvErr) return { error: kvErr.message };
      const safe = (kv ?? []).filter((row) => !/secret|password|api_key|token/i.test(String(row.key)));
      return truncateToolResult({
        settings: safe,
        catalogSync: catalog
          ? {
              bulclima: { at: catalog.bulclima_last_sync_at, status: catalog.bulclima_last_sync_status },
              climacom: { at: catalog.climacom_last_sync_at, status: catalog.climacom_last_sync_status },
              condex: { at: catalog.condex_last_sync_at, status: catalog.condex_last_sync_status },
              bittel: { at: catalog.bittel_last_sync_at, status: catalog.bittel_last_sync_status },
            }
          : null,
      });
    }

    case "query_newsletter": {
      const status = args.status ? String(args.status) : null;
      let q = ctx.db
        .from("newsletter_subscribers")
        .select("id,email,status,source,subscribed_at,confirmed_at")
        .order("subscribed_at", { ascending: false })
        .limit(limit);
      if (status) q = q.eq("status", status);
      const [totalRes, confirmedRes, listRes] = await Promise.all([
        ctx.db.from("newsletter_subscribers").select("id", { count: "exact", head: true }),
        ctx.db.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
        q,
      ]);
      if (listRes.error) return { error: listRes.error.message };
      return truncateToolResult({
        total: totalRes.count ?? 0,
        confirmed: confirmedRes.count ?? 0,
        data: (listRes.data ?? []).map((r) => ({ email: r.email, status: r.status, source: r.source, subscribed_at: r.subscribed_at })),
      });
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
