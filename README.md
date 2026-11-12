# Insightx

Insightx is a browser-first workspace for turning a business dataset into a defensible, downloadable analysis. Signed-in users import a CSV, TSV, XLSX, XLS, or JSON file, inspect what the parser found, choose a focus and numeric measure, read the calculated metrics and charts, then save a final report with CSV and SVG/ZIP exports.

Files are parsed and analyzed in the browser. The Node server exists only for OAuth sign-in and session validation. It never receives dataset rows, files, or report contents.

## Current authentication status

Google and GitHub sign-in are configured for this local development environment through a gitignored `.env`. Apple sign-in was removed from the app.

- `GET /api/auth/providers` currently reports `{ "google": true, "github": true }`.
- Both provider buttons on the login page are enabled.
- The GitHub and Google authorization redirects were verified to use `http://localhost:5180/api/auth/callback/<provider>` with PKCE. A completed provider sign-in still requires the owner to approve the provider consent screen in a browser.
- Workspace routes (`/setup`, `/analysis`, `/report`) require sign-in.
- The About page, login page, and OAuth completion page remain public.

Status per provider:

| Provider | Server flow | Configured locally | Required values |
| --- | --- | --- | --- |
| Google | Implemented (PKCE, state, nonce, JWKS ID-token verification) | Yes | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `APP_ORIGIN` |
| GitHub | Implemented (PKCE, state, `/user` + `/user/emails` verification) | Yes | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, `APP_ORIGIN` |

These client credentials live only in `.env`, which is gitignored and never part of the repository. Any other clone or deployment must supply its own values through secure server settings. Register the callback URLs below before testing sign-in.

