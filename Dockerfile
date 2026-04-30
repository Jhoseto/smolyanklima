# Unified production image (ONE Cloud Run service)
# - Next.js backend is the only server process (listens on Cloud Run $PORT=8080)
# - Vite SPA is served as static files from Next.js `public/`
# - SPA routes are rewritten to `/index.html` in `backend/next.config.mjs`
#
# Build context: repo root
#
# Cloud Run:
# - Container listens on 8080 (nginx)
# - Backend listens internally on 3001

FROM node:22-alpine AS frontend_builder
WORKDIR /repo
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS backend_deps
WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm ci

FROM node:22-alpine AS backend_builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=backend_deps /app/node_modules ./node_modules
COPY backend ./
# Dummy values so `next build` can load modules that parse env at build time
ENV SUPABASE_URL=https://example.supabase.co \
    SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.placeholder \
    SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.placeholder \
    FRONTEND_ORIGIN=http://localhost:3000 \
    GEMINI_API_KEY=placeholder-key-32chars-minimum-xx
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# backend standalone
COPY --from=backend_builder /app/public ./public
COPY --from=backend_builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=backend_builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# frontend dist → Next public (static)
COPY --from=frontend_builder /repo/dist ./public

USER nextjs
EXPOSE 8080

# Cloud Run sets PORT=8080; Next standalone honors PORT.
CMD ["node", "server.js"]

