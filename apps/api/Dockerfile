# syntax=docker/dockerfile:1
# API Equime — contexte de build : racine du monorepo
# docker build -f apps/api/Dockerfile --target dev .

# ---------- Base : dépendances du monorepo ----------
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci

# ---------- Dev : hot reload via node --watch + volumes ----------
FROM base AS dev
ENV NODE_ENV=development
COPY . .
# Génère le client Prisma (TS → JS, voir apps/api/scripts/build-prisma-client.js)
RUN npm run prisma:generate --workspace apps/api
EXPOSE 3000
CMD ["node", "--watch", "apps/api/src/index.js"]

# ---------- Prod (squelette — durci et finalisé en Phase 6) ----------
FROM node:22-alpine AS prod
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev --workspace apps/api --workspace packages/shared
COPY apps/api apps/api
COPY packages/shared packages/shared
USER node
EXPOSE 3000
CMD ["node", "apps/api/src/index.js"]
