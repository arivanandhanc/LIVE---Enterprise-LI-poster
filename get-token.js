// get-token.js — Run this ONCE to get your LinkedIn Access Token
// Usage: node get-token.js
// Then follow the instructions printed in terminal

require("dotenv").config();
const express = require("express");
const axios = require("axios");

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3001/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to your .env file first");
  process.exit(1);
}

const app = express();

// Step 1 — Visit this URL in your browser
const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=openid%20profile%20email`;

console.log("\n🔗 STEP 1: Open this URL in your browser:\n");
console.log(authUrl);
console.log("\n⏳ Waiting for LinkedIn to redirect back...\n");

// Step 2 — LinkedIn redirects back with a code, exchange it for token
app.get("/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    res.send(`❌ Error: ${error}`);
    console.error("LinkedIn auth error:", error);
    process.exit(1);
  }

  try {
    const tokenRes = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, expires_in } = tokenRes.data;
    const expiryDays = Math.floor(expires_in / 86400);

    console.log("\n✅ SUCCESS! Your LinkedIn Access Token:\n");
    console.log(access_token);
    console.log(`\n⏱ Token expires in: ${expiryDays} days`);
    console.log("\n📋 Add this to your .env file as:");
    console.log(`LINKEDIN_ACCESS_TOKEN=${access_token}\n`);

    res.send(`
      <h2>✅ Token obtained successfully!</h2>
      <p>Check your terminal for the token.</p>
      <p>Token expires in <strong>${expiryDays} days</strong>.</p>
      <p>You can close this window.</p>
    `);

    setTimeout(() => process.exit(0), 2000);
  } catch (err) {
    console.error("❌ Token exchange failed:", err.response?.data || err.message);
    res.send("❌ Token exchange failed. Check terminal.");
    process.exit(1);
  }
});

app.listen(3001, () => {
  console.log("🟢 Callback server ready on http://localhost:3001");
});
