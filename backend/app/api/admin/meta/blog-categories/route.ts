import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";

const categories = [
  {
    slug: "saveti-pri-izbor",
    name: "Съвети при избор",
    description: "Как да изберете перфектния климатик за вашето помещение - мощност, марки, функции",
    color: "#00B4D8",
  },
  {
    slug: "sravneniya",
    name: "Сравнения",
    description: "Детайлни сравнения между марки и модели климатици",
    color: "#FF4D00",
  },
  {
    slug: "montaj",
    name: "Монтаж",
    description: "Всичко за монтажа на климатици - цени, процес, съвети",
    color: "#27AE60",
  },
  {
    slug: "profilaktika",
    name: "Профилактика",
    description: "Поддръжка, почистване и профилактика на климатични системи",
    color: "#9B59B6",
  },
  {
    slug: "remont",
    name: "Ремонт",
    description: "Често срещани проблеми и тяхното отстраняване",
    color: "#E74C3C",
  },
  {
    slug: "energiya",
    name: "Енергийна ефективност",
    description: "Икономия на ток, енергийни класове, ефективност",
    color: "#F39C12",
  },
  {
    slug: "novini",
    name: "Новини",
    description: "Нови модели, промоции и актуалности от света на климатизацията",
    color: "#1ABC9C",
  },
  {
    slug: "regionalni",
    name: "Регионални",
    description: "Специализирани съвети за Смолян и планинските региони",
    color: "#34495E",
  },
];

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  return withCors(req, NextResponse.json({ data: categories }));
}

