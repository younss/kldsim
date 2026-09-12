# syntax=docker/dockerfile:1
# Build context is the monorepo root (see podman-compose.yml).

FROM node:22-slim AS builder
WORKDIR /workspace

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/llm-gateway/package.json packages/llm-gateway/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
RUN npm run build -w packages/shared

COPY apps/web apps/web
RUN npm run build -w apps/web

# ---------------------------------------------------------------------------
# nginx-unprivileged is purpose-built to run as an arbitrary non-root UID and
# bind a high port, which is exactly what a rootless Podman deployment needs.
FROM nginxinc/nginx-unprivileged:1.27-alpine

# A literal proxy_pass hostname is resolved once at nginx startup and never
# again — see the long comment in the template for why that breaks on an api
# container restart. web-entrypoint.sh renders the template with the
# container's actual DNS resolver IP before nginx starts. Deliberately NOT
# under /etc/nginx/templates/ — that directory is auto-processed by the base
# image's own bundled entrypoint script before this one runs, which would
# render it once with ${RESOLVER_IP} still unset.
COPY infra/containerfiles/web.nginx.conf.template /etc/nginx/default.conf.template
COPY infra/containerfiles/web-entrypoint.sh /docker-entrypoint.d/99-render-upstream.sh
COPY --from=builder /workspace/apps/web/dist /usr/share/nginx/html

USER root
RUN rm -f /etc/nginx/conf.d/default.conf \
  && chmod +x /docker-entrypoint.d/99-render-upstream.sh
USER 10001
EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
