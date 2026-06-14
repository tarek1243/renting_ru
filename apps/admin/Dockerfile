FROM node:22-alpine AS base
RUN npm install -g pnpm@9.15.4
WORKDIR /repo

FROM base AS build
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/admin/package.json apps/admin/
RUN pnpm install --frozen-lockfile=false --filter @renting/admin --filter @renting/shared
COPY packages/shared packages/shared
COPY apps/admin apps/admin
RUN pnpm --filter @renting/shared build && pnpm --filter @renting/admin build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo/apps/admin
EXPOSE 3100
CMD ["pnpm", "start"]
