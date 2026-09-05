# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# GCC Explorer — static site, built once and served by nginx.
#
#   docker compose up --build          production build on http://localhost:8080
#   docker compose --profile dev up    Vite dev server on http://localhost:5173
#
# The dataset under public/data is committed to the repository, so this image
# never needs Docker-in-Docker or a compiler: regenerating the data is a local,
# occasional task (see tools/extract/collect.sh).
# ---------------------------------------------------------------------------

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig*.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}
RUN npm run build

# --- development ------------------------------------------------------------
FROM node:22-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# --- production -------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
LABEL org.opencontainers.image.title="GCC Explorer" \
      org.opencontainers.image.description="Explore, compare and export every GCC compile and link option, GCC 8 to 15." \
      org.opencontainers.image.licenses="MIT"
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
