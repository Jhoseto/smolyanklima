# Unified production image (ONE Cloud Run service)
# - nginx serves Vite SPA
# - nginx proxies /api, /admin, /login, /_next to Next.js backend (running on 3001 inside container)
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

RUN apk add --no-cache nginx && \
    addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs && \
    mkdir -p /run/nginx /var/lib/nginx /var/log/nginx && \
    chown -R nextjs:nodejs /run/nginx /var/lib/nginx /var/log/nginx

# nginx config
COPY deploy/nginx-unified.conf /etc/nginx/http.d/default.conf

# frontend dist → nginx root
COPY --from=frontend_builder /repo/dist /usr/share/nginx/html

# backend standalone
COPY --from=backend_builder /app/public ./public
COPY --from=backend_builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=backend_builder --chown=nextjs:nodejs /app/.next/static ./.next/static

EXPOSE 8080

# Start backend + nginx (one container)
# Cloud Run sets PORT=8080 for the container. We keep nginx on 8080 and force Next backend to 3001.
CMD ["sh", "-c", "PORT=3001 node /app/server.js & nginx -g 'daemon off;'"]

