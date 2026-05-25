# Changelog

All notable changes to this project will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [2.0.0] - 2026-05-25

### Added
- HTTPS support via reverse proxy — new `TRUST_PROXY=1` env var sets Express `trust proxy` and enables `secure` session cookies when the app sits behind a TLS-terminating proxy.
- `docs/admin-preview.html` — self-contained admin UI preview that works without a running backend, useful for design review.

### Changed
- Public landing page fully redesigned: dark mode with animated glow orbs, dot-grid background, gradient heading, and glassmorphism presentation cards with scan-line hover effect (Syne + JetBrains Mono).
- Admin login wired with `addEventListener` instead of inline `onclick` attributes; boot IIFE now has a `try/catch` so the login form is always shown even if the API is unreachable.
- Internal Node API port hardcoded to `3000` in `server.js` — it was never intended to be user-configurable and was causing confusion with the host-side `PORT` variable.
- `docker-compose.yml` `environment: PORT=3000` block removed; `PORT` in `.env` now unambiguously refers to the host port only.
- README updated: screenshots section, HTTPS section, config table includes `TRUST_PROXY`, project structure reflects `docs/`.

### Fixed
- Healthcheck URL in the Option A `docker-compose.yml` README snippet corrected to `http://127.0.0.1/api/health` (was `localhost`).

---

## [1.2.0] - 2026-05-24

### Changed
- Merged nginx and Node/Express into a single Docker image — nginx is installed via `apk` in the `node:20-alpine` base and started by `docker-entrypoint.sh` alongside the API. Removes the two-container dependency and simplifies deployment to a single `docker compose up`.
- `docker-compose.yml` collapsed from two services (`nginx` + `api`) to one (`app`).
- Build context for the GHCR workflow changed from `./api` to `.` (repo root).
- README Quick Start updated with a single-image `docker-compose.yml` example that requires no local clone.

### Fixed
- Healthcheck now probes `http://127.0.0.1/api/health` (explicit IPv4) — Alpine resolves `localhost` to `::1` (IPv6) and nginx was only bound to `0.0.0.0:80`, so the previous probe got connection refused.
- Added `listen [::]:80` to nginx so both IPv4 and IPv6 are covered.
- nginx errors now route to stderr via `error_log stderr warn` — previously they were written to `/var/log/nginx/error.log` and invisible in `docker logs`.
- `nginx.conf` is now a self-contained full config copied to `/etc/nginx/nginx.conf` directly, removing reliance on Alpine's include path (`http.d` vs `conf.d` varies by version).
- `nginx -t` added to the Dockerfile so config errors fail the image build immediately rather than surfacing only at healthcheck time.
- Runtime directories (`/run`, `/var/cache/nginx/client_temp`, `/var/log/nginx`) created in the entrypoint — they may be absent in `node:20-alpine` and caused nginx to silently crash on start.

---

## [1.1.0] - 2026-05-24

### Added
- GHCR workflow (`.github/workflows/docker.yml`) — builds and pushes the API image to `ghcr.io/sitolam/presentation-hub` on every semver tag push (`v*.*.*`), with GHA layer caching and automatic `latest`, `major.minor`, and `major` tag aliases.
- `CHANGELOG.md` — this file.

### Fixed
- API port conflict — `PORT=8080` from `.env` was being passed to the API container via `env_file`, so the server started on `:8080` while the healthcheck probed `:3000`, causing the container to always be unhealthy. The api service now pins `PORT=3000` via `environment`, which takes precedence over `env_file`; the nginx host port mapping reads `PORT` from compose variable substitution and is unaffected.
- CI unhealthy container failure — `docker compose up -d` was starting nginx and the API together; nginx has `depends_on: condition: service_healthy` so it aborted immediately if the API health check had not yet passed. The CI now starts the API first, waits up to 90 s for it to become healthy (with log output on failure), then starts nginx.
- Healthcheck timing in `docker-compose.yml` tightened: `interval` reduced from 15 s to 5 s and `start_period` raised from 10 s to 30 s so the container has enough time to initialise while still detecting real failures quickly.

---

## [1.0.0] - 2026-05-24

### Added
- Public landing page (`/`) — lists all uploaded presentations sorted by last modified.
- Admin panel (`/admin`) — password-protected SPA for uploading, replacing, renaming, and deleting presentations.
- Express API with session-based auth (HTTP-only cookies, 8-hour TTL), upload via `multer`, path-traversal protection, and a `/health` endpoint.
- Nginx reverse proxy — serves static files, proxies `/api/*` to the Node container, and adds security headers.
- Docker Compose stack — two services (nginx + api) with a volume-mounted `presentations/` directory.
- CI workflow (`.github/workflows/ci.yml`) — builds the stack and runs smoke tests on every push and pull request to `main`.
- `.env.example` with documented configuration variables.
- `example.html` seed presentation.

[Unreleased]: https://github.com/sitolam/presentation-hub/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/sitolam/presentation-hub/compare/v1.2.0...v2.0.0
[1.2.0]: https://github.com/sitolam/presentation-hub/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/sitolam/presentation-hub/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/sitolam/presentation-hub/releases/tag/v1.0.0
