import sharp from "sharp";

/** Изрязва бялото пространство около подпис (за PDF генериране на сървъра). */
export async function trimSignatureDataUrlServer(
  dataUrl: string | null | undefined,
): Promise<string | null> {
  if (!dataUrl?.startsWith("data:image")) return dataUrl ?? null;
  try {
    const b64 = dataUrl.split(",")[1];
    if (!b64) return dataUrl;
    const buf = Buffer.from(b64, "base64");
    const trimmed = await sharp(buf).trim({ threshold: 18 }).png().toBuffer();
    return `data:image/png;base64,${trimmed.toString("base64")}`;
  } catch {
    return dataUrl;
  }
}

export async function trimProtocolSignatures<T extends {
  signature_team?: string | null;
  signature_client?: string | null;
}>(row: T): Promise<T> {
  const [signature_team, signature_client] = await Promise.all([
    trimSignatureDataUrlServer(row.signature_team),
    trimSignatureDataUrlServer(row.signature_client),
  ]);
  return { ...row, signature_team, signature_client };
}
