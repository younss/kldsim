# syntax=docker/dockerfile:1
#
# Build context is the monorepo root (see podman-compose.yml). Multi-stage:
# builder compiles all three TypeScript packages + generates the Prisma
# client against the container's own OS/libc, then the runtime stage copies
# over only what's needed and drops to an unprivileged UID.

FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
FROM base AS builder
WORKDIR /workspace

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/llm-gateway/package.json packages/llm-gateway/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/llm-gateway packages/llm-gateway
COPY apps/api apps/api

# prisma generate only needs a syntactically valid DATABASE_URL at build
# time — it never connects. The real value is injected at container runtime.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

RUN npm run build -w packages/shared \
  && npm run build -w packages/llm-gateway \
  && npm run build -w apps/api

RUN npm prune --omit=dev

# ---------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN groupadd -g 10001 app && useradd -u 10001 -g app -M -s /usr/sbin/nologin app

COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/package.json ./package.json

COPY --from=builder /workspace/packages/shared/dist packages/shared/dist
COPY --from=builder /workspace/packages/shared/package.json packages/shared/package.json

COPY --from=builder /workspace/packages/llm-gateway/dist packages/llm-gateway/dist
COPY --from=builder /workspace/packages/llm-gateway/package.json packages/llm-gateway/package.json

COPY --from=builder /workspace/apps/api/dist apps/api/dist
COPY --from=builder /workspace/apps/api/generated apps/api/generated
COPY --from=builder /workspace/apps/api/prisma apps/api/prisma
COPY --from=builder /workspace/apps/api/package.json apps/api/package.json

RUN chown -R app:app /app
USER app

WORKDIR /app/apps/api
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:4000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
