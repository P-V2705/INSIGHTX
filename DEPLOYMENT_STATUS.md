# Insightx Production Deployment Status

Frontend (Netlify): https://insightx-dev.netlify.app
Backend (Railway): https://insightx-production-e656a82c.up.railway.app
GitHub: https://github.com/P-V2705/INSIGHTX

## Required Railway variables (names only)

- `APP_ORIGIN=https://insightx-dev.netlify.app` — must exactly match the Netlify URL.
  It controls CORS and where the user is sent after sign-in.
- `CORS_ALLOWED_ORIGINS` (optional) — extra comma-separated frontend origins.
- `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` — required for cross-site cookies.
- `COOKIE_PARTITIONED=false` — partitioned cookies set during the Railway
  OAuth callback are not visible to the Netlify page.
- OAuth client IDs/secrets and callback URLs stay unchanged.
