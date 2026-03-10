FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/mcp/package.json packages/mcp/

RUN npm ci

COPY packages/shared packages/shared
COPY packages/mcp packages/mcp

RUN npm run build:shared && npm run build --workspace=packages/mcp

# ── Runtime ────────────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/mcp/package.json packages/mcp/

RUN npm ci --omit=dev

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/mcp/dist packages/mcp/dist

WORKDIR /app/packages/mcp

ENV NODE_ENV=production PORT=3002

EXPOSE 3002

CMD node dist/index.js
