import { Link } from 'react-router-dom';
import { ArrowUpRight } from './Icons.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';
import { PROVIDER_LABELS } from '../auth/providerLabels.js';

export function SiteFooter() {
  const { user } = useAuth();
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__brand">
          <span className="site-footer__name">Insightx</span>
          <span className="site-footer__tagline">Business data, in focus.</span>
        </div>
        <p className="site-footer__note">
          OAuth sign-in · Datasets stay in this browser · No dataset uploads
        </p>
        <nav className="site-footer__links" aria-label="Footer">
          <Link to={user ? '/setup' : '/login'}>{user ? 'Workspace' : 'Sign in'}</Link>
          <Link to="/#workflow">Workflow</Link>
        </nav>
      </div>
    </footer>
  );
}

export function WorkspaceFooter() {
  const { user } = useAuth();
  return (
    <footer className="workspace-footer">
      <div className="container workspace-footer__inner">
        <p>
          <span className="workspace-footer__dot" aria-hidden="true" />
          Local browser session · Files are parsed on this device
        </p>
        <span className="workspace-footer__account">
          Signed in via {PROVIDER_LABELS[user?.provider] || 'provider'}
          <ArrowUpRight size={13} />
        </span>
      </div>
    </footer>
  );
}
