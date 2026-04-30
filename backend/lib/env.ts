import { z } from "zod";

const EnvSchema = z.object({
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
  GEMINI_API_KEY: z.string().min(10),
  GEMINI_MODEL: z.string().min(1).optional(),
  GEMINI_TEMPERATURE: z.coerce.number().min(0).max(1).optional(),
  BLOG_IMAGES_BUCKET: z.string().min(1).optional(),
  NOTIFY_EMAIL_TO: z.string().email().optional(),
  NOTIFY_EMAIL_FROM: z.string().email().optional(),
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
    GEMINI_TEMPERATURE: process.env.GEMINI_TEMPERATURE,
    BLOG_IMAGES_BUCKET: process.env.BLOG_IMAGES_BUCKET,
    NOTIFY_EMAIL_TO: process.env.NOTIFY_EMAIL_TO,
    NOTIFY_EMAIL_FROM: process.env.NOTIFY_EMAIL_FROM,
  });
  if (!parsed.success) {
    throw new Error(`Invalid environment variables: ${parsed.error.message}`);
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

