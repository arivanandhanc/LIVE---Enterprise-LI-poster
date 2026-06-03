// contentEngine.js — OpenAI-powered Atlassian content generator
// Picks a unique topic from the 10-pillar library and generates LinkedIn-optimized posts

const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
const { PILLARS, CONTENT_ANGLES } = require("./topicLibrary");

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

const HISTORY_FILE = process.env.HISTORY_PATH
  ? path.join(process.env.HISTORY_PATH, "post-history.json")
  : path.join(__dirname, "post-history.json");

// ─── HISTORY ────────────────────────────────────────────────────────────────

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
    }
  } catch {
    console.warn("[contentEngine] Could not load history — starting fresh");
  }
  return { used: [], totalPosted: 0, lastGeneratedAt: null };
}

function saveHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf8");
  } catch (e) {
    console.warn("[contentEngine] Could not save history:", e.message);
  }
}

// ─── TOPIC PICKER ────────────────────────────────────────────────────────────

function pickTopic(history) {
  // Build set of used (pillar::subtopic::angle) combos
  const usedKeys = new Set(history.used.map((u) => `${u.pillar}::${u.subtopic}::${u.angle}`));

  const available = [];
  for (const pillar of PILLARS) {
    for (const subtopic of pillar.subtopics) {
      for (const angle of CONTENT_ANGLES) {
        const key = `${pillar.name}::${subtopic}::${angle}`;
        if (!usedKeys.has(key)) {
          // Push multiple times based on pillar weight for weighted random
          for (let i = 0; i < pillar.weight; i++) {
            available.push({ pillar: pillar.name, subtopic, angle, key });
          }
        }
      }
    }
  }

  // Full cycle complete — reset subtopic+angle history (pillar rotation preserved)
  if (available.length === 0) {
    console.log("[contentEngine] Full topic cycle complete — resetting history");
    history.used = [];
    saveHistory(history);
    return pickTopic(history);
  }

  return available[Math.floor(Math.random() * available.length)];
}

// ─── PROMPT ─────────────────────────────────────────────────────────────────

function buildPrompt(pillar, subtopic, angle, recentContext) {
  return `You are a world-class Atlassian Cloud expert and enterprise architect with 15+ years of hands-on experience across Fortune 500 deployments. You have deep insider knowledge of Atlassian administration, security, AI/Rovo, Forge development, ITSM, DevOps, billing, and enterprise governance.

Write a LinkedIn post that feels like it comes from someone who has personally solved hard enterprise problems — not from someone reading documentation.

PILLAR: ${pillar}
TOPIC: ${subtopic}
ANGLE: Focus specifically on the ${angle}

REQUIREMENTS:
- Hook: First 1-2 lines must stop the scroll (surprising insight, bold statement, or a specific number/fact)
- Content: Share something non-obvious that most admins/architects miss — go beyond official docs
- Be specific: Include real config paths, API endpoints, setting names, CLI commands, or code snippets where relevant
- Audience: Senior Atlassian admins, enterprise architects, IT directors, CISOs, DevOps leads
- Length: 1,600–2,100 characters (optimal LinkedIn reach)
- Format: Short punchy paragraphs, use → or • for lists, 2-4 relevant emojis max (not decorative spam)
- Ending: End with a thought-provoking question OR a specific action the reader can take today
- Hashtags: 5–7 highly targeted hashtags on the last line (Atlassian-specific + broader enterprise)
- Tone: Authoritative, direct, zero fluff — reads like a senior engineer sharing hard-won knowledge

AVOID: Generic best-practice platitudes, obvious tips, repeating official documentation verbatim
INCLUDE: Enterprise scale context, security implications, real gotchas, specific version/feature notes

Recent topics covered — do NOT repeat these exact angles:
${recentContext || "None yet — this is the first post"}

Output ONLY the LinkedIn post text. No intro sentence, no "Here is the post:", just the post itself.`;
}

// ─── GENERATE ────────────────────────────────────────────────────────────────

async function generatePost() {
  const history = loadHistory();
  const topic = pickTopic(history);

  const recentContext = history.used
    .slice(-25)
    .map((u) => `${u.pillar}: ${u.subtopic} (${u.angle})`)
    .join("\n");

  const prompt = buildPrompt(topic.pillar, topic.subtopic, topic.angle, recentContext);

  const completion = await openai.chat.completions.create({
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 900,
    temperature: 0.85,
  });

  const postText = completion.choices[0].message.content.trim();

  // Persist to history
  history.used.push({
    pillar: topic.pillar,
    subtopic: topic.subtopic,
    angle: topic.angle,
    generatedAt: new Date().toISOString(),
  });
  history.totalPosted = (history.totalPosted || 0) + 1;
  history.lastGeneratedAt = new Date().toISOString();
  saveHistory(history);

  const totalCombinations = PILLARS.reduce(
    (sum, p) => sum + p.subtopics.length * CONTENT_ANGLES.length,
    0
  );
  const remaining = totalCombinations - history.used.length;

  return {
    text: postText,
    pillar: topic.pillar,
    subtopic: topic.subtopic,
    angle: topic.angle,
    totalPosted: history.totalPosted,
    uniqueCombinationsRemaining: remaining,
  };
}

function getStats() {
  const history = loadHistory();
  const totalCombinations = PILLARS.reduce(
    (sum, p) => sum + p.subtopics.length * CONTENT_ANGLES.length,
    0
  );
  return {
    totalPosted: history.totalPosted || 0,
    totalUniqueCombinations: totalCombinations,
    used: history.used.length,
    remaining: totalCombinations - history.used.length,
    estimatedYearsOfContent: ((totalCombinations - history.used.length) / 365).toFixed(1),
    lastGeneratedAt: history.lastGeneratedAt,
    pillars: PILLARS.map((p) => ({
      name: p.name,
      topicCount: p.subtopics.length,
      combinations: p.subtopics.length * CONTENT_ANGLES.length,
    })),
  };
}

module.exports = { generatePost, getStats };
