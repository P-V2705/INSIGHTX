import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const EMPTY_PROVIDERS = { google: false, github: false };
const AuthContext = createContext(null);

// API base URL - uses environment variable or defaults to current origin
const API_BASE_URL = import.meta.env.REACT_APP_API_URL || window.location.origin;

async function getJson(path) {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  console.debug(`[AuthProvider] Fetching: ${url}`);
  
  const response = await fetch(url, {
    credentials: 'include', // Include cookies for cross-origin Railway requests
    cache: 'no-store',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  
  if (!response.ok) {
    console.error(`[AuthProvider] Fetch failed: ${response.status} ${response.statusText}`);
    throw new Error('request_failed');
  }
  
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
      
      // Handle both response formats: { google: true } and { providers: { google: true } }
      const providerConfig = configured.providers || configured;
      setProviders({
        google: providerConfig.google === true,
        github: providerConfig.github === true,
      });
      
      console.debug('[AuthProvider] Authentication refreshed successfully', {
        user: nextUser?.email,
        providers: { google: providerConfig.google, github: providerConfig.github },
      });
      
      setServiceAvailable(true);
      setStatus('ready');
      return { user: nextUser, serviceAvailable: true };
    } catch (error) {
      console.error('[AuthProvider] Authentication refresh failed:', error.message);
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
    
    const url = `${API_BASE_URL}/api/auth/logout`;
    console.debug(`[AuthProvider] Signing out: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include', // Include cookies for cross-origin Railway requests
      headers,
    }).catch((error) => {
      console.error('[AuthProvider] Sign-out request failed:', error.message);
      return null;
    });
    
    if (!response || !response.ok) {
      console.error('[AuthProvider] Sign-out failed:', response?.statusText);
      throw new Error('Sign-out failed.');
    }
    
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
