export type ClimacomSyncPhase = "start" | "crawl" | "import" | "done" | "error";

export type ClimacomSyncProgressEvent = {
  phase: ClimacomSyncPhase;
  message: string;
  current?: number;
  total?: number;
  url?: string;
  productName?: string;
  result?: "created" | "updated" | "skipped";
  imageCount?: number;
};

export type ClimacomSyncProgressHandler = (event: ClimacomSyncProgressEvent) => void;

export function emitClimacomProgress(
  onProgress: ClimacomSyncProgressHandler | undefined,
  event: ClimacomSyncProgressEvent,
): void {
  onProgress?.(event);
}
