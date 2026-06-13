"use client";

import { useEffect, useState } from "react";

/** Изрязва бялото пространство около подпис (full-screen canvas → само щриховете). */
export function trimSignatureDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a > 24 && (r < 248 || g < 248 || b < 248)) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      if (maxX < minX) {
        resolve(dataUrl);
        return;
      }

      const pad = Math.round(Math.max(width, height) * 0.01) + 6;
      minX = Math.max(0, minX - pad);
      minY = Math.max(0, minY - pad);
      maxX = Math.min(width - 1, maxX + pad);
      maxY = Math.min(height - 1, maxY + pad);

      const cropW = maxX - minX + 1;
      const cropH = maxY - minY + 1;
      const out = document.createElement("canvas");
      out.width = cropW;
      out.height = cropH;
      const outCtx = out.getContext("2d")!;
      outCtx.fillStyle = "#ffffff";
      outCtx.fillRect(0, 0, cropW, cropH);
      outCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      resolve(out.toDataURL("image/png", 0.92));
    };
    img.onerror = () => reject(new Error("Неуспешно зареждане на подпис"));
    img.src = dataUrl;
  });
}

/** Изрязва подпис преди показване — по-голям и четим на бял фон. */
export function SignatureDisplay({
  src,
  className,
  alt = "",
}: {
  src: string;
  className?: string;
  alt?: string;
}) {
  const [displaySrc, setDisplaySrc] = useState(src);

  useEffect(() => {
    let cancelled = false;
    void trimSignatureDataUrl(src)
      .then(cropped => {
        if (!cancelled) setDisplaySrc(cropped);
      })
      .catch(() => {
        if (!cancelled) setDisplaySrc(src);
      });
    return () => { cancelled = true; };
  }, [src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={displaySrc} alt={alt} className={className} draggable={false} />
  );
}

/** Изрязва подпис от HTML canvas преди запис. */
export async function trimSignatureCanvas(canvas: HTMLCanvasElement): Promise<string> {
  const dataUrl = canvas.toDataURL("image/png", 0.92);
  try {
    return await trimSignatureDataUrl(dataUrl);
  } catch {
    return dataUrl;
  }
}
