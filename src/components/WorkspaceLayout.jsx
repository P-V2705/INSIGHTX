import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader.jsx';
import { WorkspaceFooter } from './SiteFooter.jsx';
import { useSession } from '../session/SessionProvider.jsx';
import { AlertTriangle } from './Icons.jsx';

function WorkspaceLoading() {
  return (
    <div className="workspace-loading" role="status">
      <span className="loading-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <p>Loading workspace…</p>
    </div>
  );
}

export function WorkspaceLayout() {
  const { storageWarning } = useSession();
  return (
    <div className="workspace">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <AppHeader />
      {storageWarning && (
        <div className="storage-banner" role="alert">
          <div className="container storage-banner__inner">
            <AlertTriangle size={17} />
            <p>{storageWarning}</p>
          </div>
        </div>
      )}
      <main id="main-content" className="workspace-main">
        <div className="container workspace-container">
          <Suspense fallback={<WorkspaceLoading />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <WorkspaceFooter />
    </div>
  );
}
