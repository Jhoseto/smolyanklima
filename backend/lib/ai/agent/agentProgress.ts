export type AgentProgressEvent = {
  phase: "start" | "tools" | "final" | "done";
  message: string;
  tools?: string[];
};

export function progressMessage(event: AgentProgressEvent): string {
  return event.message;
}
