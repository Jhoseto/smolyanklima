import type { ReactElement } from "react";
import type { PublicOfferShare } from "@/lib/offers/publicOfferShare";
import {
  formatShareTotal,
  formatShareValidUntil,
  offerItemDisplayName,
  offerProductSummary,
} from "@/lib/offers/publicOfferShare";

const W = 1200;
const H = 630;

function BrandLogo({ size }: { size: number }) {
  const pad = Math.round(size * 0.04);
  const glyph = Math.round(size * 0.92);
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "white",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        overflow: "hidden",
        paddingLeft: pad,
        boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
      }}
    >
      <svg viewBox="4.5 14.5 71 71" width={glyph} height={glyph}>
        <path d="M 70 15.4 A 40 40 0 0 0 10.1 47 L 28.2 47 A 22 22 0 0 1 61 30.9 Z" fill="#FF6A00" />
        <path d="M 10.1 53 A 40 40 0 0 0 70 84.6 L 61 69.1 A 22 22 0 0 1 28.2 53 Z" fill="#0099CC" />
        <path d="M 62.6 47 A 13 13 0 0 0 37.4 47 Z" fill="#FF6A00" />
        <path d="M 37.4 53 A 13 13 0 0 0 62.6 53 Z" fill="#0099CC" />
      </svg>
    </div>
  );
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

/** OG thumbnail 1200×630 за споделяне на оферта (Viber, WhatsApp, Facebook…). */
export function OfferOgImageJsx(
  data: PublicOfferShare,
  productImageDataUri: string | null = null,
): ReactElement {
  const headline = truncate(data.title?.trim() || "Оферта за климатизация", 72);
  const client = data.client_name?.trim() ? truncate(data.client_name.trim(), 40) : null;
  const objectNote = data.object_note?.trim() ? truncate(data.object_note.trim(), 56) : null;
  const products = offerProductSummary(data.items);
  const firstName = data.items[0] ? truncate(offerItemDisplayName(data.items[0]), 48) : null;

  return (
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: "row",
        background: "linear-gradient(135deg, #FF4D00 0%, #FF6A00 42%, #FF2A4D 100%)",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* dot pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.12,
          backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Left: offer info */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 40px 48px 56px",
          position: "relative",
          zIndex: 1,
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "inline-flex",
              alignSelf: "flex-start",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,255,255,0.22)",
              borderRadius: 999,
              padding: "8px 16px",
              color: "white",
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            Персонална оферта · {data.offer_number}
          </div>

          <div
            style={{
              color: "white",
              fontSize: 52,
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: 680,
            }}
          >
            {headline}
          </div>

          {(client || objectNote) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 640 }}>
              {client ? (
                <div style={{ color: "rgba(255,255,255,0.95)", fontSize: 24, fontWeight: 600 }}>
                  Клиент: {client}
                </div>
              ) : null}
              {objectNote ? (
                <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 22, fontWeight: 500 }}>
                  {objectNote}
                </div>
              ) : null}
            </div>
          )}

          {products ? (
            <div
              style={{
                color: "rgba(255,255,255,0.92)",
                fontSize: 20,
                fontWeight: 600,
                maxWidth: 660,
                lineHeight: 1.35,
              }}
            >
              {truncate(products, 90)}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 16, fontWeight: 700, letterSpacing: "0.08em" }}>
              КРАЙНА ЦЕНА · С ДДС
            </div>
            <div style={{ color: "white", fontSize: 56, fontWeight: 900, letterSpacing: "-0.03em" }}>
              {formatShareTotal(data)}
            </div>
            <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 18, fontWeight: 600 }}>
              Валидна до {formatShareValidUntil(data.valid_until)}
            </div>
          </div>
        </div>
      </div>

      {/* Right: logo + optional product */}
      <div
        style={{
          width: 380,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          padding: "40px 48px 40px 24px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {productImageDataUri ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              background: "rgba(255,255,255,0.95)",
              borderRadius: 24,
              padding: "20px 20px 16px",
              boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
              maxWidth: 300,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={productImageDataUri}
              alt=""
              width={240}
              height={180}
              style={{ objectFit: "contain", maxHeight: 180 }}
            />
            {firstName ? (
              <div
                style={{
                  color: "#111827",
                  fontSize: 16,
                  fontWeight: 800,
                  textAlign: "center",
                  lineHeight: 1.25,
                  maxWidth: 260,
                }}
              >
                {firstName}
              </div>
            ) : null}
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <BrandLogo size={96} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{ color: "white", fontSize: 28, fontWeight: 900, letterSpacing: "0.04em" }}>
              СМОЛЯН
            </div>
            <div style={{ color: "#B8ECFF", fontSize: 28, fontWeight: 900, letterSpacing: "0.04em" }}>
              КЛИМА
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const OFFER_OG_SIZE = { width: W, height: H };
