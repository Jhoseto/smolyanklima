"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Share2, Download, Loader2, CheckCircle2 } from "lucide-react";
import {
  fetchProtocolPdfBlob,
  protocolPdfFilename,
  shareProtocolPdf,
  downloadProtocolPdfBlob,
} from "@/lib/protocol-pdf-share";
import { useAdminBackHandler } from "@/app/admin/ui";

interface Props {
  protocolId: string;
  protocolNumber?: string | null;
  clientLabel?: string;
  onDone: () => void;
}

export function ProtocolPdfFinalView({
  protocolId,
  protocolNumber,
  clientLabel,
  onDone,
}: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [resolvedNumber, setResolvedNumber] = useState(protocolNumber ?? null);

  useAdminBackHandler(true, onDone, `protocol-final-${protocolId}`);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (protocolNumber) {
          setResolvedNumber(protocolNumber);
        } else {
          const metaRes = await fetch(`/api/admin/service/protocols/${protocolId}`, {
            credentials: "include",
          });
          if (metaRes.ok) {
            const meta = await metaRes.json() as { data?: { protocol_number?: string } };
            if (!cancelled && meta.data?.protocol_number) {
              setResolvedNumber(meta.data.protocol_number);
            }
          }
        }

        const blob = await fetchProtocolPdfBlob(protocolId);
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Грешка при зареждане на PDF");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [protocolId, protocolNumber]);

  const filename = protocolPdfFilename(resolvedNumber, protocolId);

  const getBlob = useCallback(async () => {
    if (pdfUrl) {
      const res = await fetch(pdfUrl);
      return res.blob();
    }
    return fetchProtocolPdfBlob(protocolId);
  }, [pdfUrl, protocolId]);

  const handleShare = async () => {
    setSharing(true);
    setShareHint(null);
    setError(null);
    try {
      const blob = await getBlob();
      const result = await shareProtocolPdf(blob, filename);
      setShareHint(
        result === "shared"
          ? "PDF е споделен."
          : "Споделянето не е налично — PDF е свален на устройството.",
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Грешка при споделяне");
    } finally {
      setSharing(false);
    }
  };

  const handleDownload = async () => {
    setError(null);
    try {
      const blob = await getBlob();
      downloadProtocolPdfBlob(blob, filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Грешка при сваляне");
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-100">
      <div className="bg-white border-b border-slate-200 shrink-0 safe-top">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onDone}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
            aria-label="Затвори"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-bold text-slate-900 truncate">Протоколът е готов</p>
            </div>
            <p className="text-xs text-slate-500 truncate">
              {resolvedNumber ? `№ ${resolvedNumber}` : "PDF преглед"}
              {clientLabel ? ` · ${clientLabel}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-3 sm:p-4">
        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            <p className="text-sm font-medium">Генериране на PDF…</p>
          </div>
        )}
        {!loading && error && !pdfUrl && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}
        {!loading && pdfUrl && (
          <iframe
            title="Протокол PDF"
            src={pdfUrl}
            className="w-full h-full rounded-xl border border-slate-200 bg-white shadow-sm"
          />
        )}
      </div>

      <div className="bg-white/95 backdrop-blur-md border-t border-slate-200 shrink-0 pb-safe">
        <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
          {error && pdfUrl && (
            <p className="text-xs text-red-600 font-medium text-center">{error}</p>
          )}
          {shareHint && (
            <p className="text-xs text-emerald-700 font-medium text-center">{shareHint}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => void handleShare()}
              disabled={sharing || loading || !pdfUrl}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 disabled:bg-slate-300 text-white py-3.5 rounded-xl font-bold text-sm active:bg-blue-700"
            >
              {sharing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
              Сподели PDF
            </button>
            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={loading || !pdfUrl}
              className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border-2 border-slate-200 text-slate-700 font-semibold text-sm active:bg-slate-50"
            >
              <Download className="w-5 h-5" />
              Свали
            </button>
          </div>
          <button
            type="button"
            onClick={onDone}
            className="w-full py-3 rounded-xl text-slate-600 font-semibold text-sm hover:bg-slate-50"
          >
            Към списъка с протоколи
          </button>
        </div>
      </div>
    </div>
  );
}
