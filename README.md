# 🖥️ Presentation Hub

Self-host and manage HTML presentations with a public browsing page and a
password-protected admin panel — all in a single Docker Compose stack.

![CI](https://github.com/sitolam/presentation-hub/actions/workflows/ci.yml/badge.svg)

---

## Features

| | |
|---|---|
| 🌐 **Public landing page** | `/` — anyone can browse and open presentations |
| 🔐 **Protected admin panel** | `/admin` — login required to upload / manage |
| ⬆️ **Upload** | Drag-and-drop or file picker, set a display name |
| 🔄 **Replace** | Upload a new version of an existing presentation in place |
| ✏️ **Rename** | Edit the display name inline without a page reload |
| 🗑️ **Delete** | Confirmation dialog before removal |
| 🍪 **Session auth** | Signed HTTP-only cookies, 8-hour sessions |
| 🐳 **Docker Compose** | Two services — Nginx + Node/Express API |

---

## Quick start

```bash
# 1. Clone
git clone https://github.com/sitolam/presentation-hub.git
cd presentation-hub

# 2. Configure
cp .env.example .env
#    → edit .env: set ADMIN_USERNAME, ADMIN_PASSWORD, SESSION_SECRET

# 3. Generate a strong session secret (recommended)
openssl rand -hex 32

# 4. Start
docker compose up -d

# 5. Open
open http://localhost:8080        # public site
open http://localhost:8080/admin  # admin panel
```

---

## Configuration

All configuration is done via environment variables in `.env`:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Host port the app is exposed on |
| `ADMIN_USERNAME` | `admin` | Admin panel username |
| `ADMIN_PASSWORD` | `changeme` | Admin panel password |
| `SESSION_SECRET` | *(dev value)* | Secret used to sign session cookies — **must be changed in production** |
| `MAX_UPLOAD_MB` | `50` | Maximum file upload size in MB |

> ⚠️ **Never commit `.env`** — it is listed in `.gitignore`.

---

## Project structure

```
presentation-hub/
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions — build + smoke tests
├── api/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js               # Express API (auth + file management)
├── nginx/
│   ├── nginx.conf              # Reverse proxy config
│   └── public/
│       ├── index.html          # Public landing page
│       └── admin.html          # Admin SPA (login + management UI)
├── presentations/              # Uploaded HTML files (mounted as a volume)
│   └── example.html
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

---

## Services

```
┌─────────────────────────────────────────────────┐
│  Host :8080                                     │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │  nginx                                  │    │
│  │  /:8080          → public/index.html    │    │
│  │  /admin          → public/admin.html    │    │
│  │  /presentations/ → ./presentations/     │    │
│  │  /api/*          → api:3000             │    │
│  └──────────────────────┬──────────────────┘    │
│                         │ internal              │
│  ┌──────────────────────▼──────────────────┐    │
│  │  api (Node/Express) :3000               │    │
│  │  POST   /auth/login                     │    │
│  │  POST   /auth/logout                    │    │
│  │  GET    /auth/me                        │    │
│  │  GET    /presentations      (public)    │    │
│  │  POST   /presentations      (auth)      │    │
│  │  PATCH  /presentations/:fn  (auth)      │    │
│  │  DELETE /presentations/:fn  (auth)      │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

---

## API reference

All routes are accessed via `/api/` (proxied by Nginx).

### Auth

| Method | Path | Body | Auth | Description |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | `{ username, password }` | — | Create session |
| `POST` | `/api/auth/logout` | — | — | Destroy session |
| `GET` | `/api/auth/me` | — | — | Check session status |

### Presentations

| Method | Path | Body / Form | Auth | Description |
|---|---|---|---|---|
| `GET` | `/api/presentations` | — | — | List all presentations |
| `POST` | `/api/presentations` | `file`, `name`, `existingFilename?` | ✅ | Upload / replace |
| `PATCH` | `/api/presentations/:filename` | `{ displayName }` | ✅ | Rename |
| `DELETE` | `/api/presentations/:filename` | — | ✅ | Delete |

---

## Production notes

- Put the stack behind a reverse proxy (e.g. Caddy, Traefik) with **HTTPS**.
- Set `secure: true` on the session cookie in `api/server.js` once HTTPS is in place.
- Use a strong random `SESSION_SECRET` (`openssl rand -hex 32`).
- Change the default `ADMIN_PASSWORD` before exposing the service publicly.

---

## Development

```bash
# Run API locally (Node 20+)
cd api
npm install
PRESENTATIONS_DIR=../presentations ADMIN_USERNAME=admin ADMIN_PASSWORD=dev \
  SESSION_SECRET=devsecret node server.js
```

The API runs on `:3000`; open the HTML files directly in a browser or use
`npx serve nginx/public` to serve the front-end.

---

## License

MIT
