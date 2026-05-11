import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// On Windows dev, Node.js cannot verify Supabase's TLS cert via the bundled CA store.
// Set the env var here (at Next.js config eval time) so it's active before any route modules load.
if (process.env.NODE_ENV === "development") {
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
  async rewrites() {
    // Serve the Vite SPA (built into /public) from the same origin in production.
    // Keep backend routes working normally.
    // SPA fallback за публичния сайт. Изключваме PWA/manifest и статични коренни файлове,
    // иначе браузърът взима HTML вместо JSON → "Manifest: Line 1 Syntax error".
    return [
      {
        source:
          "/:path((?!api/|admin/|login$|_next/|assets/|images/|favicon\\.ico|manifest\\.webmanifest|manifest\\.json|icon\\.svg|icon-192\\.png|icon-512\\.png|apple-touch-icon\\.png).*)",
        destination: "/index.html",
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

