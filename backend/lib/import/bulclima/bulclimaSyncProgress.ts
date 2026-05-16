export type BulclimaSyncPhase = "start" | "crawl" | "import" | "done" | "error";

export type BulclimaSyncProgressEvent = {
  phase: BulclimaSyncPhase;
  message: string;
  current?: number;
  total?: number;
  url?: string;
  productName?: string;
  result?: "created" | "updated" | "skipped";
  imageCount?: number;
};

export type BulclimaSyncProgressHandler = (event: BulclimaSyncProgressEvent) => void;

export function emitBulclimaProgress(
  onProgress: BulclimaSyncProgressHandler | undefined,
  event: BulclimaSyncProgressEvent,
): void {
  onProgress?.(event);
}
