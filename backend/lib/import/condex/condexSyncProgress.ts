export type CondexSyncPhase = "start" | "crawl" | "import" | "done" | "error";

export type CondexSyncProgressEvent = {
  phase: CondexSyncPhase;
  message: string;
  /** Брой открити URL по време на crawl. */
  discovered?: number;
  current?: number;
  total?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  url?: string;
  productName?: string;
  result?: "created" | "updated" | "skipped";
  imageCount?: number;
};

export type CondexSyncProgressHandler = (event: CondexSyncProgressEvent) => void;

export function emitCondexProgress(
  onProgress: CondexSyncProgressHandler | undefined,
  event: CondexSyncProgressEvent,
): void {
  onProgress?.(event);
}
