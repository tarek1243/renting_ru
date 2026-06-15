FROM node:22-alpine AS base
RUN apk add --no-cache openssl
RUN npm install -g pnpm@9.15.4
WORKDIR /repo

FROM base AS build
COPY pnpm-workspace.yaml package.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile=false --filter @renting/api --filter @renting/shared
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @renting/shared build && pnpm --filter @renting/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["sh", "-c", "pnpm migrate:deploy && node dist/src/main.js"]
