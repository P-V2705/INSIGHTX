import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const EMPTY_PROVIDERS = { google: false, github: false };
const AuthContext = createContext(null);

async function getJson(path) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error('request_failed');
  return response.json();
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [csrfToken, setCsrfToken] = useState(null);
  const [providers, setProviders] = useState(EMPTY_PROVIDERS);
  const [serviceAvailable, setServiceAvailable] = useState(false);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setStatus('loading');
    try {
      const session = await getJson('/api/auth/me');
      const configured = await getJson('/api/auth/providers').catch(() => ({}));
      const nextUser = session.user || null;
      setUser(nextUser);
      setCsrfToken(session.csrfToken || null);
      setProviders({
        google: configured.google === true,
        github: configured.github === true,
      });
      setServiceAvailable(true);
      setStatus('ready');
      return { user: nextUser, serviceAvailable: true };
    } catch {
      setUser(null);
      setCsrfToken(null);
      setProviders(EMPTY_PROVIDERS);
      setServiceAvailable(false);
      setStatus('unavailable');
      return { user: null, serviceAvailable: false };
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    const headers = { accept: 'application/json' };
    if (csrfToken) headers['x-csrf-token'] = csrfToken;
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers,
    }).catch(() => null);
    if (!response || !response.ok) throw new Error('Sign-out failed.');
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
      isSignedIn: Boolean(user),
      refresh,
      signOut,
    }),
    [status, user, csrfToken, providers, serviceAvailable, refresh, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
