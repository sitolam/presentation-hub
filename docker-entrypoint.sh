#!/bin/sh
set -e

# Start nginx in background (daemon off keeps it as a trackable child process)
nginx -g "daemon off;" &

# Node becomes PID 1 via exec; if it exits the container stops
exec node /app/server.js
