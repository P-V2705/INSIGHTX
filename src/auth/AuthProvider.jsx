import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSettings, getUser, handleAuthCallback, logout, oauthLogin, onAuthChange } from '@netlify/identity';
import { sanitizeNext } from '../../shared/nextPath.js';

const EMPTY_PROVIDERS = { google: true, github: true };
const AuthContext = createContext(null);
const NEXT_KEY = 'insightx.auth.next';
let callbackPromise;

function publicUser(user) {
  return user ? { ...user, displayName: user.name || user.email || 'Account' } : null;
}

// Share callback processing across React's development effect replay.
function processCallback() {
  if (!callbackPromise) callbackPromise = handleAuthCallback();
  return callbackPromise;
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [user, setUser] = useState(null);
  const [providers, setProviders] = useState(EMPTY_PROVIDERS);
  const [serviceAvailable, setServiceAvailable] = useState(false);
  const [authError, setAuthError] = useState('');

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setStatus('loading');
    try {
      const settings = await getSettings();
      const nextUser = publicUser(await getUser());
      setUser(nextUser);
      setProviders({ google: settings.providers.google === true, github: settings.providers.github === true });
      setServiceAvailable(true);
      setStatus('ready');
      return { user: nextUser, serviceAvailable: true };
    } catch {
      setUser(null);
      setProviders(EMPTY_PROVIDERS);
      setServiceAvailable(false);
      setStatus('unavailable');
      return { user: null, serviceAvailable: false };
    }
  }, []);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthChange((_event, nextUser) => {
      if (active) setUser(publicUser(nextUser));
    });
    const initialize = async () => {
      try {
        const params = new URLSearchParams(window.location.hash.slice(1));
        if (params.has('error') || params.has('error_description')) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          throw new Error('provider_error');
        }
        const callback = await processCallback();
        if (!active) return;
        if (callback?.type === 'oauth' && callback.user) {
          let next = '/setup';
          try {
            next = sanitizeNext(sessionStorage.getItem(NEXT_KEY));
            sessionStorage.removeItem(NEXT_KEY);
          } catch { /* Browser storage may be restricted. */ }
          window.location.replace(`/auth/complete?next=${encodeURIComponent(next)}`);
          return;
        }
      } catch {
        if (active) setAuthError('Sign-in could not be completed. Please choose a provider and try again.');
      }
      if (active) await refresh();
    };
    void initialize();
    return () => { active = false; unsubscribe(); };
  }, [refresh]);

  const signIn = useCallback((provider, next) => {
    if (!providers[provider]) return;
    setAuthError('');
    try {
      try { sessionStorage.setItem(NEXT_KEY, sanitizeNext(next)); } catch { /* Use default destination. */ }
      oauthLogin(provider);
    } catch (error) {
      // The SDK throws after starting navigation; this is its documented never-return behavior.
      if (error.message !== 'Redirecting to OAuth provider') {
        setAuthError('Sign-in could not be started. Please retry.');
      }
    }
  }, [providers]);

  const signOut = useCallback(async () => {
    await logout();
    setUser(null);
    setStatus('ready');
  }, []);

  const value = useMemo(() => ({
    status, user, providers, serviceAvailable, authError,
    isSignedIn: Boolean(user), refresh, signIn, signOut,
  }), [status, user, providers, serviceAvailable, authError, refresh, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
