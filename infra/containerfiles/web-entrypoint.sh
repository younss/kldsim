#!/bin/sh
# Runs as part of the base nginx image's own entrypoint chain (every
# executable under /docker-entrypoint.d/ is sourced before nginx starts) —
# it must NOT exec nginx itself, just render the config and return.
set -eu

RESOLVER_IP=$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf)
if [ -z "${RESOLVER_IP:-}" ]; then
  echo "web-entrypoint: could not determine a DNS resolver from /etc/resolv.conf, falling back to 127.0.0.11" >&2
  RESOLVER_IP="127.0.0.11"
fi
export RESOLVER_IP

envsubst '${RESOLVER_IP}' < /etc/nginx/default.conf.template > /etc/nginx/conf.d/default.conf
echo "web-entrypoint: rendered nginx config with resolver ${RESOLVER_IP}"
