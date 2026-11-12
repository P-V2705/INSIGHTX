# I-X PRODUCTION DEPLOYMENT PLAN

## AUDIT SUMMARY

**Build Status**: ✅ Successful (0 errors, 2.58s)
**Git Setup**: ✅ Connected to https://github.com/P-V2705/INSIGHTX.git  
**Vite Config**: ✅ Correct (build → dist/)
**Netlify Config**: ✅ Present (netlify.toml with correct settings)
**Frontend Ready**: ✅ React SPA fully working
**Backend Deployment**: ❌ Not yet configured
**Environment Variables**: ❌ Not set up for production
**OAuth Credentials**: ❌ Needs production URLs

---

## CURRENT ARCHITECTURE

### Frontend (React SPA)
- Location: ./src/
- Build tool: Vite
- Output: ./dist/
- Build command: npm run build
- Deploy target: Netlify

### Backend (Express Server)
- Location: ./server/
- Entry: server/index.js
- Port: 3001
- Dependencies: Express, Jose (JWT), crypto
- Deploy target: Railway

### OAuth Flow
- Google OAuth: https://accounts.google.com
- GitHub OAuth: https://github.com/login/oauth
- Callback: /api/auth/callback/{provider}

---

## DEPLOYMENT REQUIREMENTS

### PHASE 1: Frontend (Netlify)
1. ✅ Build command: npm run build
2. ✅ Publish dir: dist/
3. ✅ Redirects: _redirects file configured
4. ⏳ Environment variables: NOT SET
5. ⏳ GitHub connection: NOT YET

### PHASE 2: Backend (Production Service)
1. ⏳ Hosting: Choose Railway
2. ⏳ Node version: 22.9+
3. ⏳ Environment variables: NOT CONFIGURED
4. ⏳ OAuth credentials: NOT SET
5. ⏳ CORS/Security: NEEDS REVIEW

---

## REQUIRED ENVIRONMENT VARIABLES

### Frontend (Netlify)
- None needed - frontend is static SPA

### Backend (Railway)
- APP_ORIGIN: Production URL (e.g., https://insightx-dev.netlify.app)
- GOOGLE_CLIENT_ID: From Google Cloud Console
- GOOGLE_CLIENT_SECRET: From Google Cloud Console
- GITHUB_CLIENT_ID: From GitHub App
- GITHUB_CLIENT_SECRET: From GitHub App
- SESSION_SECRET: Min 32 random chars
- COOKIE_SECURE: true
- COOKIE_SAMESITE: none (frontend and API are on different sites)
- TRUST_PROXY: true
- PORT: 3001 (or set by platform)

---

## IMPLEMENTATION STEPS

### Step 1: Choose Backend Hosting
Options:
- Railway (⭐ Recommended - simplest)

### Step 2: Get OAuth Credentials
1. Google: https://console.cloud.google.com
   - Create OAuth 2.0 credentials
   - Set callback URL to: https://{backend-url}/api/auth/callback/google
2. GitHub: https://github.com/settings/developers
   - Create OAuth App
   - Set callback URL to: https://{backend-url}/api/auth/callback/github

### Step 3: Deploy Backend
1. Push current code to GitHub (already done ✅)
2. Connect repo to Railway
3. Set environment variables
4. Deploy

### Step 4: Get Netlify URL
1. Create Netlify account
2. Connect GitHub repo
3. Set build command: npm run build
4. Set publish: dist
5. Deploy → Get URL (e.g., insightx.netlify.app)

### Step 5: Update Backend URL
1. Get backend public URL from Railway
2. Update OAuth callback URLs:
   - Google: https://{backend-url}/api/auth/callback/google
   - GitHub: https://{backend-url}/api/auth/callback/github
3. Set APP_ORIGIN in backend: https://insightx-dev.netlify.app

### Step 6: Update Frontend (Optional)
Add API_BASE_URL env var if backend not on same domain:
- For now, frontend can call backend via same origin

### Step 7: Test Production
1. Open frontend URL
2. Test login with Google
3. Test login with GitHub
4. Test dataset import
5. Test analysis
6. Test report generation

---

## ISSUES TO WATCH

### Issue 1: API Routing
- Frontend calls /api/* routes
- In production, backend must serve /api/*
- Solution: Backend runs on same domain or explicit API URL

### Issue 2: CORS Headers
- Currently set in server/index.js
- Review for production (cross-origin requests)

### Issue 3: Session Storage
- Currently in-memory (will reset on deploy)
- Solution: Store in database (future improvement)

### Issue 4: HTTPS Requirement
- OAuth requires HTTPS
- Both Netlify and Railway provide HTTPS ✅

---

## SUCCESS CRITERIA

- ✅ Frontend loads without white screen
- ✅ Can login with Google
- ✅ Can login with GitHub
- ✅ Can import dataset
- ✅ Analysis computes correctly
- ✅ Can generate and save report
- ✅ Auto-deploy works on git push

---

## RECOMMENDED TIMELINE

- Setup OAuth credentials: 30 min
- Deploy backend to Railway: 15 min
- Deploy frontend to Netlify: 10 min
- Connect + test: 20 min
- **Total**: ~75 minutes

