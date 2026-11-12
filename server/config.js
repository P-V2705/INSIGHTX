const isProduction = process.env.NODE_ENV === 'production';

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOrigin(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.origin;
  } catch {
    return '';
  }
}

function normalizeCallback(value, fallback) {
  if (!value) return fallback;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    return url.toString();
  } catch {
    return '';
  }
}

const configuredOrigin = normalizeOrigin(text(process.env.APP_ORIGIN)) || (isProduction ? '' : 'http://localhost:5180');
const originInsecure = isProduction && Boolean(configuredOrigin) && !configuredOrigin.startsWith('https://');
const appOrigin = originInsecure ? '' : configuredOrigin;
const requestedSecure = text(process.env.COOKIE_SECURE);
const cookieSecure = requestedSecure
  ? requestedSecure === 'true' || requestedSecure === '1'
  : isProduction || appOrigin.startsWith('https://');

if (isProduction && !cookieSecure) {
  throw new Error('COOKIE_SECURE=false is not permitted in production. Serve Insightx over HTTPS.');
}

const sameSite = (text(process.env.COOKIE_SAMESITE) || 'lax').toLowerCase();
if (!['lax', 'strict', 'none'].includes(sameSite)) {
  throw new Error('COOKIE_SAMESITE must be lax, strict, or none.');
}
if (sameSite === 'none' && !cookieSecure) {
  throw new Error('COOKIE_SAMESITE=none requires secure cookies (COOKIE_SECURE=true).');
}

const cookieDomain = text(process.env.COOKIE_DOMAIN);
const cookiePartitioned = text(process.env.COOKIE_PARTITIONED) === 'true';
if (cookiePartitioned && !cookieSecure) {
  throw new Error('COOKIE_PARTITIONED=true requires secure cookies.');
}

const rawSessionSecret = text(process.env.SESSION_SECRET);
const sessionSecret = rawSessionSecret.length >= 32 ? rawSessionSecret : '';

const appCallback = (provider) => (appOrigin ? `${appOrigin}/api/auth/callback/${provider}` : '');

const providers = {
  google: {
    clientId: text(process.env.GOOGLE_CLIENT_ID),
    clientSecret: text(process.env.GOOGLE_CLIENT_SECRET),
    callbackUrl: normalizeCallback(text(process.env.GOOGLE_CALLBACK_URL), appCallback('google')),
  },
  github: {
    clientId: text(process.env.GITHUB_CLIENT_ID),
    clientSecret: text(process.env.GITHUB_CLIENT_SECRET),
    callbackUrl: normalizeCallback(text(process.env.GITHUB_CALLBACK_URL), appCallback('github')),
  },
};

const embedOrigins = (text(process.env.EMBED_ALLOW_ORIGINS) || '')
  .split(',')
  .map((value) => normalizeOrigin(value.trim()))
  .filter(Boolean);

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 3001,
  appOrigin,
  originInsecure,
  providers,
  sessionSecret,
  sessionSecretInvalid: Boolean(rawSessionSecret) && !sessionSecret,
  sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
  stateTtlMs: 10 * 60 * 1000,
  cookieSecure,
  cookieSameSite: sameSite,
  cookieDomain,
  cookiePartitioned,
  embedOrigins,
  serveStatic: text(process.env.SERVE_STATIC) !== 'false',
};
