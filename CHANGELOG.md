# Changelog

All notable changes to this project will be documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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

[Unreleased]: https://github.com/sitolam/presentation-hub/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/sitolam/presentation-hub/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/sitolam/presentation-hub/releases/tag/v1.0.0
