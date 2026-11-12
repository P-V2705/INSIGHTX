import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';

export const SESSION_COOKIE = 'insightx_sid';
export const CSRF_COOKIE = 'insightx_csrf';
export const oauthCookieName = (provider) => `insightx_oauth_${provider}`;

const sessions = new Map();

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    if (!name || Object.hasOwn(cookies, name)) continue;
    try {
      cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      cookies[name] = '';
    }
  }
  return cookies;
}

export function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path || '/'}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) {
    const label = options.sameSite.toLowerCase();
    parts.push(`SameSite=${label.charAt(0).toUpperCase()}${label.slice(1)}`);
  }
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.partitioned) parts.push('Partitioned');
  return parts.join('; ');
}

function cookieOptions(extra = {}) {
  return {
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    domain: config.cookieDomain || undefined,
    partitioned: config.cookiePartitioned || undefined,
    ...extra,
  };
}

export function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createSession(user) {
  const sid = randomBytes(32).toString('base64url');
  const now = Date.now();
  const record = {
    user,
    csrf: randomBytes(32).toString('base64url'),
    createdAt: now,
    expiresAt: now + config.sessionTtlMs,
  };
  sessions.set(hash(sid), record);
  return { sid, record };
}

export function readSession(req) {
  const sid = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!sid) return null;
  const key = hash(sid);
  const record = sessions.get(key);
  if (!record) return null;
  if (record.expiresAt <= Date.now()) {
    sessions.delete(key);
    return null;
  }
  return { key, record };
}

export function destroySession(key) {
  if (key) sessions.delete(key);
}

export function publicUser(user) {
  return {
    id: user.id,
    provider: user.provider,
    displayName: user.displayName,
    email: user.email,
    emailVerified: user.emailVerified,
  };
}

export function setSessionCookie(res, sid) {
  res.append(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE, sid, cookieOptions({
      httpOnly: true,
      maxAge: config.sessionTtlMs / 1000,
    })),
  );
}

export function setCsrfCookie(res, token) {
  res.append(
    'Set-Cookie',
    serializeCookie(CSRF_COOKIE, token, cookieOptions({
      httpOnly: false,
      maxAge: config.sessionTtlMs / 1000,
    })),
  );
}

export function setOAuthCookie(res, provider, token) {
  res.append(
    'Set-Cookie',
    serializeCookie(oauthCookieName(provider), token, {
      ...cookieOptions({
        httpOnly: true,
        maxAge: config.stateTtlMs / 1000,
        path: '/api/auth',
        sameSite: config.cookieSameSite === 'none' ? 'none' : 'lax',
      }),
    }),
  );
}

export function clearOAuthCookie(res, provider) {
  res.append(
    'Set-Cookie',
    serializeCookie(oauthCookieName(provider), '', {
      ...cookieOptions({
        httpOnly: true,
        maxAge: 0,
        path: '/api/auth',
        sameSite: config.cookieSameSite === 'none' ? 'none' : 'lax',
      }),
    }),
  );
}

export function clearAuthCookies(res) {
  for (const name of [SESSION_COOKIE, CSRF_COOKIE]) {
    res.append(
      'Set-Cookie',
      serializeCookie(name, '', cookieOptions({ httpOnly: name === SESSION_COOKIE, maxAge: 0 })),
    );
  }
  for (const provider of ['google', 'github']) clearOAuthCookie(res, provider);
}

export function originAllowed(req) {
  const origin = req.get('origin');
  if (!origin) return true;
  const allowed = new Set();
  if (config.appOrigin) allowed.add(config.appOrigin);
  for (const origin of config.corsOrigins) allowed.add(origin);
  const host = req.get('host');
  if (host) {
    allowed.add(`https://${host}`);
    allowed.add(`http://${host}`);
  }
  return allowed.has(origin);
}

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of sessions) {
    if (record.expiresAt <= now) sessions.delete(key);
  }
}, 10 * 60 * 1000);
cleanup.unref();
