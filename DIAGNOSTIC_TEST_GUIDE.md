# Netlify Proxy Diagnostic Testing Guide

This guide tests whether Netlify's /api/* proxy properly handles cookies and redirects for the OAuth callback flow.

## Setup

The Railway backend now has 4 temporary diagnostic endpoints:
- GET /api/diagnostic/set-cookie - Test A: Cookie forwarding
- GET /api/diagnostic/redirect - Test B: Redirect handling  
- GET /api/diagnostic/read-cookie - Test C: Cookie round trip
- GET /api/diagnostic/headers - Test D: Request header inspection

## Test Procedure

Open DevTools (F12) with Network tab and Console visible. Execute each test in order.

### Test A: Cookie Forwarding

URL: https://insight-dev.netlify.app/api/diagnostic/set-cookie

What to check:
1. Network tab: Look for the response header Set-Cookie: insightx_diagnostic_cookie=...
2. Application > Cookies: Check if insightx_diagnostic_cookie is stored
3. CRITICAL: Verify the cookie Domain is insight-dev.netlify.app (NOT railway.app)
4. Verify HttpOnly, Secure, and SameSite=Lax flags are set

Expected Result:
- PASS: Cookie appears in browser with Netlify domain
- FAIL: Cookie missing or has Railway domain = Netlify proxy NOT forwarding Set-Cookie

### Test B: Redirect Handling

URL: https://insight-dev.netlify.app/api/diagnostic/redirect

What to check:
1. Network tab: First request should show 302 redirect
2. Location header should point to: https://insight-dev.netlify.app/api/diagnostic/redirect-target
3. Second request should automatically follow and display JSON response
4. Verify the final page shows: "test": "B - Redirect Test"

Expected Result:
- PASS: Browser follows redirect and shows JSON response
- FAIL: Infinite redirect loop or broken redirect

### Test C: Cookie Round Trip

Step 1: First, run Test A to set the diagnostic cookie

Step 2: Then call this endpoint

URL: https://insight-dev.netlify.app/api/diagnostic/read-cookie

What to check:
1. Response JSON shows "diagnosticCookieReceived": "test_value_..." (NOT "not found")
2. "allReceivedCookies" array includes "insightx_diagnostic_cookie"

Expected Result:
- PASS: Cookie value visible in response (cookie round-tripped successfully)
- FAIL: Shows "(not found)"

### Test D: Request Headers

URL: https://insight-dev.netlify.app/api/diagnostic/headers

What to check:
1. "origin": Should be https://insight-dev.netlify.app
2. "xForwardedFor": Should contain client IP
3. "xForwardedProto": Should be https
4. "xForwardedHost": Should be insight-dev.netlify.app

Expected Result:
- PASS: All X-Forwarded-* headers present
- WARNING: Missing = Proxy configuration issue

## After Testing

Please provide:
1. Results for tests A-D (PASS/FAIL)
2. Any error messages or unexpected behavior
3. Screenshots from DevTools (especially Test A and C)
