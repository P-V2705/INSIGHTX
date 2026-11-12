import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { AuthLoading } from '../auth/AuthLoading.jsx';
import { sanitizeNext } from '../../shared/nextPath.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function AuthCompletePage() {
  const { refresh } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = useMemo(() => sanitizeNext(params.get('next')), [params]);

  useEffect(() => {
    let cancelled = false;
    const minimumDelay = wait(750);

    const finish = async () => {
      let result = { user: null };
      for (let attempt = 0; attempt < 8 && !cancelled; attempt += 1) {
        result = await refresh({ quiet: true });
        if (result.user) break;
        await wait(400);
      }
      await minimumDelay;
      if (cancelled) return;
      if (result.user) {
        navigate(next, { replace: true });
      } else {
        navigate(`/login?auth_error=session&next=${encodeURIComponent(next)}`, { replace: true });
      }
    };

    void finish();
    return () => {
      cancelled = true;
    };
  }, [navigate, next, refresh]);

  return (
    <AuthLoading
      title="Opening your workspace"
      message="Your provider confirmed the sign-in. Establishing a secure Insightx session…"
    />
  );
}
