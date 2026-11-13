import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { sanitizeNext } from '../../shared/nextPath.js';

const EMPTY_PROVIDERS = { google: false, github: false };
const AuthContext = createContext(null);

// API base URL for auth requests. Empty means same-origin requests through Netlify proxy.
// For local development, set VITE_API_URL to http://localhost:3001 or similar.
// In production, leave empty so all requests use /api/* (Netlify proxy to Railway).
export const API_BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

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

// All auth requests go through the same-origin Netlify proxy (/api/* -> Railway),
// ensuring cookies are first-party to the frontend domain (insight-dev.netlify.app).
// This prevents browsers from blocking third-party cookies set by the Railway backend.
async function apiRequest(path, options = {}) {
  const url = API_BASE ? `${API_BASE}${path}` : path;
  
  try {
    console.debug(`[AuthProvider] Fetching: ${url}`);
    const response = await fetch(url, requestOptions(options));
    const data = await readJson(response).catch(() => {
      throw new Error('invalid_response');
    });
    
    if (!response.ok) {
      throw new Error('request_failed');
    }
    
    return { ok: true, status: response.status, data };
  } catch (error) {
    console.error(`[AuthProvider] Request failed: ${error.message}`);
    throw error;
  }
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
    const startUrl = `${API_BASE ? API_BASE : window.location.origin}/api/auth/start/${providerId}?next=${encodeURIComponent(targetNext)}`;
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
