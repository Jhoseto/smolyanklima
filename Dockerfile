# Unified production image → ЕДИН Cloud Run service
# - Next.js standalone слуша $PORT (Cloud Run задава 8080)
# - Vite SPA → /app/public; rewrite в backend/next.config.mjs към /index.html
#
# Build (repo root):
#   docker build -t smolyanklima:local .

FROM node:22-alpine AS frontend_builder
WORKDIR /repo
ENV NODE_ENV=production
ARG VITE_GOOGLE_SITE_VERIFICATION=
ENV VITE_GOOGLE_SITE_VERIFICATION=$VITE_GOOGLE_SITE_VERIFICATION
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS backend_deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS backend_builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ARG NEXT_PUBLIC_SITE_ORIGIN=https://smolyanklima.com
COPY --from=backend_deps /app/node_modules ./node_modules
COPY backend ./
ENV SUPABASE_URL=https://example.supabase.co \
    SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.placeholder \
    SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.placeholder \
    FRONTEND_ORIGIN=${NEXT_PUBLIC_SITE_ORIGIN} \
    NEXT_PUBLIC_SITE_ORIGIN=${NEXT_PUBLIC_SITE_ORIGIN} \
    GEMINI_API_KEY=placeholder-key-32chars-minimum-xx
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat tzdata
ENV NODE_ENV=production
ENV TZ=Europe/Sofia
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=backend_builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=backend_builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=frontend_builder --chown=nextjs:nodejs /repo/dist ./public
# Гарантирай SEO файлове (Vite ги копира, но явно възстановяваме при нужда)
COPY --chown=nextjs:nodejs public/robots.txt public/llms.txt ./public/
# Vite dist презаписва public — върни PWA/SEO икони (Google търси favicon.ico + PNG)
COPY --chown=nextjs:nodejs public/favicon.ico public/favicon-16x16.png public/favicon-32x32.png \
  public/apple-touch-icon.png public/icon-192.png public/icon-512.png public/icon.svg ./public/
COPY --chown=nextjs:nodejs backend/public/manifest.webmanifest ./public/manifest.webmanifest
# КРИТИЧНО: Vite dist трие admin SW — без него PWA push на телефона не работи
COPY --chown=nextjs:nodejs backend/public/admin ./public/admin

USER nextjs
EXPOSE 8080

CMD ["sh", "-c", "set -eux; echo \"[boot] PORT=${PORT:-}\"; exec node server.js"]
