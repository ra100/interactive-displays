# syntax=docker/dockerfile:1.7
# One image, one process, one port: the server serves the built app, Socket.io and the API.
# The server runs TypeScript directly (Node type stripping), so only the app needs a build step.

ARG NODE_IMAGE=node:24-slim

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# Workspace manifests only, so dependency layers are cached until a package.json changes.
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/themes/package.json packages/themes/
COPY packages/server/package.json packages/server/
COPY packages/app/package.json packages/app/

FROM manifests AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts
COPY packages packages
RUN pnpm --filter @interactive-displays/app build

# Production dependencies for the server and the workspace packages it imports, nothing else.
FROM manifests AS runtime-files
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts --filter "@interactive-displays/server..."
COPY packages/core/src packages/core/src
# The server imports only the theme manifests (plain data); the renderers ship in the app build.
COPY packages/themes/src packages/themes/src
COPY packages/server/src packages/server/src
COPY packages/server/seed packages/server/seed
COPY --from=build /repo/packages/app/dist packages/app/dist

FROM ${NODE_IMAGE}
ENV NODE_ENV=production \
    PORT=3010 \
    HOST=0.0.0.0 \
    DATA_DIR=/data
WORKDIR /app
# Keep the workspace layout: pnpm's symlinks must resolve to real paths outside node_modules
# for Node to strip types from the workspace packages.
COPY --from=runtime-files --chown=node:node /repo /app
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3010
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3010) + '/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "packages/server/src/index.ts"]
