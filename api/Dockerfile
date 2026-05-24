FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --production

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
