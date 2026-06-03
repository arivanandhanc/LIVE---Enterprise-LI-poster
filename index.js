// index.js — Enterprise Atlassian Intelligence LinkedIn Publisher v2
// OpenAI-powered | Render deployment | Posts daily at 9 AM IST (3:30 AM UTC)

require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const axios = require("axios");
const cron = require("node-cron");
const crypto = require("crypto");
const { generatePost, getStats } = require("./contentEngine");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── VALIDATE REQUIRED ENV ──────────────────────────────────────────────────
const REQUIRED_ENV = ["LINKEDIN_ACCESS_TOKEN", "LINKEDIN_COMPANY_ID", "OPENAI_API_KEY", "MANUAL_TRIGGER_SECRET"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[FATAL] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

// ─── SECURITY MIDDLEWARE ─────────────────────────────────────────────────────

// Render (and most cloud platforms) sit behind a reverse proxy
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  frameguard: { action: "deny" },
  xssFilter: true,
  referrerPolicy: { policy: "no-referrer" },
}));

app.use(express.json({ limit: "10kb" }));

// Rate limit all public routes
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

// Strict rate limit for admin/trigger endpoints
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

app.use(publicLimiter);

// Strip fingerprinting headers
app.disable("x-powered-by");

// ─── TIMING-SAFE SECRET COMPARISON ──────────────────────────────────────────

function verifySecret(provided) {
  const expected = process.env.MANUAL_TRIGGER_SECRET;
  if (!provided || provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── LINKEDIN POST FUNCTION ──────────────────────────────────────────────────

async function postToLinkedIn(text) {
  const response = await axios.post(
    "https://api.linkedin.com/v2/ugcPosts",
    {
      author: `urn:li:organization:${process.env.LINKEDIN_COMPANY_ID}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      timeout: 15000,
    }
  );
  return response.data;
}

// ─── DAILY POST JOB ─────────────────────────────────────────────────────────
// 9:00 AM IST = 3:30 AM UTC

cron.schedule("30 3 * * *", async () => {
  console.log(`[${new Date().toISOString()}] Cron triggered — generating Atlassian content...`);

  try {
    const generated = await generatePost();
    console.log(`[contentEngine] Pillar: ${generated.pillar} | Topic: ${generated.subtopic}`);
    console.log(`[contentEngine] Angle: ${generated.angle}`);

    const result = await postToLinkedIn(generated.text);
    console.log(`[linkedin] Posted successfully — LinkedIn ID: ${result.id}`);
    console.log(`[stats] Total posted: ${generated.totalPosted} | Combinations remaining: ${generated.uniqueCombinationsRemaining}`);
  } catch (err) {
    const errMsg = err.response?.data || err.message;
    console.error(`[ERROR] Daily post failed:`, JSON.stringify(errMsg));
  }
});

// ─── ROUTES ──────────────────────────────────────────────────────────────────

// Health check — Render uses this to keep the service alive
app.get("/", (req, res) => {
  const stats = getStats();
  res.json({
    status: "running",
    version: "2.0.0",
    engine: "OpenAI GPT-4o",
    contentPillars: stats.pillars.length,
    uniqueCombinations: stats.totalUniqueCombinations,
    estimatedYearsOfContent: stats.estimatedYearsOfContent,
    totalPosted: stats.totalPosted,
    nextPost: "9:00 AM IST daily",
    lastGeneratedAt: stats.lastGeneratedAt || "none yet",
  });
});

// Detailed content stats — public, read-only
app.get("/stats", (req, res) => {
  res.json(getStats());
});

// Manual trigger — POST /post-now (requires x-secret header)
app.post("/post-now", adminLimiter, async (req, res) => {
  if (!verifySecret(req.headers["x-secret"])) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    console.log(`[${new Date().toISOString()}] Manual trigger invoked`);
    const generated = await generatePost();
    console.log(`[contentEngine] Pillar: ${generated.pillar} | Topic: ${generated.subtopic}`);

    const result = await postToLinkedIn(generated.text);
    console.log(`[linkedin] Manual post — LinkedIn ID: ${result.id}`);

    res.json({
      success: true,
      linkedInId: result.id,
      pillar: generated.pillar,
      subtopic: generated.subtopic,
      angle: generated.angle,
      totalPosted: generated.totalPosted,
      previewText: generated.text.slice(0, 120) + "...",
    });
  } catch (err) {
    const errMsg = err.response?.data || err.message;
    console.error(`[ERROR] Manual post failed:`, JSON.stringify(errMsg));
    // Never expose internal error details to clients
    res.status(500).json({ error: "Post failed — check server logs" });
  }
});

// Preview generated content without posting (requires x-secret header)
app.get("/preview", adminLimiter, async (req, res) => {
  if (!verifySecret(req.headers["x-secret"])) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const generated = await generatePost();
    res.json({
      pillar: generated.pillar,
      subtopic: generated.subtopic,
      angle: generated.angle,
      totalPosted: generated.totalPosted,
      text: generated.text,
      characterCount: generated.text.length,
    });
  } catch (err) {
    console.error(`[ERROR] Preview failed:`, err.message);
    res.status(500).json({ error: "Preview failed — check server logs" });
  }
});

// ─── GLOBAL ERROR HANDLER ────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error(`[ERROR] Unhandled:`, err.message);
  res.status(500).json({ error: "Internal server error" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ─── START ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const stats = getStats();
  console.log(`LinkedIn Atlassian Intelligence Publisher running on port ${PORT}`);
  console.log(`Engine: OpenAI ${process.env.OPENAI_MODEL || "gpt-4o"}`);
  console.log(`Content pillars: ${stats.pillars.length}`);
  console.log(`Unique topic combinations: ${stats.totalUniqueCombinations} (~${stats.estimatedYearsOfContent} years)`);
  console.log(`Total posts published: ${stats.totalPosted}`);
  console.log(`Scheduled: 9:00 AM IST daily (3:30 AM UTC)`);
});
