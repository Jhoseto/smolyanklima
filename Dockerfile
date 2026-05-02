# Unified production image → ЕДИН Cloud Run service
# - Next.js standalone слуша $PORT (Cloud Run задава 8080)
# - Vite SPA → /app/public; rewrite в backend/next.config.mjs към /index.html
#
# Build (repo root):
#   docker build -t smolyanklima:local .

FROM node:22-alpine AS frontend_builder
WORKDIR /repo
ENV NODE_ENV=production
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
COPY --from=backend_deps /app/node_modules ./node_modules
COPY backend ./
ENV SUPABASE_URL=https://example.supabase.co \
    SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.placeholder \
    SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.placeholder \
    FRONTEND_ORIGIN=http://localhost:3000 \
    GEMINI_API_KEY=placeholder-key-32chars-minimum-xx
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=backend_builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=backend_builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=frontend_builder --chown=nextjs:nodejs /repo/dist ./public
# Vite dist презаписва целия public — върни admin PWA manifest + икона (layout.tsx + manifest)
COPY --chown=nextjs:nodejs backend/public/manifest.webmanifest ./public/manifest.webmanifest
COPY --chown=nextjs:nodejs backend/public/icon.svg ./public/icon.svg

USER nextjs
EXPOSE 8080

CMD ["sh", "-c", "set -eux; echo \"[boot] PORT=${PORT:-}\"; exec node server.js"]
