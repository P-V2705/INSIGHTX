import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { sanitizeNext } from '../../shared/nextPath.js';

const EMPTY_PROVIDERS = { google: false, github: false };
const SESSION_ERROR = 'Your session could not be confirmed. Sign in again.';
const AuthContext = createContext(null);

async function readJson(response) {
  if (!response.ok) throw new Error('request_failed');
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error('non_json_response');
  return response.json();
}

async function getJson(path) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  return readJson(response);
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
      google: configured.google === true,
      github: configured.github === true,
    });
    setServiceAvailable(true);

    let nextUser = null;
    try {
      const session = await getJson('/api/auth/me');
      nextUser = session.user || null;
      setUser(nextUser);
      setCsrfToken(session.csrfToken || null);
      setAuthError(null);
    } catch {
      setUser(null);
      setCsrfToken(null);
      setAuthError(SESSION_ERROR);
    }

    setStatus('ready');
    return { user: nextUser, serviceAvailable: true };
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback((providerId, nextPath) => {
    const targetNext = sanitizeNext(nextPath || '/setup');
    window.location.assign(`/api/auth/start/${encodeURIComponent(providerId)}?next=${encodeURIComponent(targetNext)}`);
  }, []);

  const signOut = useCallback(async () => {
    const headers = { accept: 'application/json', 'content-type': 'application/json' };
    if (csrfToken) headers['x-csrf-token'] = csrfToken;
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers,
      body: '{}',
    }).catch(() => null);
    if (!response || !response.ok) throw new Error('Sign-out failed.');
    setUser(null);
    setCsrfToken(null);
    setAuthError(null);
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
