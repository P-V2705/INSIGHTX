import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { sanitizeNext } from '../../shared/nextPath.js';

const EMPTY_PROVIDERS = { google: false, github: false };
const AuthContext = createContext(null);

const RAILWAY_API = 'https://insightx-production-e656a82c.up.railway.app';

// Base URL of the Railway auth API. Override at build time with VITE_API_URL.
export const API_BASE = (import.meta.env.VITE_API_URL || RAILWAY_API).trim().replace(/\/+$/, '');

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

// Calls the Railway API directly (credentialed CORS). If the browser cannot
// reach it — network failure, CORS rejection, or a non-JSON reply — it retries
// through the same-origin Netlify proxy (/api/* -> Railway).
async function apiRequest(path, options = {}) {
  const attempts = API_BASE ? [`${API_BASE}${path}`, path] : [path];
  let lastError = new Error('request_failed');
  for (const url of attempts) {
    try {
      const response = await fetch(url, requestOptions(options));
      const data = await readJson(response).catch(() => {
        throw new Error('invalid_response');
      });
      return { ok: response.ok, status: response.status, data };
    } catch (error) {
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
