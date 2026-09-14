/**
 * CITYPULSE — Node.js Express Server
 *
 * Serves EJS templates with Tailwind CSS for the dashboard UI.
 * Proxies /api/* requests to the Python FastAPI backend.
 */

require("dotenv").config();
const express = require("express");
const path = require("path");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = process.env.PORT || 3000;
const API_BACKEND_URL = process.env.API_BACKEND_URL || "http://localhost:8000";

// ─── View Engine ───────────────────────────────────────────────────
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ─── Static Assets ─────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// Serve uploaded evidence photos from the dashboard/uploads directory
app.use(
  "/uploads",
  express.static(path.join(__dirname, "..", "dashboard", "uploads"))
);

// ─── API Proxy ─────────────────────────────────────────────────────
// Proxy all /api requests to the Python FastAPI backend
app.use(
  createProxyMiddleware({
    target: API_BACKEND_URL,
    changeOrigin: true,
    pathFilter: "/api",
    on: {
      proxyReq: (proxyReq, req) => {
        // Forward any auth headers
        if (req.headers["x-admin-token"]) {
          proxyReq.setHeader("x-admin-token", req.headers["x-admin-token"]);
        }
      },
      error: (err, req, res) => {
        console.error("[Proxy Error]", err.message);
        if (!res.headersSent) {
          res.status(502).json({
            error: "Backend API unavailable",
            detail: err.message,
          });
        }
      },
    },
  })
);

// ─── Page Routes ───────────────────────────────────────────────────

// Admin Command Center (default landing)
app.get("/", (req, res) => {
  res.render("admin", {
    title: "CITYPULSE | Urban Intelligence & Road Safety (Mappls Powered)",
    page: "admin",
  });
});
app.get("/admin", (req, res) => {
  res.redirect("/");
});
app.get("/dashboard", (req, res) => {
  res.redirect("/");
});

// Citizen Hazard Reporting Portal
app.get("/report", (req, res) => {
  res.render("report", {
    title: "CITYPULSE | Citizen Road Hazard Reporting Portal",
    page: "report",
  });
});
app.get("/user", (req, res) => {
  res.redirect("/report");
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "citypulse-frontend",
    uptime: process.uptime(),
  });
});

// ─── Start Server ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  ⌁ CITYPULSE Frontend Server`);
  console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`  → API proxy → ${API_BACKEND_URL}`);
  console.log(`  → Views: EJS + Tailwind CSS\n`);
});
