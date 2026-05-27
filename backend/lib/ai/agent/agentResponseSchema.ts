/** JSON Schema for Gemini structured output (responseSchema + application/json). Keep flat — no nested arrays. */
export const AGENT_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    blocks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["markdown", "table", "chart", "kpi", "link"],
          },
          content: { type: "string" },
          title: { type: "string" },
          columns: { type: "array", items: { type: "string" } },
          chartType: {
            type: "string",
            enum: ["bar", "line", "pie", "area", "scatter", "funnel"],
          },
          labels: { type: "array", items: { type: "string" } },
          datasets: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                data: { type: "array", items: { type: "number" } },
              },
            },
          },
          label: { type: "string" },
          value: { type: "string" },
          hint: { type: "string" },
          href: { type: "string" },
        },
        required: ["type"],
      },
    },
  },
  required: ["blocks"],
} as const;
