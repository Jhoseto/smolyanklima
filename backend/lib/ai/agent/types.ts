import { z } from "zod";

export const AgentBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("markdown"), content: z.string().max(12000) }),
  z.object({
    type: z.literal("table"),
    columns: z.array(z.string().max(120)).max(20),
    rows: z.array(z.array(z.string().max(500)).max(20)).max(50),
    links: z
      .array(z.object({ row: z.number().int().min(0), href: z.string().max(500) }))
      .optional(),
  }),
  z.object({
    type: z.literal("chart"),
    chartType: z.enum(["bar", "line", "pie", "area"]),
    title: z.string().max(200),
    labels: z.array(z.string().max(80)).max(60),
    datasets: z
      .array(
        z.object({
          label: z.string().max(120),
          data: z.array(z.number()).max(60),
        }),
      )
      .max(5),
  }),
  z.object({
    type: z.literal("kpi"),
    label: z.string().max(120),
    value: z.string().max(120),
    hint: z.string().max(300).optional(),
  }),
  z.object({
    type: z.literal("link"),
    label: z.string().max(200),
    href: z.string().max(500),
  }),
]);

export type AgentBlock = z.infer<typeof AgentBlockSchema>;

export const AgentResponseSchema = z.object({
  blocks: z.array(AgentBlockSchema).min(1).max(24),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
};

export type AgentTurnResult = {
  blocks: AgentBlock[];
  usage: TokenUsage;
  toolCallsCount: number;
  model: string;
};
