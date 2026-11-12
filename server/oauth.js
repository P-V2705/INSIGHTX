import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from './config.js';
import { sanitizeNext } from '../shared/nextPath.js';

export class AuthError extends Error {
  constructor(code) {
    super(code);
    this.name = 'AuthError';
    this.code = code;
  }
}

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export const PROVIDER_IDS = ['google', 'github'];

export function providerConfigured(provider) {
  const settings = config.providers[provider];
  if (!settings || !config.sessionSecret || !config.appOrigin) return false;
  if (!settings.clientId || !settings.callbackUrl) return false;
  return Boolean(settings.clientSecret);
}

export function providerStatus() {
  return Object.fromEntries(PROVIDER_IDS.map((provider) => [provider, providerConfigured(provider)]));
}

function cleanText(value, maxLength = 120) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

function cleanEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !email.includes('@') || /\s/.test(email)) return null;
  return email;
}

function identity(provider, subject, displayName, email, emailVerified) {
  return {
    id: createHash('sha256').update(`${provider}:${subject}`).digest('base64url').slice(0, 32),
    provider,
    displayName: cleanText(displayName) || `${provider[0].toUpperCase()}${provider.slice(1)} user`,
    email: cleanEmail(email),
    emailVerified: Boolean(emailVerified),
  };
}

function pkceChallenge(verifier) {
  return createHash('sha256').update(verifier).digest('base64url');
}

function signState(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', config.sessionSecret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifyStateToken(token) {
  if (!config.sessionSecret || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, signature] = parts;
    const expected = createHmac('sha256', config.sessionSecret).update(encoded).digest();
    const supplied = Buffer.from(signature, 'base64url');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload || typeof payload !== 'object') return null;
    if (!PROVIDER_IDS.includes(payload.provider)) return null;
    if (typeof payload.state !== 'string' || typeof payload.nonce !== 'string') return null;
    if (typeof payload.verifier !== 'string') return null;
    if (typeof payload.issuedAt !== 'number') return null;
    if (Date.now() - payload.issuedAt > config.stateTtlMs || payload.issuedAt > Date.now() + 30_000) return null;
    return {
      provider: payload.provider,
      state: payload.state,
      nonce: payload.nonce,
      verifier: payload.verifier,
      next: sanitizeNext(payload.next),
      issuedAt: payload.issuedAt,
    };
  } catch {
    return null;
  }
}

export function stateMatches(expected, received) {
  if (typeof expected !== 'string' || typeof received !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function startAuthorization(provider, requestedNext) {
  const settings = config.providers[provider];
  const next = sanitizeNext(requestedNext);
  const state = randomBytes(32).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const stateToken = signState({ v: 1, provider, state, verifier, nonce, next, issuedAt: Date.now() });

  const params = new URLSearchParams();
  params.set('client_id', settings.clientId);
  params.set('redirect_uri', settings.callbackUrl);
  params.set('response_type', 'code');
  params.set('state', state);

  let endpoint;
  if (provider === 'google') {
    endpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
    params.set('scope', 'openid email profile');
    params.set('nonce', nonce);
    params.set('prompt', 'select_account');
    params.set('include_granted_scopes', 'true');
    params.set('code_challenge', pkceChallenge(verifier));
    params.set('code_challenge_method', 'S256');
  } else {
    endpoint = 'https://github.com/login/oauth/authorize';
    params.set('scope', 'read:user user:email');
    params.set('code_challenge', pkceChallenge(verifier));
    params.set('code_challenge_method', 'S256');
  }

  return { stateToken, next, authorizationUrl: `${endpoint}?${params.toString()}` };
}

async function fetchJson(url, options) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new AuthError('exchange_failed');
  }
  if (!response.ok) throw new AuthError('exchange_failed');
  const text = await response.text();
  if (!text || text.length > 1_000_000) throw new AuthError('exchange_failed');
  try {
    return JSON.parse(text);
  } catch {
    throw new AuthError('exchange_failed');
  }
}

async function exchangeGoogle(code, verifier, expectedNonce) {
  const settings = config.providers.google;
  const token = await fetchJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      redirect_uri: settings.callbackUrl,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });
  if (typeof token.id_token !== 'string') throw new AuthError('exchange_failed');

  let payload;
  try {
    ({ payload } = await jwtVerify(token.id_token, googleKeys, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: settings.clientId,
      clockTolerance: 60,
    }));
  } catch {
    throw new AuthError('exchange_failed');
  }
  if (!stateMatches(expectedNonce, payload.nonce)) throw new AuthError('nonce_invalid');
  if (typeof payload.sub !== 'string' || !payload.sub) throw new AuthError('exchange_failed');

  return identity(
    'google',
    payload.sub,
    payload.name || payload.email,
    payload.email,
    payload.email_verified === true,
  );
}

async function exchangeGitHub(code, verifier) {
  const settings = config.providers.github;
  const token = await fetchJson('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'Insightx',
    },
    body: new URLSearchParams({
      code,
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      redirect_uri: settings.callbackUrl,
      code_verifier: verifier,
    }),
  });
  if (typeof token.access_token !== 'string' || !token.access_token) throw new AuthError('exchange_failed');

  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token.access_token}`,
    'user-agent': 'Insightx',
    'x-github-api-version': '2022-11-28',
  };
  const user = await fetchJson('https://api.github.com/user', { headers });
  if (!user || (typeof user.id !== 'number' && typeof user.id !== 'string') || typeof user.login !== 'string') {
    throw new AuthError('exchange_failed');
  }

  let email = null;
  let emailVerified = false;
  try {
    const emails = await fetchJson('https://api.github.com/user/emails', { headers });
    if (Array.isArray(emails)) {
      const primary = emails.find((entry) => entry && entry.primary) || emails[0];
      if (primary && primary.verified === true && typeof primary.email === 'string') {
        email = primary.email;
        emailVerified = true;
      }
    }
  } catch {
    email = null;
  }
  if (!email) {
    email = cleanEmail(user.email);
    emailVerified = false;
  }

  return identity('github', String(user.id), user.name || user.login, email, emailVerified);
}

export async function completeAuthorization(provider, { code, verifier, nonce }) {
  if (provider === 'google') return exchangeGoogle(code, verifier, nonce);
  if (provider === 'github') return exchangeGitHub(code, verifier);
  throw new AuthError('unavailable');
}
