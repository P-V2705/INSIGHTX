# Session Cookie Persistence After OAuth Redirect

## Introduction

Session cookies created by the Railway backend during OAuth callback are not persisting to the Netlify frontend, causing users to receive "Your session could not be confirmed. Sign in again" errors immediately after successful OAuth authentication. This breaks the authentication flow across the domain boundary between Railway (backend) and Netlify (frontend).

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN user completes OAuth authentication on Railway backend (OAuth provider → Railway /api/auth/callback/google) THEN the system creates a session cookie on the Railway domain but does not persist it to the Netlify domain, causing subsequent requests to Netlify frontend to lack session credentials.

1.2 WHEN Netlify frontend calls GET /api/auth/me through the Netlify proxy (same-origin) after OAuth redirect THEN the system fails to include the Railway session cookie in the request, resulting in "Your session could not be confirmed" error.

1.3 WHEN browser receives Set-Cookie headers from Railway during the OAuth callback cross-domain redirect (OAuth provider → railway.app → netlify.app) THEN the system silently loses the session cookie due to browser security policies blocking cookies across domain boundaries and/or SameSite=Lax restrictions.

### Expected Behavior (Correct)

2.1 WHEN user completes OAuth authentication on Railway backend and is redirected to Netlify frontend /auth/complete THEN the system SHALL persist the session token/credentials to the Netlify frontend in a manner that allows subsequent authenticated requests.

2.2 WHEN Netlify frontend calls GET /api/auth/me through the Netlify proxy after OAuth redirect THEN the system SHALL include valid session credentials in the request, allowing the backend to verify the session and return the authenticated user.

2.3 WHEN browser executes the OAuth callback cross-domain redirect sequence (OAuth provider → railway.app → netlify.app) THEN the system SHALL transfer session credentials across the domain boundary such that the user remains authenticated on the Netlify frontend.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user is already authenticated and makes direct requests to the Railway backend (bypassing Netlify proxy) THEN the system SHALL CONTINUE TO maintain the session using standard HTTP-only, Secure cookies with SameSite=Lax.

3.2 WHEN user initiates OAuth sign-in with Google or GitHub THEN the system SHALL CONTINUE TO redirect through the OAuth provider's authorization flow without modification to the OAuth callback chain.

3.3 WHEN user requests /api/auth/logout THEN the system SHALL CONTINUE TO clear session state and CSRF tokens as currently implemented.

3.4 WHEN user calls /api/auth/me with valid session credentials THEN the system SHALL CONTINUE TO return user and CSRF token data in the same format as currently implemented.
