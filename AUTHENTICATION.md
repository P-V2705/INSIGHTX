# Authentication on Netlify

The web app uses `@netlify/identity` for Google and GitHub sign-in. It no longer calls the legacy Express authentication endpoints or the Render service. Existing Express environment variables and sessions do not configure this login flow; users sign in again through Identity.

The Identity activation marker is included for deployment. The login page reads Identity settings and enables each provider only when the service reports it enabled. OAuth callbacks are processed on application startup, including callbacks returning to the home page. The requested workspace destination is preserved in session storage and validated before navigation. Identity manages session restoration, refresh, and sign-out.

After deployment, verify that Google and GitHub are enabled under the project's Identity external provider settings. If custom OAuth applications are used, their callback URL is `https://insightx-dev.netlify.app/.netlify/identity/callback`. Configure credentials only in the secure provider settings, never in source code or browser environment variables.

Use Netlify Dev for local testing so the `/.netlify/identity` endpoint is available. The legacy standalone Express server does not emulate Identity.

Verify each provider in a browser: start sign-in, approve access, confirm the requested workspace opens, reload to check session restoration, then sign out and confirm workspace routes require sign-in again. Also check provider cancellation and retry. Source checks alone cannot verify consent screens or provider credentials.
