export type BittelSyncPhase = "start" | "crawl" | "import" | "done" | "error";

export type BittelSyncProgressEvent = {
  phase: BittelSyncPhase;
  message: string;
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

export type BittelSyncProgressHandler = (event: BittelSyncProgressEvent) => void;

export function emitBittelProgress(
  onProgress: BittelSyncProgressHandler | undefined,
  event: BittelSyncProgressEvent,
): void {
  onProgress?.(event);
}
