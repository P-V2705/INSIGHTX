# Authentication with Railway Express Backend

The web app uses the Railway Express OAuth backend (`https://insightx-production-e656a82c.up.railway.app`) for Google and GitHub sign-in with HTTP-only cookies and CSRF protection.

The frontend directly connects to `/api/auth/providers` and `/api/auth/me` with `credentials: 'include'`. In addition, Netlify redirects proxy `/api/*` to the Railway backend to guarantee reliable connectivity across browser environments.

Provider status is dynamically queried from the backend `/api/auth/providers`. Login buttons are activated when confirmed available (`{"google": true, "github": true}`). Clicking a provider initiates OAuth via `/api/auth/start/:provider`, which redirects to the OAuth provider and completes at `/api/auth/callback/:provider`, establishing a session and returning to `/auth/complete`. Sign-out uses `/api/auth/logout` with CSRF validation.
