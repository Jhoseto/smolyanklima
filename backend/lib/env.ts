import { z } from "zod";

/** Празен string в .env → undefined, за да не чупи optional().min(1). */
function emptyToUndefined(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t === "" ? undefined : t;
}

const EnvSchemaBase = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  FRONTEND_ORIGIN: z.string().min(1),
  AI_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
  AI_MAX_DAILY_REQUESTS: z.coerce.number().int().min(1).optional(),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(1).max(8192).optional(),
  GEMINI_API_KEY: z.string().min(10).optional(),
  GEMINI_MODEL: z.string().min(1).optional(),
  /** Image generation/editing model — Nano Banana default. По избор може да се
   *  override-не (напр. на „gemini-3.1-flash-image-preview“ след оctomvri 2026,
   *  когато 2.5 Flash Image се pensionира). */
  GEMINI_IMAGE_MODEL: z.string().min(1).optional(),
  GEMINI_TEMPERATURE: z.coerce.number().min(0).max(1).optional(),
  GEMINI_AGENT_MODEL: z.string().min(1).optional(),
  GEMINI_AGENT_PRO_MODEL: z.string().min(1).optional(),
  GEMINI_AGENT_FALLBACK_MODEL: z.string().min(1).optional(),
  AI_AGENT_MAX_TOOL_ROUNDS: z.coerce.number().int().min(1).max(16).optional(),
  AI_AGENT_TURN_TIMEOUT_MS: z.coerce.number().int().min(10000).optional(),
  AI_AGENT_ESCALATION_THRESHOLD: z.coerce.number().int().min(1).optional(),
  AI_AGENT_DAILY_REQUESTS_PER_USER: z.coerce.number().int().min(1).optional(),
  AI_AGENT_MAX_MESSAGES_PER_CONVERSATION: z.coerce.number().int().min(1).optional(),
  AI_AGENT_MAX_SUPPLIER_WEB_CALLS_PER_TURN: z.coerce.number().int().min(1).optional(),
  AI_AGENT_MAX_SUPPLIER_WEB_CALLS_PER_DAY: z.coerce.number().int().min(1).optional(),
  AI_AGENT_SUPPLIER_FETCH_TIMEOUT_MS: z.coerce.number().int().min(5000).optional(),
  AI_AGENT_RETENTION_DAYS: z.coerce.number().int().min(7).optional(),
  /** Secret for Cloud Scheduler / cron hitting agent maintenance endpoints. */
  AI_AGENT_CRON_SECRET: z.string().min(16).optional(),
  AI_AGENT_THINKING_BUDGET: z.coerce.number().int().min(0).max(24576).optional(),
  AI_AGENT_THINKING_BUDGET_PRO: z.coerce.number().int().min(0).max(24576).optional(),
  AI_AGENT_CONTEXT_CACHE_TTL_S: z.coerce.number().int().min(300).max(86400).optional(),
  /** Max tools to prefetch via regex heuristics before optional Gemini tool loop. */
  AI_AGENT_PREFETCH_MAX: z.coerce.number().int().min(0).max(8).optional(),
  /** Extra Gemini tool rounds after prefetch (0 = synthesis only). */
  AI_AGENT_POST_PREFETCH_TOOL_ROUNDS: z.coerce.number().int().min(0).max(6).optional(),
  /** Nested Gemini+Google Search in research_supplier_online (default off). */
  AI_AGENT_ALLOW_SUPPLIER_RESEARCH: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  /** When regex prefetch is weak, Gemini Flash picks tools (default on). */
  AI_AGENT_GEMINI_TOOL_PLANNER: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
  /** Качване на снимки (админ). Препоръка: CLOUDINARY_URL от Cloudinary Console. */
  CLOUDINARY_URL: z.string().min(1).optional(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  NOTIFY_EMAIL_TO: z.string().email().optional(),
  NOTIFY_EMAIL_FROM: z.string().email().optional(),
  RESEND_API_KEY: z.string().min(10).optional(),
  /** Public backend URL for links in emails (e.g. newsletter confirm). */
  APP_URL: z.string().url().optional(),
  /** GitHub webhook HMAC secret for push events. */
  GITHUB_WEBHOOK_SECRET: z.string().min(16).optional(),
  /** GitHub PAT — optional for public repo (higher API rate limit + file stats). */
  GITHUB_TOKEN: z.string().min(10).optional(),
  /** GitHub repo as owner/name */
  GITHUB_REPO: z.string().regex(/^[^/]+\/[^/]+$/).optional(),
  /** Cheapest Gemini model for changelog summaries (falls back to GEMINI_MODEL). */
  GEMINI_CHANGELOG_MODEL: z.string().min(1).optional(),
});

const EnvSchema = EnvSchemaBase.superRefine((env, ctx) => {
  if (env.AI_ENABLED !== false && !env.GEMINI_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["GEMINI_API_KEY"],
      message: "GEMINI_API_KEY is required when AI is enabled.",
    });
  }
});

