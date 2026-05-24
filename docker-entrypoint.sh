#!/bin/sh
set -e

# Ensure directories nginx needs at runtime (may be absent in node:alpine)
mkdir -p /run /var/cache/nginx/client_temp /var/log/nginx

# Start nginx and capture its PID so we can verify it stayed up
nginx -g "daemon off;" &
NGINX_PID=$!

sleep 1

if ! kill -0 "$NGINX_PID" 2>/dev/null; then
    echo "[entrypoint] nginx failed to start" >&2
    exit 1
fi

echo "[entrypoint] nginx running (pid $NGINX_PID)"

exec node /app/server.js
