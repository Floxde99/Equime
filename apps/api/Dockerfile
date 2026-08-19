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
# Génère le client Prisma (TS → JS, voir apps/api/scripts/build-prisma-client.js).
# Aucune DATABASE_URL n'est nécessaire ici : prisma.config.js lit
# process.env['DATABASE_URL'] sans lever si la variable est absente.
RUN npm run prisma:generate --workspace apps/api
EXPOSE 3000
CMD ["node", "--watch", "apps/api/src/index.js"]

# ---------- Build prod : dépendances complètes + client Prisma généré ----------
# Le client Prisma est émis dans apps/api/generated (ignoré par .dockerignore),
# il doit donc être régénéré ici puis recopié dans l'image finale.
# Ce stage embarque aussi le CLI Prisma : il sert au service `migrate` des
# compose préprod/prod (`prisma migrate deploy`).
FROM base AS api-build
COPY . .
RUN npm run prisma:generate --workspace apps/api

# ---------- Prod : runtime minimal, non-root ----------
FROM node:22-alpine AS prod
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev --workspace apps/api --workspace packages/shared
COPY apps/api apps/api
COPY packages/shared packages/shared
COPY --from=api-build /app/apps/api/generated apps/api/generated
# Le volume nommé monté sur /app/uploads hérite des droits du dossier de
# l'image : sans ce chown, l'utilisateur `node` ne peut pas y écrire.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node
EXPOSE 3000
CMD ["node", "apps/api/src/index.js"]
