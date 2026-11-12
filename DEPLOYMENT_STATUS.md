# Insightx Production Deployment Status

Frontend (Netlify): https://insightx-dev.netlify.app
Backend (Railway): https://insightx-production-e656a82c.up.railway.app
GitHub: https://github.com/P-V2705/INSIGHTX

## Required Railway variables (names only)

- `APP_ORIGIN=https://insightx-dev.netlify.app` — must exactly match the Netlify URL (defaults to it in production).
  It controls CORS and where the user is sent after sign-in.
- `CORS_ALLOWED_ORIGINS` (optional) — extra comma-separated frontend origins.
- `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true` — required for cross-site cookies.
- `COOKIE_PARTITIONED=false` — partitioned cookies set during the Railway
  OAuth callback are not visible to the Netlify page.
- OAuth client IDs/secrets and callback URLs stay unchanged.

## Defaults when variables are missing

In production the server now falls back to `APP_ORIGIN=https://insightx-dev.netlify.app`,
derives OAuth callback URLs from Railway's automatic `RAILWAY_PUBLIC_DOMAIN`
(`https://<railway-domain>/api/auth/callback/{google,github}`), and uses
`SameSite=None; Secure` cookies when frontend and API hosts differ. Explicit
variables always take precedence.

`SESSION_SECRET` (32+ characters) and the Google/GitHub client ID + secret
must still be set on Railway — they are never defaulted.

## Diagnosing "Setup required"

`GET /api/health` on the Railway API reports the public app origin and cookie mode, and as booleans only whether the
origin, session secret and each provider's client ID / secret / callback are
present. Any `false` there is the variable to set on Railway.
