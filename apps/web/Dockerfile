# Build context is the repo root (npm workspaces monorepo). This image
# builds the SPA and serves it with Nginx, which also reverse-proxies
# /api/ and /uploads/ to the api container -- see nginx/nginx.conf. Build:
#   docker build -f apps/web/Dockerfile -t nilay-ecom-web --build-arg VITE_API_URL=https://nilay.codemonix.com/api .

FROM node:22-alpine AS build
WORKDIR /repo

# npm ci validates the full workspace topology against package-lock.json,
# so every workspace's package.json must be present even though this image
# only ships apps/web.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY apps/web apps/web

# Baked into the static bundle at build time, so it must already be the
# public URL the browser will use (through the host Nginx + TLS).
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/web

FROM nginx:1.27-alpine AS runtime
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
