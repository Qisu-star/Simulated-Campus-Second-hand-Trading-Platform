# =============================================================================
# Dockerfile — 校园二手集市 (Campus Trading Platform)
# Multi-stage build: builder → runner
# =============================================================================

# ---- Build Stage ----
FROM node:24-slim AS builder

WORKDIR /build

# Copy package files
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build backend (TypeScript → JavaScript)
RUN npm run build --workspace backend

# Build frontend (Next.js standalone)
RUN npm run build --workspace frontend

# ---- Production Stage ----
FROM node:24-slim AS runner

WORKDIR /app

# Create directories for persistent data
RUN mkdir -p /app/data /app/uploads

# ---- Copy frontend (Next.js standalone) ----
COPY --from=builder /build/frontend/.next/standalone/frontend ./frontend
COPY --from=builder /build/frontend/.next/static ./frontend/.next/static

# Copy root node_modules (contains ALL hoisted deps from npm workspaces)
# This includes both frontend and backend dependencies
COPY --from=builder /build/node_modules ./node_modules

# ---- Copy backend ----
COPY --from=builder /build/backend/package.json ./backend/
COPY --from=builder /build/backend/bootstrap.js ./backend/
COPY --from=builder /build/backend/dist ./backend/dist
COPY --from=builder /build/backend/node_modules ./backend/node_modules

# ---- Copy entrypoint ----
COPY start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

# Environment variables
ENV NODE_ENV=production
ENV BACKEND_PORT=7001
ENV FRONTEND_PORT=3000
ENV BACKEND_INTERNAL_URL=http://127.0.0.1:7001

# Ports: frontend + backend API
EXPOSE 3000 7001

# Volumes for persistent data
VOLUME ["/app/data", "/app/uploads"]

ENTRYPOINT ["/usr/local/bin/start.sh"]