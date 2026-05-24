FROM node:20-alpine

RUN apk add --no-cache nginx

WORKDIR /app

COPY api/package.json api/package-lock.json* ./
RUN npm install --omit=dev

COPY api/server.js ./

COPY nginx/public /usr/share/nginx/html/public

# Replace Alpine's default nginx.conf entirely — no include-path guessing
COPY nginx/nginx.conf /etc/nginx/nginx.conf

RUN mkdir -p /data/presentations && \
    # Validate config at build time so errors surface here, not in the healthcheck
    nginx -t

EXPOSE 80

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

CMD ["docker-entrypoint.sh"]
