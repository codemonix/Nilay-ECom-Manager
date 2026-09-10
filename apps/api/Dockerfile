# Build context is the repo root (this is an npm-workspaces monorepo, so
# the API build needs the root package.json/lockfile and packages/shared
# alongside apps/api). Build with:
#   docker build -f apps/api/Dockerfile -t nilay-ecom-api .

FROM node:22-alpine AS build
WORKDIR /repo

# npm ci validates the full workspace topology against package-lock.json,
# so every workspace's package.json must be present even though this image
# only ships apps/api.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/api

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages/shared/package.json packages/shared/package.json
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/api/package.json apps/api/package.json
COPY --from=build /repo/apps/api/dist apps/api/dist

WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/src/server.js"]
