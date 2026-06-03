# LinkedIn Daily Auto Poster

Auto-posts to your LinkedIn Company Page daily at 9 AM IST. Deploys free on Render.

---

## Setup (One Time)

### Step 1 — Get your LinkedIn credentials

1. Go to https://developer.linkedin.com/ → your app → **Auth** tab
2. Copy **Client ID** and **Client Secret**
3. Add redirect URL: `http://localhost:3001/callback`

### Step 2 — Get your Access Token (run locally once)

```bash
# Add to .env first:
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret

node get-token.js
# Opens browser → log in → token printed in terminal
```

Copy the token into your `.env` as `LINKEDIN_ACCESS_TOKEN`

### Step 3 — Get your Company Page ID

Go to your LinkedIn Company Page → look at URL:
`linkedin.com/company/12345678/` → `12345678` is your ID

Add to `.env` as `LINKEDIN_COMPANY_ID`

### Step 4 — Add your posts

Edit `posts.js` — each object is one day's post. Add as many as you want.

### Step 5 — Deploy to Render

1. Push this folder to a GitHub repo
2. Go to https://render.com → New Web Service → connect your repo
3. Add environment variables (from your `.env`) in Render dashboard
4. Deploy — it posts every day at 9 AM IST automatically

---

## Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Health check + stats |
| `/status` | GET | All posts + status |
| `/post-now` | POST | Manual trigger (header: `x-secret`) |

## Manual trigger (testing)

```bash
curl -X POST https://your-render-url.onrender.com/post-now \
  -H "x-secret: your_manual_trigger_secret"
```

---

## Notes

- Token expires in ~60 days — re-run `get-token.js` to refresh
- Free Render plan sleeps after 15 min inactivity — use UptimeRobot to ping `/` every 10 min
- Add more posts to `posts.js` anytime — no redeploy needed if using env vars
