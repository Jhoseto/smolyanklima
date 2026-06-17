/** Fetch protocol PDF blob (authenticated). */
export async function fetchProtocolPdfBlob(protocolId: string): Promise<Blob> {
  const res = await fetch(`/api/admin/service/protocols/${protocolId}/pdf`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("Грешка при генериране на PDF");
  }
  return res.blob();
}

export function protocolPdfFilename(protocolNumber?: string | null, protocolId?: string): string {
  const base = protocolNumber?.trim()
    ? `protokol-${protocolNumber.replace(/[^\w.-]+/g, "_")}.pdf`
    : `protokol-${protocolId ?? "draft"}.pdf`;
  return base;
}

/** Download PDF via blob link (desktop / fallback). */
export function downloadProtocolPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

export type SharePdfResult = "shared" | "downloaded";

/**
 * Native share sheet on mobile (files) or download fallback.
 * Shares only the PDF file — no HTML/text extras.
 */
export async function shareProtocolPdf(
  blob: Blob,
  filename: string,
): Promise<SharePdfResult> {
  const file = new File([blob], filename, { type: "application/pdf" });

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return "shared";
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw e;
      }
    }
  }

  downloadProtocolPdfBlob(blob, filename);
  return "downloaded";
}
