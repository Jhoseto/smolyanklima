import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";

const authors = [
  { slug: "ivan-petrov", name: "Иван Петров", role: "Експерт по климатизация" },
  { slug: "georgi-ivanov", name: "Георги Иванов", role: "Технически консултант" },
  { slug: "smolyan-klima-team", name: "Екип Smolyan Klima", role: "Маркетинг екип" },
];

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  return withCors(req, NextResponse.json({ data: authors }));
}

