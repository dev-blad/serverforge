# syntax=docker/dockerfile:1

# ─── Build stage ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json .npmrc ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build && npm prune --omit=dev

# ─── Runtime stage ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/templates ./templates
# Persistent data (SQLite) lives in /app/data — mount a volume there (docker compose does this;
# on Railway add a volume at /app/data). No VOLUME instruction: Railway rejects it.
# Runs as root because Railway mounts volumes as root-owned.
RUN mkdir -p /app/data
# Apply migrations, then start the bot.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/src/index.js"]
