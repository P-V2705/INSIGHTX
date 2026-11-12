import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Brand } from './Brand.jsx';
import { useSession } from '../session/SessionProvider.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';
import { PROVIDER_LABELS } from '../auth/providerLabels.js';
import { Check, Lock } from './Icons.jsx';

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'IX';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function StageRail() {
  const { session } = useSession();
  const location = useLocation();
  const prepared = Boolean(session.dataset && session.prepared && session.config?.measureKey);
  const reportReady = Boolean(session.report);

  const steps = [
    {
      to: '/setup',
      label: 'Session setup',
      short: 'Setup',
      available: true,
      done: prepared,
      current: location.pathname === '/setup',
      lockedHint: '',
    },
    {
      to: '/analysis',
      label: 'Analysis',
      short: 'Analysis',
      available: prepared,
      done: reportReady,
      current: location.pathname === '/analysis',
      lockedHint: 'Import a dataset and prepare an analysis to unlock this stage.',
    },
    {
      to: '/report',
      label: 'Final report',
      short: 'Report',
      available: reportReady,
      done: false,
      current: location.pathname === '/report',
      lockedHint: 'Finalize an analysis to save and unlock the report.',
    },
  ];

  return (
    <nav className="stage-rail" aria-label="Analysis workflow">
      <ol>
        {steps.map((step, index) => {
          const content = (
            <>
              <span className="stage-rail__icon" aria-hidden="true">
                {step.done ? <Check size={12} /> : index + 1}
              </span>
              <span className="stage-rail__label">
                <span className="stage-rail__label-full">{step.label}</span>
                <span className="stage-rail__label-short">{step.short}</span>
              </span>
              {!step.available && <Lock size={12} className="stage-rail__lock" />}
            </>
          );

          return (
            <li key={step.to} className={step.done ? 'is-done' : undefined}>
              {step.available ? (
                <Link
                  to={step.to}
                  className={`stage-rail__link${step.current ? ' is-current' : ''}`}
                  aria-current={step.current ? 'step' : undefined}
                >
                  {content}
                </Link>
              ) : (
                <span
                  className="stage-rail__link is-locked"
                  aria-disabled="true"
                  title={step.lockedHint}
                >
                  {content}
                  <span className="sr-only">Locked. {step.lockedHint}</span>
                </span>
              )}
              {index < steps.length - 1 && <span className="stage-rail__divider" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function AppHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const displayName = user?.displayName || 'Account';

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError('');
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch {
      setSignOutError('Sign-out failed. Try again.');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <Link to="/" className="app-header__brand" aria-label="Insightx home">
          <Brand />
        </Link>
        <StageRail />
        <div className="app-header__actions">
          {signOutError && (
            <span className="app-header__error" role="alert">
              {signOutError}
            </span>
          )}
          <span className="app-header__mode">Local data</span>
          <span className="account-chip" title={user?.email || undefined}>
            <span className="account-chip__avatar" aria-hidden="true">
              {initials(displayName)}
            </span>
            <span className="account-chip__meta">
              <strong>{displayName}</strong>
              <small>via {PROVIDER_LABELS[user?.provider] || 'provider'}</small>
            </span>
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </header>
  );
}
