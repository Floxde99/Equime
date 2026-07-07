# syntax=docker/dockerfile:1
# Web Equime — contexte de build : racine du monorepo
# docker build -f apps/web/Dockerfile --target dev .

# ---------- Base : dépendances du monorepo ----------
FROM node:22-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci

# ---------- Dev : serveur Vite + volumes ----------
FROM base AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace", "apps/web", "--", "--host"]

# ---------- Build statique (squelette — finalisé en Phase 6) ----------
FROM base AS build
COPY . .
RUN npm run build --workspace apps/web

# ---------- Prod : Nginx sert le build statique ----------
FROM nginx:1.27-alpine AS prod
COPY docker/nginx/web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
