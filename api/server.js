"use strict";

const express        = require("express");
const session        = require("express-session");
const multer         = require("multer");
const fs             = require("fs");
const path           = require("path");

// ── Config ────────────────────────────────────────────────────────────────────
const PORT             = 3000;
const PRESENTATIONS_DIR = process.env.PRESENTATIONS_DIR || "/data/presentations";
const ADMIN_USERNAME   = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD   = process.env.ADMIN_PASSWORD || "changeme";
const SESSION_SECRET   = process.env.SESSION_SECRET || "dev-secret-change-in-production";
const MAX_UPLOAD_MB    = parseInt(process.env.MAX_UPLOAD_MB || "50", 10);
const TRUST_PROXY      = process.env.TRUST_PROXY === "1";

if (SESSION_SECRET === "dev-secret-change-in-production") {
  console.warn("[WARN] SESSION_SECRET is not set — use a real secret in production!");
}

fs.mkdirSync(PRESENTATIONS_DIR, { recursive: true });

// ── App setup ─────────────────────────────────────────────────────────────────
const app = express();

if (TRUST_PROXY) app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: TRUST_PROXY,
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────
function safeFilePath(filename) {
  const resolved = path.resolve(PRESENTATIONS_DIR, filename);
  if (!resolved.startsWith(path.resolve(PRESENTATIONS_DIR) + path.sep)) {
    throw new Error("Invalid filename");
  }
  return resolved;
}

function toSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80) || "presentation";
}

function injectDisplayName(html, name) {
  // Remove any existing tag, then prepend a fresh one
  const stripped = html.replace(/<!--\s*display-name:.*?-->\n?/g, "");
  return `<!-- display-name: ${name.replace(/-->/g, "")} -->\n` + stripped;
}

function readDisplayName(html, fallback) {
  const m = html.match(/<!--\s*display-name:\s*(.+?)\s*-->/);
  return m ? m[1] : fallback;
}

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.status(401).json({ error: "Unauthorised" });
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Health (used by Docker healthcheck)
app.get("/health", (req, res) => res.json({ ok: true }));

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post("/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    req.session.username = username;
    return res.json({ ok: true });
  }
  // Consistent response time to prevent timing attacks on the password
  setTimeout(() => res.status(401).json({ error: "Invalid credentials" }), 400);
});

app.post("/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/auth/me", (req, res) => {
  if (req.session?.authenticated) {
    return res.json({ authenticated: true, username: req.session.username });
  }
  res.json({ authenticated: false });
});

// ── Presentations — public read ───────────────────────────────────────────────
app.get("/presentations", (req, res) => {
  try {
    const files = fs
      .readdirSync(PRESENTATIONS_DIR)
      .filter((f) => /\.html?$/i.test(f))
      .map((filename) => {
        const filePath = path.join(PRESENTATIONS_DIR, filename);
        const stat     = fs.statSync(filePath);
        const content  = fs.readFileSync(filePath, "utf8");
        const displayName = readDisplayName(
          content,
          filename.replace(/\.html?$/i, "").replace(/-/g, " ")
        );
        return {
          filename,
          displayName,
          size: stat.size,
          updatedAt: stat.mtime.toISOString(),
          url: `/presentations/${filename}`,
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Presentations — protected writes ─────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    /\.html?$/i.test(file.originalname)
      ? cb(null, true)
      : cb(new Error("Only .html files are allowed"));
  },
});

// Upload (new or replace existing)
app.post("/presentations", requireAuth, upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const displayName = (req.body.name || "").trim();
    if (!displayName) return res.status(400).json({ error: "Display name is required" });

    const existingFilename = (req.body.existingFilename || "").trim();
    let filename;

    if (existingFilename) {
      // Validate path is safe
      safeFilePath(existingFilename);
      filename = existingFilename;
    } else {
      const slug = toSlug(displayName);
      filename = `${slug}.html`;
      let counter = 1;
      while (fs.existsSync(path.join(PRESENTATIONS_DIR, filename))) {
        filename = `${slug}-${counter++}.html`;
      }
    }

    let html = req.file.buffer.toString("utf8");
    html = injectDisplayName(html, displayName);
    fs.writeFileSync(safeFilePath(filename), html, "utf8");

    res.json({
      filename,
      displayName,
      url: `/presentations/${filename}`,
      replaced: !!existingFilename,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rename (display name only — filename stays stable)
app.patch("/presentations/:filename", requireAuth, (req, res) => {
  try {
    const filePath = safeFilePath(req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Not found" });

    const newName = (req.body.displayName || "").trim();
    if (!newName) return res.status(400).json({ error: "displayName required" });

    let html = fs.readFileSync(filePath, "utf8");
    html = injectDisplayName(html, newName);
    fs.writeFileSync(filePath, html, "utf8");

    res.json({ ok: true, filename: req.params.filename, displayName: newName });
  } catch (err) {
    res.status(err.message === "Invalid filename" ? 400 : 500).json({ error: err.message });
  }
});

// Delete
app.delete("/presentations/:filename", requireAuth, (req, res) => {
  try {
    const filePath = safeFilePath(req.params.filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Not found" });
    fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.message === "Invalid filename" ? 400 : 500).json({ error: err.message });
  }
});

// ── Multer error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message });
});

app.listen(PORT, () => console.log(`Presentation Hub API listening on :${PORT}`));
