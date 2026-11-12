import { lazy, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SessionProvider } from './session/SessionProvider.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import { RequireAuth } from './auth/RequireAuth.jsx';
import { WorkspaceLayout } from './components/WorkspaceLayout.jsx';
import AboutPage from './pages/AboutPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import AuthCompletePage from './pages/AuthCompletePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

const SetupPage = lazy(() => import('./pages/SetupPage.jsx'));
const AnalysisPage = lazy(() => import('./pages/AnalysisPage.jsx'));
const ReportPage = lazy(() => import('./pages/ReportPage.jsx'));

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView({ block: 'start' });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, hash]);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <SessionProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<AboutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/complete" element={<AuthCompletePage />} />
          <Route
            element={(
              <RequireAuth>
                <WorkspaceLayout />
              </RequireAuth>
            )}
          >
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/report" element={<ReportPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Analytics />
      </SessionProvider>
    </AuthProvider>
  );
}
