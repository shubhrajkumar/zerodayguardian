# ============================================================
# ZeroDay Guardian — Multi-stage Dockerfile
# Stages: base → deps → builder → production
# ============================================================

# ── Stage 1: Base ──
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache tini curl
ENV NODE_ENV=production
COPY package.json package-lock.json ./

# ── Stage 2: Dependencies (cached layer) ──
FROM base AS deps
RUN npm ci --omit=dev --no-fund --no-audit --ignore-scripts

# ── Stage 3: Builder ──
FROM base AS builder
COPY . .
RUN npm ci --no-fund --no-audit && npm run build

# ── Stage 4: Production ──
FROM node:22-alpine AS production
WORKDIR /app
RUN apk add --no-cache tini curl ca-certificates

# Create non-root user for security
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser

# Copy only what's needed at runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/public ./public

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

# Security: drop root privileges
USER appuser

EXPOSE 8080 8787

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "node backend/server.js & npm run preview -- --host 0.0.0.0 --port 8080"]
