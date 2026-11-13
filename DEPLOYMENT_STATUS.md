# Insightx Production Deployment Status

Frontend (Netlify): https://insightx-dev.netlify.app
Backend (Railway): https://insightx-production-e656a82c.up.railway.app
GitHub: https://github.com/P-V2705/INSIGHTX

## Required Railway variables

All authentication traffic (sign-in, OAuth callback, /api/auth/me, logout) flows through the Netlify proxy (/api/* -> Railway), ensuring cookies are first-party to insight-dev.netlify.app and not blocked by browsers.

**Critical Railway environment variables:**

- `APP_ORIGIN=https://insightx-dev.netlify.app` — The frontend URL. Must match exactly. Controls CORS, OAuth redirects, and where users land after sign-in.
  
- `GOOGLE_CALLBACK_URL=https://insightx-dev.netlify.app/api/auth/callback/google` — OAuth callback. Must match the URL registered with Google.
  
- `GITHUB_CALLBACK_URL=https://insightx-dev.netlify.app/api/auth/callback/github` — OAuth callback. Must match the URL registered with GitHub.

- `COOKIE_SECURE=true` — Required for HTTPS (production). Prevents cookies over unencrypted connections.

- `COOKIE_PARTITIONED=false` — Do not partition cookies. Partitioned cookies set on Railway domain are invisible to Netlify pages.

- `COOKIE_SAMESITE` — Leave unset or set to `lax` (default). Use `none` only if testing cross-site scenarios (requires `COOKIE_SECURE=true`).

- `SESSION_SECRET` (32+ characters) — Session signing. Generate a random string, keep it secret.

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — From Google OAuth Console. Update callback URL to https://insightx-dev.netlify.app/api/auth/callback/google.

- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — From GitHub OAuth. Update callback URL to https://insightx-dev.netlify.app/api/auth/callback/github.

**Frontend build variables:**

- `VITE_API_URL` — Leave unset on Netlify. The frontend will use empty API_BASE (routes all requests through the same-origin proxy).
  - Only set `VITE_API_URL=http://localhost:3001` for local development against a local Railway server.

## How it works

1. Frontend calls `/api/auth/me` (relative URL)
2. Netlify proxy intercepts: `/api/*` → `https://insightx-production-e656a82c.up.railway.app/api/:splat`
3. Railway backend receives request, validates session, returns user + CSRF token
4. Railway sets `Set-Cookie: insightx_sid=...` with `Domain=` (empty, means current domain in response)
5. Browser receives response from Netlify origin, stores cookie as first-party to insight-dev.netlify.app
6. Next request includes the cookie automatically (same-origin)
7. No third-party cookie blocking, authentication works

## Diagnosing "Your session could not be confirmed. Sign in again."

If this error appears after OAuth redirect:

1. Check Railway `APP_ORIGIN` — must be exactly `https://insightx-dev.netlify.app`
2. Check OAuth callback URLs on Railway — must match Google/GitHub registered URLs
3. Check OAuth callback URLs registered with Google/GitHub — must be `https://insightx-dev.netlify.app/api/auth/callback/{google,github}`
4. Verify `COOKIE_SECURE=true` in production (HTTPS only)
5. Inspect Network tab in DevTools — does `/api/auth/me` include the `insightx_sid` cookie? If not, cookies are not round-tripping

`GET /api/health` on Railway reports which settings are configured.