A provider is considered configured only when its credentials are present **and** `APP_ORIGIN` (or its explicit callback override) yields a callback URL. See [OAuth provider setup](#oauth-provider-setup).

## Requirements

- Node.js 22.9+ (built with Node 24; the server uses `--env-file-if-exists`)
- npm

## Run locally

```bash
npm install
npm run dev
```

`npm run dev` starts two processes: the OAuth/session API on http://localhost:3001 and Vite on http://localhost:5180. Open http://localhost:5180. Vite proxies `/api` to the API server, so sign-in cookies are set on the same origin you browse.

Without provider credentials the app still builds and runs; the login page will show providers as not configured. This workspace currently has Google and GitHub set in `.env`.

Set local values by copying `.env.example` to `.env` (gitignored) and filling them through your own secret workflow. Do not commit `.env` and do not paste secrets into source files or chat.

Other scripts:

```bash
npm run dev:web      # Vite only
npm run dev:server   # API only, no static files
npm run build        # create dist/
npm start            # serve API + dist/
```

## Production build

```bash
npm run build
```

Then run the server with production settings:

```bash
NODE_ENV=production APP_ORIGIN=https://your-domain.example SESSION_SECRET=... npm start
```

In production the server serves `dist/` itself, so the app and the OAuth endpoints share one origin. Requirements:

- HTTPS termination in front of the server (`TRUST_PROXY=true` when a reverse proxy sets `X-Forwarded-*`).
- `APP_ORIGIN` set to the public HTTPS origin. A production HTTP origin disables providers rather than weakening cookie security.
- `COOKIE_SECURE` must remain true; the server refuses to start in production if `COOKIE_SECURE=false` is supplied.

`npm run preview` is an alias for `npm start`; it requires a prior build and the same environment settings. Without `APP_ORIGIN` and `SESSION_SECRET`, the build works but sign-in stays unavailable.

## What is implemented

### About (`/`)

Product explanation, audience, the four connected stages, a live illustrative preview computed from the built-in sample, local-only privacy wording, and primary/secondary calls to action.

### Sign in (`/login`)

The main entry to the workspace. Signed-out visitors can read the About page and open the login page, but cannot reach Setup, Analysis, or Report.

1. Choosing Google or GitHub navigates to `/api/auth/start/<provider>`, which sets a short-lived signed state cookie and redirects to the provider's own authorization page (with PKCE S256, plus an OIDC nonce for Google).
2. The provider sends the browser back to `/api/auth/callback/<provider>`. The server validates the state cookie, state parameter, nonce where applicable, code, token response, and identity token or profile response.
3. Only after the provider response is verified does the server create an opaque, HttpOnly session and redirect to `/auth/complete`. That page polls the server until the session is confirmed, shows a brief branded loading animation, and then opens the originally requested workspace route.
4. Cancel or provider failure returns to `/login` with a plain-language error and the provider buttons available for another attempt.

Requested routes are preserved. Visiting `/analysis` while signed out redirects to `/login?next=%2Fanalysis`, and a successful sign-in returns to `/analysis`. Only same-origin workspace paths are accepted as return targets; anything else falls back to `/setup`.

Signing out posts to `/api/auth/logout` with an Origin check and CSRF double-submit token, destroys the server session, clears the session/CSRF/state cookies, and returns to `/login`. The local dataset and saved report stay in the browser unless you also choose "Start a new session".

### OAuth provider setup

All configuration is server-side. Prefix values with `VITE_` and they would be exposed in the client bundle, so never do that for any value below. The server reads these from the process environment or `.env` through `--env-file-if-exists`.

#### Required server settings

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_ORIGIN` | Yes for sign-in | Public origin of the app; callback URLs derive from it. Defaults to `http://localhost:5180` in development only. |
| `SESSION_SECRET` | Yes | At least 32 characters; signs OAuth state cookies. Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. |
| `COOKIE_SECURE` | No | Defaults to true in production and for HTTPS origins. Set false only for local plain HTTP. |
| `COOKIE_SAMESITE` | No | `lax` (default), `strict`, or `none`. `none` requires secure cookies and HTTPS. |
| `COOKIE_DOMAIN` | No | Optional parent cookie domain, e.g. `example.com`. Leave empty for host-only cookies. |
| `COOKIE_PARTITIONED` | No | `true` enables CHIPS for third-party embedded previews; requires HTTPS. |
| `EMBED_ALLOW_ORIGINS` | No | Comma-separated HTTPS origins allowed to frame the app (CSP `frame-ancestors`). |
| `PORT` | No | API/static server port; defaults to `3001`. |
| `SERVE_STATIC` | No | Defaults to true. Set false when Vite serves the frontend in development. |
| `TRUST_PROXY` | No | Set true behind a TLS-terminating reverse proxy. |

#### Exact callback URLs

Register these exact URLs with each provider. They are derived from `APP_ORIGIN` unless an explicit override is set.

| Provider | Local development | Production |
| --- | --- | --- |
| Google | `http://localhost:5180/api/auth/callback/google` | `https://YOUR_DOMAIN/api/auth/callback/google` |
| GitHub | `http://localhost:5180/api/auth/callback/github` | `https://YOUR_DOMAIN/api/auth/callback/github` |

Overrides `GOOGLE_CALLBACK_URL` and `GITHUB_CALLBACK_URL` can replace the derived URL, but the value registered with the provider must match exactly.

#### Google

1. Create an OAuth 2.0 Client ID of type "Web application" in Google Cloud Console.
2. Add the callback URL above under "Authorized redirect URIs".
3. Supply `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

The server verifies the ID token signature against the Google JWKS, the issuer (`accounts.google.com` or `https://accounts.google.com`), the audience, the nonce, and expiry.

#### GitHub

1. Create an OAuth App under GitHub Developer settings.
2. Set "Authorization callback URL" to the callback URL above.
3. Supply `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

The server exchanges the code, reads `GET /user` and `GET /user/emails`, prefers a verified primary email, and uses the stable numeric account ID. If no verified email is available, sign-in fails with a clear error rather than showing an unverified address.

#### Cookies for the embedded preview

For an HTTPS cross-site embedded preview, use `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`, and `COOKIE_PARTITIONED=true` where the embedding browser requires CHIPS. Add the parent preview origin to `EMBED_ALLOW_ORIGINS` so CSP allows framing. These settings are opt-in; production defaults stay `Secure` + `SameSite=Lax` and are not weakened to make a preview work. The preview origin must still be listed as an allowed redirect/callback origin pattern where the provider supports it.

#### Security model

- OAuth state is a random value in an HMAC-signed, HttpOnly, short-lived cookie (10 minutes) and is compared with `timingSafeEqual`. The return path is sanitized to `/setup`, `/analysis`, or `/report`.
- PKCE S256 is used for both providers. Google also validates an OIDC nonce. Provider responses are validated server-side; the client never asserts success.
- Sessions are opaque random IDs stored hashed (SHA-256) in server memory, delivered in an HttpOnly cookie with `Secure` and `SameSite` settings, and expiring after 7 days.
- Sign-out requires a matching CSRF token and an allowed `Origin`. The API sets CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` headers and applies basic per-IP rate limits to auth endpoints.
- Errors shown to users map to short codes such as "cancelled", "provider_error", or "state_invalid"; tokens, secrets, stack traces, and account details are never rendered.
- Datasets are not part of any OAuth request. Dataset parsing, analysis, and report storage remain local.

Sign-in establishes identity only. There are no roles, no cloud dataset storage, and no server-side report storage.

#### Session limitations

Sessions live in server memory. Restarting the server signs everyone out, and multiple server instances would not share sessions without a shared store. That is intentional for this single-instance setup; do not claim durable sessions across restarts.

### Session setup (`/setup`)

- Drag-and-drop or file-picker import for `.csv`, `.tsv`, `.xlsx`, `.xls`, and `.json`
- Delimiter and encoding handling for delimited text; first populated worksheet for workbooks
- Automatic header detection, type inference (numeric, date, category, text), populated/distinct counts, and readable previews
- Column profile, blank-cell accounting, completeness band, and session activity log
- Analysis focus (growth, performance drivers, segment mix, data quality), primary numeric measure, total/average aggregation, optional group comparison, and trend axis
- Optional source-reference URL for datasets obtained elsewhere (for example a Kaggle download). The URL is stored as a label only. Insightx does not download, scrape, or bypass access controls on that link.
- Import limits stated up front and enforced: **5,000 rows**, **15 MB**, **80 fields**. Larger files are rejected by size or truncated to the first 5,000 rows with a visible warning and log entry.
- Malformed, empty, unsupported, and unreadable files fail with a specific message while keeping the current session intact.

### Analysis (`/analysis`)

- Total and average for the chosen measure, peak record, and first-to-last change when the data allows it
- Trend chart grouped by day, month, or quarter, or by record order when no date field exists
- Category comparison and share analysis when a suitable group field exists
- Completeness gauge with blank-cell and record counts
- Plain-language findings derived only from the imported rows, including outlier and concentration observations when supported
- Editable measure, aggregation, focus, comparison, and trend settings
- Explicit unavailable states when there is not enough data for a change, trend, comparison, or insight
- A method-notes panel explaining exclusions, blanks, and calculation rules

No forecasts, estimates, or invented values are shown.

### Final report (`/report`)

- Frozen snapshot of the finalized analysis, saved in browser storage
- “Download summary CSV” with session details, measures, chart series, category shares, findings, and method notes
- “Download chart set” ZIP containing three editable SVG charts, a method read-me, and a copy of the summary CSV
- Visible notice that the report lives in this browser only and that there is no account-based cloud storage
- “Start a new session” clears the local dataset, configuration, activity log, and saved report after confirmation

### Navigation and persistence

Routes use client-side navigation with two layers of gating:

- **Sign-in:** the workspace layout is wrapped by `RequireAuth`. Signed-out visitors are redirected to `/login?next=<requested path>`, and the return path is preserved through the OAuth callback. When the built app is served by the Node server, protected document requests such as `/setup` are also redirected server-side before `index.html` is sent.
- **Stages:** analysis requires a prepared dataset, and the report requires a finalized snapshot.

The dataset, configuration, activity log, and saved report are written to `localStorage` under `insightx.session.v1`, so reloading keeps the analysis. Clearing the site's data removes it. The app shows a warning if browser storage is unavailable or full. The server session is separate from this local data and does not contain any dataset content.

## Data handling and privacy

- Imported files never leave the browser. There are no upload requests, analytics beacons, or third-party data processors in this code.
- The API server handles only OAuth redirects, provider verification, sessions, and sign-out. No dataset rows, file names, report contents, or analysis values are sent to it.
- Parsed rows are kept in memory and persisted to `localStorage` for session continuity.
- Signing out clears the server session and auth cookies but intentionally leaves the local dataset in the browser unless you choose "Start a new session".
- Anyone with access to the same browser profile can read the saved session. Treat shared devices accordingly.
- The app does not validate whether recorded values are correct; completeness measures populated cells only.
- CSV exports use a UTF-8 byte-order mark and prefix formula-leading cells to reduce spreadsheet formula-injection risk.

## Exports

- Summary CSV: one file per report, including report metadata, dataset facts, configuration, metrics, trend points, category shares, findings, and method notes.
- Chart set ZIP: standalone `trend.svg`, `category-comparison.svg`, `completeness.svg` (charts that exist in the report), plus `README.txt` and `summary.csv`.
- Exported SVGs are self-contained and editable in vector tools.

## Built-in sample

The sample is a deterministic 24-month B2B sales dataset (216 rows × 11 fields) generated inside the app. It includes realistic blank cells so completeness and exclusion behavior are visible. It is fictional and is not customer data.

## Hosting

Insightx is no longer a static-only site. Sign-in requires the Node server in `server/`, and production should run it behind HTTPS.

- Build with `npm run build`, then run `npm start` with `NODE_ENV=production`, `APP_ORIGIN=https://your-domain.example`, and `SESSION_SECRET` set.
- The server serves `dist/` and handles `/api/*`. It applies an SPA fallback for client routes, but redirects protected document routes (`/setup`, `/analysis`, `/report`) to `/login?next=...` when there is no valid session.
- A static host without a Node runtime can serve the frontend, but OAuth callbacks and sessions will not work. Do not deploy the static build and claim sign-in is active.
- If the API runs on a different host than the frontend, you must also proxy `/api` on the app origin; otherwise the HttpOnly session cookie will not apply to the app.
- `public/_redirects` and `public/routes.json` are only relevant to static SPA hosting checks. On Netlify-style hosts they do not replace the auth server.
- Configure the exact callback URLs listed in [OAuth provider setup](#oauth-provider-setup) for the deployed origin.

## Project structure

```text
server/                       OAuth/session server
  index.js                    Express app, routes, static serving, headers
  config.js                   environment parsing, origins, cookie policy
  oauth.js                    provider flows, state, PKCE, token/identity checks
  session.js                  session store and cookie helpers
shared/
  nextPath.js                 return-path sanitization (client + server)
scripts/
  dev.mjs                     runs API + Vite together
src/
  App.jsx                     routes, public pages, auth-gated workspace
  main.jsx                    providers, fonts, global styles
  auth/                       AuthProvider, RequireAuth, loading screen
  pages/                      About, Login, AuthComplete, Setup, Analysis, Report, NotFound
  components/                 shared UI, workspace shell, charts
  lib/
    importDataset.js          file parsing and validation
    dataset.js                dataset model and import limits
    profile.js                field profiling and type inference
    analysis.js               measures, trends, categories, findings
    report.js                 saved report snapshots
    exports.js                CSV and SVG/ZIP downloads
    storage.js                localStorage persistence
    sample.js                 built-in deterministic sample
  session/                    local analysis session provider and state
  styles/                     base, page, auth, and chart styles
public/                       favicon, SPA fallback, route manifest
.env.example                  documented server variables (no secrets)
```

## Tech stack

React 19, React Router 7, Vite 8, Express 5, `jose` 6, PapaParse, `@e965/xlsx`, `fflate`, `@fontsource` Inter and JetBrains Mono. Charts are custom responsive SVG components with no charting dependency. OAuth uses the provider authorization-code flow with PKCE S256, server-side token exchange, and ID-token/JWKS verification.

## Accessibility and responsive behavior

Visible keyboard focus, native confirmation dialogs, skip links, labelled controls, status announcements for imports and downloads, alert/status semantics for sign-in errors, reduced-motion support, and responsive layouts for desktop, tablet, and narrow mobile screens. The auth loading screen and disabled provider states are exposed to assistive technology.

## Known limitations

- A completed Google or GitHub sign-in has not been verified from this environment; the authorization redirects and callbacks are configured, but the provider consent step still requires a browser sign-in.
- Sessions are stored in memory; a server restart signs users out, and multiple server instances would require a shared session store.
- Sign-in establishes identity only. There are no roles, admin controls, account profiles, or cloud-synced datasets.
- No data validation beyond type inference and completeness.
- Workbook import reads the first populated worksheet only.
- Category comparisons fold smaller groups into “Other” when there are many groups.
- The report is a frozen snapshot; change the dataset or analysis configuration and finalize again to update it.
#   I N S I G H T X  
 