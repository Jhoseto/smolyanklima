import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    // Serve the Vite SPA (built into /public) from the same origin in production.
    // Keep backend routes working normally.
    // SPA fallback за публичния сайт. Изключваме PWA/manifest и статични коренни файлове,
    // иначе браузърът взима HTML вместо JSON → "Manifest: Line 1 Syntax error".
    return [
      {
        source:
          "/:path((?!api/|admin/|login$|_next/|assets/|images/|favicon\\.ico|manifest\\.webmanifest|manifest\\.json|icon\\.svg$).*)",
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

