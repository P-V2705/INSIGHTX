import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { sanitizeNext } from '../../shared/nextPath.js';

const EMPTY_PROVIDERS = { google: false, github: false };
const AuthContext = createContext(null);

// Production Railway API backend
const RAILWAY_API = 'https://insightx-production-e656a82c.up.railway.app';

// Determine API base URL:
// 1. If VITE_API_URL is explicitly set, use it (allows override at build time)
// 2. Otherwise, use Railway API (hardcoded fallback for production)
// 3. Empty strings are normalized to allow Netlify same-origin proxy fallback
function getApiBase() {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (envUrl) {
    // Explicit URL provided - validate and normalize
    try {
      const url = new URL(envUrl);
      return url.origin; // Normalize to origin only (remove path/query)
    } catch {
      console.warn('[AuthProvider] Invalid VITE_API_URL, falling back to Railway:', envUrl);
      return RAILWAY_API;
    }
  }
  // No explicit URL - use Railway as default for production
  return RAILWAY_API;
}

export const API_BASE = getApiBase();

const REQUEST_TIMEOUT_MS = 10000;

function requestOptions(options = {}) {
  return {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    mode: 'cors',
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };
}

// Reads a JSON body, rejecting HTML fallbacks (e.g. index.html served for an
// unknown path) so they are never mistaken for an API response.
async function readJson(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new Error('invalid_response');
  return response.json();
}

// Dual-path fetch strategy for cross-origin API calls:
// 1. Try direct Railway API call (credentialed CORS)
// 2. If that fails, fall back to same-origin Netlify proxy (/api/* -> Railway)
//
// This handles:
// - Network/CORS failures: Falls back to proxy
// - HTML responses (served for unknown paths): Retried through proxy
// - Cookie persistence: Attempts direct first, then proxy
async function apiRequest(path, options = {}) {
  // Build attempt URLs
  const directUrl = API_BASE ? `${API_BASE}${path}` : null;
  const proxyUrl = path; // Same-origin proxy (Netlify redirects /api/* to Railway)
  
  const attempts = directUrl ? [directUrl, proxyUrl] : [proxyUrl];
  let lastError = new Error('request_failed');
  
  for (let i = 0; i < attempts.length; i++) {
    const url = attempts[i];
    const isDirectAttempt = i === 0 && directUrl;
    
    try {
      console.debug(`[AuthProvider] Attempt ${i + 1}/${attempts.length}: ${url}`);
      const response = await fetch(url, requestOptions(options));
      const data = await readJson(response).catch(() => {
        throw new Error('invalid_response');
      });
      
      if (!response.ok) {
        console.warn(`[AuthProvider] Response not OK (${response.status}), retrying...`);
        lastError = new Error('request_failed');
        continue;
      }
      
      console.debug(`[AuthProvider] Success on ${isDirectAttempt ? 'direct' : 'proxy'} attempt`);
      return { ok: true, status: response.status, data };
    } catch (error) {
      console.debug(
        `[AuthProvider] ${isDirectAttempt ? 'Direct' : 'Proxy'} attempt failed: ${error.message}`
      );
      lastError = error;
    }
  }
  
  throw lastError;
}

async function getJson(path) {
  const result = await apiRequest(path);
  if (!result.ok) throw new Error('request_failed');
  return result.data;
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [csrfToken, setCsrfToken] = useState(null);
  const [providers, setProviders] = useState(EMPTY_PROVIDERS);
  const [serviceAvailable, setServiceAvailable] = useState(false);
  const [authError, setAuthError] = useState(null);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setStatus('loading');

    let configured;
    try {
      configured = await getJson('/api/auth/providers');
    } catch {
      setUser(null);
      setCsrfToken(null);
      setProviders(EMPTY_PROVIDERS);
      setServiceAvailable(false);
      setAuthError(null);
      setStatus('unavailable');
      return { user: null, serviceAvailable: false };
    }

    setProviders({
      google: configured?.google === true,
      github: configured?.github === true,
    });
    setServiceAvailable(true);

    let nextUser = null;
    try {
      const session = await getJson('/api/auth/me');
      nextUser = session?.user || null;
      setCsrfToken(session?.csrfToken || null);
      setAuthError(null);
    } catch {
      setCsrfToken(null);
      setAuthError('Your session could not be confirmed. Sign in again.');
    }
    setUser(nextUser);
    setStatus('ready');
    return { user: nextUser, serviceAvailable: true };
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback((providerId, nextPath) => {
    const targetNext = sanitizeNext(nextPath || '/setup');
    const startUrl = `${API_BASE}/api/auth/start/${providerId}?next=${encodeURIComponent(targetNext)}`;
    window.location.href = startUrl;
  }, []);

  const signOut = useCallback(async () => {
    const headers = { 'content-type': 'application/json' };
    if (csrfToken) headers['x-csrf-token'] = csrfToken;
    const result = await apiRequest('/api/auth/logout', {
      method: 'POST',
      headers,
      body: '{}',
    }).catch(() => null);
    if (!result || !result.ok) throw new Error('Sign-out failed.');
    setUser(null);
    setCsrfToken(null);
    setStatus('ready');
  }, [csrfToken]);

  const value = useMemo(
    () => ({
      status,
      user,
      csrfToken,
      providers,
      serviceAvailable,
      authError,
      isSignedIn: Boolean(user),
      refresh,
      signIn,
      signOut,
    }),
    [status, user, csrfToken, providers, serviceAvailable, authError, refresh, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
