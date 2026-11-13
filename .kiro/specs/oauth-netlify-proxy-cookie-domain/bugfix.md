# Bugfix Requirements Document

## Introduction

OAuth sign-in (Google and GitHub) on https://insightx-dev.netlify.app fails during the OAuth callback phase because auth state and session cookies are set on the wrong domain (Railway backend) instead of the correct domain (Netlify frontend). The fix requires ensuring all auth requests use relative URLs through the same-origin Netlify proxy (`/api/*`), which are transparently rewritten to the Railway backend. This guarantees cookies are first-party to insightx-dev.netlify.app, not third-party to the Railway domain.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the frontend calls `/api/auth/start/{provider}` as a direct request to the Railway API (because `API_BASE` defaults to `https://insightx-production-e656a82c.up.railway.app`) THEN the OAuth state cookie (`insightx_oauth_{provider}`) is set on the railway.app domain, not the Netlify domain.

1.2 WHEN the OAuth provider redirects back to `https://insightx-dev.netlify.app/api/auth/callback/{provider}` (which is routed through the Netlify proxy to Railway) THEN the browser cannot send the OAuth state cookie because it was set on the Railway domain and is now blocked as a third-party cookie.

1.3 WHEN the Railway backend receives the OAuth callback without the state cookie THEN it returns `state_invalid` error, and the app displays "That sign-in attempt expired or could not be verified. Start again from this page." (`/login?auth_error=state_invalid&provider=google`).

1.4 WHEN the OAuth flow fails at the callback stage THEN no session cookie is created, and subsequent `/api/auth/me` requests return `{ user: null }`, preventing the user from being logged in.

### Expected Behavior (Correct)

2.1 WHEN `API_BASE` is empty (because `VITE_API_URL` is not set on Netlify) THEN all auth requests are relative URLs (`/api/auth/start/...`, `/api/auth/callback/...`, `/api/auth/me`, `/api/auth/logout`).

2.2 WHEN the frontend makes a relative request to `/api/auth/start/{provider}` THEN the Netlify proxy intercepts it and rewrites it to the Railway backend at `https://insightx-production-e656a82c.up.railway.app/api/auth/start/{provider}`, but the browser sees the response originating from the same-origin (insightx-dev.netlify.app).

2.3 WHEN the Railway backend sets the OAuth state cookie in response to `/api/auth/start/{provider}` THEN the browser stores it as a first-party cookie on insightx-dev.netlify.app (not the Railway domain), because it sees the Set-Cookie header from the same-origin proxy response.

2.4 WHEN the OAuth provider redirects back to `https://insightx-dev.netlify.app/api/auth/callback/{provider}` and the browser makes this request THEN it automatically includes the OAuth state cookie (because it is first-party to insightx-dev.netlify.app), the Netlify proxy rewrites it to Railway, and the state validation succeeds.

2.5 WHEN the OAuth callback succeeds THEN the Railway backend sets the session cookie (`insightx_sid`) with the same first-party domain behavior, and the app redirects to `/auth/complete`.

2.6 WHEN `/auth/complete` calls `/api/auth/me` THEN the session cookie is included automatically (first-party to insightx-dev.netlify.app), the request is routed through the Netlify proxy to Railway, and the user is returned from the session.

2.7 WHEN the user is successfully logged in THEN the app redirects to `/setup` with no auth error and displays the session user in the browser (DevTools > Application > Cookies shows `insightx_sid` under the insightx-dev.netlify.app domain with HttpOnly and Secure flags).

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `VITE_API_URL` is set to a local development API (e.g., `http://localhost:3001`) THEN the frontend makes direct requests to that API and cookies are set on the local domain (existing local development flow must continue to work).

3.2 WHEN `API_BASE` is set to a non-empty value (e.g., for non-proxy deployments) THEN the frontend continues to make direct requests to that API (backward compatibility must be maintained).

3.3 WHEN the user calls `signIn(providerId, nextPath)` with a valid provider ID (e.g., 'google', 'github') and optional `nextPath` THEN the function constructs the OAuth start URL correctly, whether `API_BASE` is empty (same-origin) or set to an external URL (direct API call).

3.4 WHEN the user is already signed in (session exists) and calls `refresh()` THEN the session is validated and the user remains authenticated (existing session refresh logic must not be affected).

3.5 WHEN the user clicks the sign-out button and calls `signOut()` THEN the session cookie is cleared and the user is logged out (logout flow must continue to work).

3.6 WHEN an auth API request fails for any reason (network error, timeout, invalid response) THEN the error is logged to the console and the appropriate error message is displayed to the user (error handling must be preserved).
