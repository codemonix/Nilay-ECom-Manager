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

# The image has no git history, so the version computed by
# scripts/version.mjs is passed in by whoever builds it (CI does this) and
# read back at runtime by src/config/version.ts. Declared last so a new
# version never invalidates the layers above.
ARG APP_VERSION=
ARG APP_COMMIT=
ARG APP_BUILD_DATE=
ENV APP_VERSION=${APP_VERSION} APP_COMMIT=${APP_COMMIT} APP_BUILD_DATE=${APP_BUILD_DATE}

WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/src/server.js"]
