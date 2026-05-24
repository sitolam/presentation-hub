FROM node:20-alpine

# Install nginx
RUN apk add --no-cache nginx

WORKDIR /app

# Node deps (cached layer)
COPY api/package.json api/package-lock.json* ./
RUN npm install --omit=dev

# API source
COPY api/server.js ./

# Static frontend files (baked in)
COPY nginx/public /usr/share/nginx/html/public

# nginx site config
COPY nginx/nginx.conf /etc/nginx/http.d/default.conf

# Presentations dir (overridden by volume mount at runtime)
RUN mkdir -p /data/presentations

EXPOSE 80

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

CMD ["docker-entrypoint.sh"]
