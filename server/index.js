import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { sanitizeNext } from '../shared/nextPath.js';
import { config } from './config.js';
import {
  AuthError,
  PROVIDER_IDS,
  completeAuthorization,
  providerConfigured,
  providerStatus,
  startAuthorization,
  stateMatches,
  verifyStateToken,
} from './oauth.js';
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  clearAuthCookies,
  clearOAuthCookie,
  constantTimeEqual,
  createSession,
  destroySession,
  oauthCookieName,
  originAllowed,
  parseCookies,
  publicUser,
  readSession,
  setCsrfCookie,
  setOAuthCookie,
  setSessionCookie,
} from './session.js';

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

const rateBuckets = new Map();

function rateLimited(key, limit, windowMs) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.reset <= now) {
    rateBuckets.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}

const rateCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (bucket.reset <= now) rateBuckets.delete(key);
  }
}, 10 * 60 * 1000);
rateCleanup.unref();

const frameAncestors = ["'self'", ...config.embedOrigins].join(' ');
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  `frame-ancestors ${frameAncestors}`,
].join('; ');

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', contentSecurityPolicy);
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (config.isProduction && config.appOrigin.startsWith('https://')) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: false, limit: '16kb' }));

function loginRedirect(res, code, { provider, next } = {}) {
  const params = new URLSearchParams({ auth_error: code });
  if (provider && PROVIDER_IDS.includes(provider)) params.set('provider', provider);
  if (next) params.set('next', sanitizeNext(next));
  res.setHeader('Cache-Control', 'no-store');
  return res.redirect(302, `/login?${params.toString()}`);
}

function readOAuthState(req, provider) {
  const token = parseCookies(req.headers.cookie)[oauthCookieName(provider)];
  const state = verifyStateToken(token);
  return state && state.provider === provider ? state : null;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/auth/providers', (req, res) => {
  res.json(providerStatus());
});

app.get('/api/auth/me', (req, res) => {
  const session = readSession(req);
  if (!session) {
    if (parseCookies(req.headers.cookie)[SESSION_COOKIE]) clearAuthCookies(res);
    return res.json({ user: null, csrfToken: null });
  }
  const csrfCookie = parseCookies(req.headers.cookie)[CSRF_COOKIE];
  if (!constantTimeEqual(csrfCookie, session.record.csrf)) {
    setCsrfCookie(res, session.record.csrf);
  }
  return res.json({
    user: publicUser(session.record.user),
    csrfToken: session.record.csrf,
  });
});

app.post('/api/auth/logout', (req, res) => {
  if (!originAllowed(req)) {
    return res.status(403).json({ error: { code: 'INVALID_ORIGIN' } });
  }
  const session = readSession(req);
  if (session) {
    const headerToken = req.get('x-csrf-token') || '';
    const cookieToken = parseCookies(req.headers.cookie)[CSRF_COOKIE] || '';
    if (
      !constantTimeEqual(headerToken, cookieToken) ||
      !constantTimeEqual(headerToken, session.record.csrf)
    ) {
      return res.status(403).json({ error: { code: 'INVALID_CSRF' } });
    }
    destroySession(session.key);
  }
  clearAuthCookies(res);
  return res.json({ ok: true });
});

app.get('/api/auth/start/:provider', (req, res) => {
  const provider = req.params.provider;
  if (!PROVIDER_IDS.includes(provider)) {
    return res.status(404).json({ error: { code: 'NOT_FOUND' } });
  }
  if (rateLimited(`start:${req.ip}`, 30, 10 * 60 * 1000)) {
    return loginRedirect(res, 'rate_limited', { provider, next: req.query.next });
  }
  if (!providerConfigured(provider)) {
    return loginRedirect(res, 'unavailable', { provider, next: req.query.next });
  }

  const { stateToken, authorizationUrl } = startAuthorization(provider, req.query.next);
  setOAuthCookie(res, provider, stateToken);
  res.setHeader('Cache-Control', 'no-store');
  return res.redirect(302, authorizationUrl);
});

