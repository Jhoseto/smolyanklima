/**
 * Генерира PNG/ICO икони от public/icon.svg за Google, iOS и PWA.
 * Пусни: npm run icons:generate (от backend/)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const SVG_PATH = path.join(REPO_ROOT, "public", "icon.svg");

const OUTPUT_DIRS = [
  path.join(REPO_ROOT, "public"),
  path.join(REPO_ROOT, "frontend", "public"),
];

type IconSpec = { name: string; size: number };

const PNG_ICONS: IconSpec[] = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
];

async function writePng(svg: Buffer, outPath: string, size: number) {
  await sharp(svg, { density: 300 })
    .resize(size, size, { fit: "cover" })
    .png()
    .toFile(outPath);
}

/** Минимален ICO (16 + 32 px PNG в един файл) — достатъчен за Google / браузъри. */
async function writeIco(svg: Buffer, outPath: string) {
  const sizes = [16, 32, 48];
  const pngBuffers = await Promise.all(
    sizes.map((size) =>
      sharp(svg, { density: 300 })
        .resize(size, size, { fit: "cover" })
        .png()
        .toBuffer(),
    ),
  );

  const count = pngBuffers.length;
  const headerSize = 6 + count * 16;
  let offset = headerSize;
  const entries: Buffer[] = [];

  for (let i = 0; i < count; i++) {
    const size = sizes[i]!;
    const png = pngBuffers[i]!;
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += png.length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  await writeFile(outPath, Buffer.concat([header, ...entries, ...pngBuffers]));
}

async function main() {
  const svg = await readFile(SVG_PATH);

  for (const dir of OUTPUT_DIRS) {
    await mkdir(dir, { recursive: true });
    for (const { name, size } of PNG_ICONS) {
      const out = path.join(dir, name);
      await writePng(svg, out, size);
      console.log("wrote", path.relative(REPO_ROOT, out));
    }
    const icoPath = path.join(dir, "favicon.ico");
    await writeIco(svg, icoPath);
    console.log("wrote", path.relative(REPO_ROOT, icoPath));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
