import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { OfferPDF, offerPdfContentDisposition } from "@/lib/offer-pdf";
import { OFFER_ITEM_SELECT, OFFER_SELECT, type OfferItemRow, type OfferRow } from "@/lib/offers/offerTypes";
import { enrichOfferItemsForPdf } from "@/lib/offers/offerPdfImages";
import { normalizeOfferTermsNote } from "@/lib/offers/normalizeOfferTermsNote";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    let session;
    try {
      session = await adminSession();
    } catch {
      return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
    }
    try {
      requireRole(session, "master_admin", "office_staff");
    } catch {
      return withCors(req, NextResponse.json({ error: "Забранен достъп" }, { status: 403 }));
    }

    const { id } = await params;
    const { data, error } = await session.db.from("service_offers").select(OFFER_SELECT).eq("id", id).maybeSingle();
    if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
    if (!data) return withCors(req, NextResponse.json({ error: "Не е намерена" }, { status: 404 }));

    const { data: items } = await session.db
      .from("service_offer_items")
      .select(OFFER_ITEM_SELECT)
      .eq("offer_id", id)
      .order("sort_order", { ascending: true });

    const rawItems = (items ?? []) as OfferItemRow[];
    const pdfItems = await enrichOfferItemsForPdf(session.db, rawItems);
    const payload = {
      ...(data as OfferRow),
      terms_note: normalizeOfferTermsNote(data.terms_note),
      items: pdfItems,
    };

    const pdfBuffer = await renderToBuffer(
      React.createElement(OfferPDF, { data: payload }) as Parameters<typeof renderToBuffer>[0],
    );

    const res = new NextResponse(new Blob([new Uint8Array(pdfBuffer)]), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": offerPdfContentDisposition(payload),
        "Content-Length": String(pdfBuffer.byteLength),
      },
    });
    return withCors(req, res);
  } catch (e: unknown) {
    console.error("[PDF] render error:", e);
    return withCors(
      req,
      NextResponse.json(
        { error: "PDF грешка", detail: String(e instanceof Error ? e.message : e) },
        { status: 500 },
      ),
    );
  }
}