async function handleCallback(req, res) {
  const provider = req.params.provider;
  if (!PROVIDER_IDS.includes(provider)) {
    return res.status(404).json({ error: { code: 'NOT_FOUND' } });
  }
  if (rateLimited(`callback:${req.ip}`, 60, 10 * 60 * 1000)) {
    return loginRedirect(res, 'rate_limited', { provider });
  }

  const params = req.method === 'POST' ? req.body || {} : req.query;
  const state = readOAuthState(req, provider);
  clearOAuthCookie(res, provider);

  const providerError = typeof params.error === 'string' ? params.error : '';
  if (providerError) {
    return loginRedirect(res, providerError === 'access_denied' ? 'cancelled' : 'provider_error', {
      provider,
      next: state?.next,
    });
  }
  if (!state) return loginRedirect(res, 'state_invalid', { provider });
  if (!stateMatches(state.state, typeof params.state === 'string' ? params.state : '')) {
    return loginRedirect(res, 'state_invalid', { provider, next: state.next });
  }

  const code = typeof params.code === 'string' ? params.code : '';
  if (!code || code.length > 4096) {
    return loginRedirect(res, 'provider_error', { provider, next: state.next });
  }
  if (!providerConfigured(provider)) {
    return loginRedirect(res, 'unavailable', { provider, next: state.next });
  }

  try {
    const user = await completeAuthorization(provider, {
      code,
      verifier: state.verifier,
      nonce: state.nonce,
    });
    const { sid, record } = createSession(user);
    setSessionCookie(res, sid);
    setCsrfCookie(res, record.csrf);
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, `/auth/complete?next=${encodeURIComponent(state.next)}`);
  } catch (error) {
    const code = error instanceof AuthError ? error.code : 'exchange_failed';
    console.warn(`[auth] ${provider} callback failed: ${code}`);
    return loginRedirect(res, code === 'nonce_invalid' ? 'nonce_invalid' : 'exchange_failed', {
      provider,
      next: state.next,
    });
  }
}

app.get('/api/auth/callback/:provider', handleCallback);
app.post('/api/auth/callback/:provider', handleCallback);

app.use('/api', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND' } });
});

const distDir = fileURLToPath(new URL('../dist', import.meta.url));
const indexFile = path.join(distDir, 'index.html');
const protectedPaths = new Set(['/setup', '/analysis', '/report']);

if (config.serveStatic && existsSync(indexFile)) {
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const normalized = req.path.replace(/\/+$/, '') || '/';
    if (protectedPaths.has(normalized) && !readSession(req)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(302, `/login?next=${encodeURIComponent(req.originalUrl)}`);
    }
    return next();
  });

  app.use(
    express.static(distDir, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(indexFile);
  });
} else if (config.serveStatic) {
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.status(503).type('text/plain').send('Insightx has not been built. Run "npm run build" and restart the server.');
  });
}

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large') {
    return res.status(400).json({ error: { code: 'INVALID_REQUEST' } });
  }
  console.error('[server] unhandled request error:', error?.name || 'Error');
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: { code: 'SERVER_ERROR' } });
  }
  return res.status(500).type('text/plain').send('Insightx could not complete this request.');
});

app.listen(config.port, () => {
  console.log(`Insightx auth server listening on http://localhost:${config.port}`);
  if (config.originInsecure) {
    console.warn('[auth] APP_ORIGIN must use HTTPS in production; OAuth providers stay disabled.');
  } else if (!config.appOrigin) {
    console.warn('[auth] APP_ORIGIN is not set; OAuth providers stay disabled.');
  }
  if (config.sessionSecretInvalid) {
    console.warn('[auth] SESSION_SECRET is shorter than 32 characters; OAuth providers stay disabled.');
  } else if (!config.sessionSecret) {
    console.warn('[auth] SESSION_SECRET is not set; OAuth providers stay disabled.');
  }
  const status = providerStatus();
  for (const provider of PROVIDER_IDS) {
    console.log(`[auth] ${provider}: ${status[provider] ? 'configured' : 'not configured'}`);
  }
  if (!config.serveStatic) {
    console.log('[server] static file serving is disabled (SERVE_STATIC=false).');
  }
});