let cachedEnv: z.infer<typeof EnvSchema> | null = null;

export function getEnv() {
  if (cachedEnv) return cachedEnv;
  const parsed = EnvSchema.safeParse({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
    AI_ENABLED: process.env.AI_ENABLED,
    AI_MAX_DAILY_REQUESTS: process.env.AI_MAX_DAILY_REQUESTS,
    AI_MAX_OUTPUT_TOKENS: process.env.AI_MAX_OUTPUT_TOKENS,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GEMINI_IMAGE_MODEL: process.env.GEMINI_IMAGE_MODEL,
    GEMINI_TEMPERATURE: process.env.GEMINI_TEMPERATURE,
    GEMINI_AGENT_MODEL: process.env.GEMINI_AGENT_MODEL,
    GEMINI_AGENT_PRO_MODEL: process.env.GEMINI_AGENT_PRO_MODEL,
    GEMINI_AGENT_FALLBACK_MODEL: process.env.GEMINI_AGENT_FALLBACK_MODEL,
    AI_AGENT_MAX_TOOL_ROUNDS: process.env.AI_AGENT_MAX_TOOL_ROUNDS,
    AI_AGENT_TURN_TIMEOUT_MS: process.env.AI_AGENT_TURN_TIMEOUT_MS,
    AI_AGENT_ESCALATION_THRESHOLD: process.env.AI_AGENT_ESCALATION_THRESHOLD,
    AI_AGENT_DAILY_REQUESTS_PER_USER: process.env.AI_AGENT_DAILY_REQUESTS_PER_USER,
    AI_AGENT_MAX_MESSAGES_PER_CONVERSATION: process.env.AI_AGENT_MAX_MESSAGES_PER_CONVERSATION,
    AI_AGENT_MAX_SUPPLIER_WEB_CALLS_PER_TURN: process.env.AI_AGENT_MAX_SUPPLIER_WEB_CALLS_PER_TURN,
    AI_AGENT_MAX_SUPPLIER_WEB_CALLS_PER_DAY: process.env.AI_AGENT_MAX_SUPPLIER_WEB_CALLS_PER_DAY,
    AI_AGENT_SUPPLIER_FETCH_TIMEOUT_MS: process.env.AI_AGENT_SUPPLIER_FETCH_TIMEOUT_MS,
    AI_AGENT_RETENTION_DAYS: process.env.AI_AGENT_RETENTION_DAYS,
    AI_AGENT_CRON_SECRET: emptyToUndefined(process.env.AI_AGENT_CRON_SECRET),
    AI_AGENT_THINKING_BUDGET: process.env.AI_AGENT_THINKING_BUDGET,
    AI_AGENT_THINKING_BUDGET_PRO: process.env.AI_AGENT_THINKING_BUDGET_PRO,
    AI_AGENT_CONTEXT_CACHE_TTL_S: process.env.AI_AGENT_CONTEXT_CACHE_TTL_S,
    AI_AGENT_PREFETCH_MAX: process.env.AI_AGENT_PREFETCH_MAX,
    AI_AGENT_POST_PREFETCH_TOOL_ROUNDS: process.env.AI_AGENT_POST_PREFETCH_TOOL_ROUNDS,
    AI_AGENT_ALLOW_SUPPLIER_RESEARCH: process.env.AI_AGENT_ALLOW_SUPPLIER_RESEARCH,
    AI_AGENT_GEMINI_TOOL_PLANNER: process.env.AI_AGENT_GEMINI_TOOL_PLANNER,
    CLOUDINARY_URL: emptyToUndefined(process.env.CLOUDINARY_URL),
    CLOUDINARY_CLOUD_NAME: emptyToUndefined(process.env.CLOUDINARY_CLOUD_NAME),
    CLOUDINARY_API_KEY: emptyToUndefined(process.env.CLOUDINARY_API_KEY),
    CLOUDINARY_API_SECRET: emptyToUndefined(process.env.CLOUDINARY_API_SECRET),
    NOTIFY_EMAIL_TO: process.env.NOTIFY_EMAIL_TO,
    NOTIFY_EMAIL_FROM: process.env.NOTIFY_EMAIL_FROM,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    APP_URL: process.env.APP_URL,
    GITHUB_WEBHOOK_SECRET: emptyToUndefined(process.env.GITHUB_WEBHOOK_SECRET),
    GITHUB_TOKEN: emptyToUndefined(process.env.GITHUB_TOKEN),
    GITHUB_REPO: emptyToUndefined(process.env.GITHUB_REPO),
    GEMINI_CHANGELOG_MODEL: emptyToUndefined(process.env.GEMINI_CHANGELOG_MODEL),
  });
  if (!parsed.success) {
    throw new Error(`Invalid environment variables: ${parsed.error.message}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

