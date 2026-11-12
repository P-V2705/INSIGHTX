import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider.jsx';
import { AuthLoading } from './AuthLoading.jsx';

export function RequireAuth({ children }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <AuthLoading />;
  }

  if (!user) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(next)}`}
        replace
        state={{ from: next }}
      />
    );
  }

  return children;
}
