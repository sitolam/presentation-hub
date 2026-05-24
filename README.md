# Presentation Hub

Self-hosted HTML presentation library with a public browsing page and a password-protected admin panel — all in a single Docker Compose stack.

[![CI](https://github.com/sitolam/presentation-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/sitolam/presentation-hub/actions/workflows/ci.yml)
[![Docker](https://github.com/sitolam/presentation-hub/actions/workflows/docker.yml/badge.svg)](https://github.com/sitolam/presentation-hub/actions/workflows/docker.yml)
[![GHCR](https://img.shields.io/badge/ghcr.io-sitolam%2Fpresentation--hub-blue?logo=github)](https://github.com/sitolam/presentation-hub/pkgs/container/presentation-hub)

---

## Features

| | |
|---|---|
| **Public landing page** | `/` — anyone can browse and open presentations |
| **Protected admin panel** | `/admin` — login required to upload and manage |
| **Upload** | Drag-and-drop or file picker, set a display name |
| **Replace** | Upload a new version of an existing presentation in-place |
| **Rename** | Edit the display name inline without a page reload |
| **Delete** | Confirmation dialog before removal |
| **Session auth** | Signed HTTP-only cookies, 8-hour sessions |
| **Docker Compose** | Two services — Nginx + Node/Express API |

---

## Quick start

### Option A — pre-built image (no clone needed)

Create a `docker-compose.yml`:

```yaml
services:
  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "${PORT:-8080}:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./public:/usr/share/nginx/html/public:ro
      - presentations:/usr/share/nginx/html/presentations:ro
    depends_on:
      api:
        condition: service_healthy

  api:
    image: ghcr.io/sitolam/presentation-hub:latest
    restart: unless-stopped
    env_file: .env
    environment:
      - PORT=3000
    volumes:
      - presentations:/data/presentations
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 30s

volumes:
  presentations:
```

Then:

```bash
# 1. Grab the nginx config and frontend from the repo
curl -fsSL https://raw.githubusercontent.com/sitolam/presentation-hub/main/nginx/nginx.conf -o nginx.conf
mkdir -p public
curl -fsSL https://raw.githubusercontent.com/sitolam/presentation-hub/main/nginx/public/index.html -o public/index.html
curl -fsSL https://raw.githubusercontent.com/sitolam/presentation-hub/main/nginx/public/admin.html -o public/admin.html

# 2. Configure
curl -fsSL https://raw.githubusercontent.com/sitolam/presentation-hub/main/.env.example -o .env
# Edit .env — set ADMIN_USERNAME, ADMIN_PASSWORD, and SESSION_SECRET

# 3. Start
docker compose up -d
```

### Option B — clone and build locally

```bash
# 1. Clone
git clone https://github.com/sitolam/presentation-hub.git
cd presentation-hub

# 2. Configure
cp .env.example .env
# Edit .env — set ADMIN_USERNAME, ADMIN_PASSWORD, and SESSION_SECRET

# 3. Generate a strong session secret
openssl rand -hex 32

# 4. Start
docker compose up -d
```

In both cases, open:

```
http://localhost:8080        # public site
http://localhost:8080/admin  # admin panel
```

---

## Configuration

All configuration lives in `.env`:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Host port the app listens on |
| `ADMIN_USERNAME` | `admin` | Admin panel username |
| `ADMIN_PASSWORD` | `changeme` | Admin panel password — **change this** |
| `SESSION_SECRET` | *(dev value)* | Secret for signing session cookies — **change this** |
| `MAX_UPLOAD_MB` | `50` | Maximum upload size in MB |

> **Never commit `.env`** — it is in `.gitignore`.

---

## Project structure

```
presentation-hub/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Build + smoke tests on push/PR
│       └── docker.yml          # Build & push to GHCR on tag
├── api/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js               # Express API (auth + file management)
├── nginx/
│   ├── nginx.conf              # Reverse proxy config
│   └── public/
│       ├── index.html          # Public landing page
│       └── admin.html          # Admin SPA
├── presentations/              # Uploaded HTML files (volume-mounted)
│   └── example.html
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

---

## Architecture

```
Host :8080
┌──────────────────────────────────────────────┐
│  nginx                                       │
│  /               → public/index.html         │
│  /admin          → public/admin.html         │
│  /presentations/ → ./presentations/          │
│  /api/*          → api:3000                  │
└──────────────────────┬───────────────────────┘
                       │ internal network
┌──────────────────────▼───────────────────────┐
│  api  (Node/Express)  :3000                  │
│  POST   /auth/login                          │
│  POST   /auth/logout                         │
│  GET    /auth/me                             │
│  GET    /presentations         (public)      │
│  POST   /presentations         (auth)        │
│  PATCH  /presentations/:file   (auth)        │
│  DELETE /presentations/:file   (auth)        │
└──────────────────────────────────────────────┘
```

---

## API reference

All routes are accessed via the `/api/` prefix (proxied by Nginx).

### Auth

| Method | Path | Body | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | `{ username, password }` | Create session |
| `POST` | `/api/auth/logout` | — | Destroy session |
| `GET` | `/api/auth/me` | — | Check session status |

### Presentations

| Method | Path | Body / Form | Auth | Description |
|---|---|---|---|---|
| `GET` | `/api/presentations` | — | — | List all |
| `POST` | `/api/presentations` | `file`, `name`, `existingFilename?` | required | Upload / replace |
| `PATCH` | `/api/presentations/:filename` | `{ displayName }` | required | Rename |
| `DELETE` | `/api/presentations/:filename` | — | required | Delete |

---

## Docker image

Tagged releases are automatically built and pushed to GHCR:

```bash
docker pull ghcr.io/sitolam/presentation-hub:latest
```

To release a new version, push a semver tag:

```bash
git tag v1.2.3
git push origin v1.2.3
```

---

## Production notes

- Put the stack behind a reverse proxy (Caddy, Traefik, etc.) with **HTTPS**.
- Set `secure: true` on the session cookie in `api/server.js` once HTTPS is in place.
- Use a strong random `SESSION_SECRET` — generate one with `openssl rand -hex 32`.
- Change the default `ADMIN_PASSWORD` before exposing the service publicly.

---

## Development

```bash
cd api
npm install
PRESENTATIONS_DIR=../presentations \
  ADMIN_USERNAME=admin \
  ADMIN_PASSWORD=dev \
  SESSION_SECRET=devsecret \
  node server.js
```

The API runs on `:3000`. Open the HTML files directly in a browser or run `npx serve nginx/public` to serve the frontend.

---

## License

[MIT](LICENSE)
