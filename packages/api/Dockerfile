FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/

RUN npm ci

COPY packages/shared packages/shared
COPY packages/api packages/api

RUN npm run build:shared && npm run build --workspace=packages/api

# ── Runtime ────────────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/

RUN npm ci --omit=dev

COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/api/dist packages/api/dist
COPY packages/api/migrations packages/api/migrations
COPY packages/api/ecosystem.config.cjs packages/api/

WORKDIR /app/packages/api

ENV NODE_ENV=production PORT=3001

EXPOSE 3001

# Run migrations then start
CMD node dist/scripts/migrate.js && node dist/server.js
