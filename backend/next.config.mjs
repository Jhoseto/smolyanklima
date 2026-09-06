import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// On Windows dev, Node.js often cannot verify Supabase TLS via the bundled CA store.
// Default ON in development; set ALLOW_INSECURE_TLS=false to enforce verification locally.
if (process.env.NODE_ENV === "development" && process.env.ALLOW_INSECURE_TLS !== "false") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  // Suppress the resulting Node.js warning so the terminal stays clean.
  const _origWarn = process.emitWarning.bind(process);
  process.emitWarning = (warning, ...args) => {
    if (typeof warning === "string" && warning.includes("NODE_TLS_REJECT_UNAUTHORIZED")) return;
    _origWarn(warning, ...args);
  };
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Tree-shake lucide-react barrel imports at build time — smaller JS for admin
    optimizePackageImports: ["lucide-react"],
  },
  // Compress responses
  compress: true,
  async redirects() {
    return [
      // Legacy OpenCart image paths — Google Image Proxy keeps hitting these
      { source: "/image/:path*", destination: "/", permanent: true },
      // Legacy OpenCart entry point
      { source: "/index.php", destination: "/", permanent: true },
      // Legacy CloudCart import slugs (--slug, ---slug) — bots only
      { source: "/:path(--[^/]*)", destination: "/catalog", permanent: true },
      { source: "/:path(---[^/]*)", destination: "/catalog", permanent: true },
    ];
  },
  async rewrites() {
    // Serve the Vite SPA (built into /public) from the same origin in production.
    // Keep backend routes working normally.
    // SPA fallback за публичния сайт. Изключваме PWA/manifest и статични коренни файлове,
    // иначе браузърът взима HTML вместо JSON → "Manifest: Line 1 Syntax error".
    return [
      {
        source:
          "/:path((?!api/|admin/|login$|_next/|assets/|images/|favicon\\.ico|favicon-16x16\\.png|favicon-32x32\\.png|manifest\\.webmanifest|manifest\\.json|icon\\.svg|icon-192\\.png|icon-512\\.png|apple-touch-icon\\.png|llms\\.txt|robots\\.txt|sitemap\\.xml|rss\\.xml|BingSiteAuth\\.xml).*)",
        destination: "/index.html",
      },
    ];
  },
  async headers() {
    const baseSecurity = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
    ];
    const prodSecurity =
      process.env.NODE_ENV === "production"
        ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
        : [];

    const isProd = process.env.NODE_ENV === "production";
    const immutableCache = isProd
      ? [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }]
      : [];

    return [
      {
        source: "/assets/:path*",
        headers: [...immutableCache, ...baseSecurity],
      },
      {
        source: "/_next/static/:path*",
        headers: [...immutableCache, ...baseSecurity],
      },
      {
        source: "/admin",
        headers: [
          { key: "Cache-Control", value: "private, no-cache, no-store, must-revalidate" },
          { key: "X-Frame-Options", value: "DENY" },
          ...baseSecurity,
          ...prodSecurity,
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-cache, no-store, must-revalidate" },
          { key: "X-Frame-Options", value: "DENY" },
          ...baseSecurity,
          ...prodSecurity,
        ],
      },
      {
        source: "/:path*",
        headers: [...baseSecurity, ...prodSecurity],
      },
    ];
  },
};

export default nextConfig;

