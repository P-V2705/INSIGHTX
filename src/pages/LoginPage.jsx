import { useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Brand } from '../components/Brand.jsx';
import {
  Check,
  GitHubIcon,
  GoogleIcon,
  Info,
  Lock,
  Refresh,
  Shield,
} from '../components/Icons.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';
import { AuthLoading } from '../auth/AuthLoading.jsx';
import { PROVIDER_LABELS } from '../auth/providerLabels.js';
import { sanitizeNext } from '../../shared/nextPath.js';

const PROVIDERS = [
  { id: 'google', label: 'Continue with Google', icon: GoogleIcon },
  { id: 'github', label: 'Continue with GitHub', icon: GitHubIcon },
];

const ERROR_MESSAGES = {
  cancelled: 'Sign-in was cancelled before your provider confirmed it. Choose a provider to try again.',
  state_invalid: 'That sign-in attempt expired or could not be verified. Start again from this page.',
  provider_error: 'The provider did not complete sign-in. Try again or choose a different provider.',
  exchange_failed: 'The provider could not confirm your account with Insightx. Try again or choose a different provider.',
  nonce_invalid: 'The provider response failed a security check. Start the sign-in again.',
  unavailable: 'That provider is not configured on this deployment yet.',
  rate_limited: 'Too many sign-in attempts. Wait a few minutes and try again.',
  session: 'Your session could not be confirmed. Sign in again.',
};

export default function LoginPage() {
  const { status, user, providers, serviceAvailable, authError, refresh, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const next = useMemo(
    () => sanitizeNext(location.state?.from || params.get('next')),
    [location.state, params],
  );
  const configuredCount = Object.values(providers).filter(Boolean).length;
  const anyConfigured = configuredCount > 0;
  const errorCode = params.get('auth_error');
  const errorProvider = PROVIDER_LABELS[params.get('provider')];
  const errorMessage = errorCode
    ? `${errorProvider ? `${errorProvider}: ` : ''}${ERROR_MESSAGES[errorCode] || 'Sign-in could not be completed. Try again.'}`
    : authError;

  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, navigate, next]);

  if (status === 'loading') return <AuthLoading />;
  if (user) {
    return <AuthLoading title="Opening your workspace" message="You are already signed in." />;
  }

  const statusChip = !serviceAvailable
    ? { label: 'Service offline', className: 'chip chip--amber' }
    : anyConfigured
      ? { label: 'Sign-in ready', className: 'chip chip--blue' }
      : { label: 'Setup required', className: 'chip chip--amber' };

  return (
    <div className="login-page">
      <a className="skip-link" href="#login-main">
        Skip to sign in
      </a>

      <section className="login-aside" aria-label="About Insightx sign-in">
        <div className="login-aside__pattern" aria-hidden="true" />
        <div className="login-aside__inner">
          <Link to="/" className="login-aside__brand" aria-label="Insightx home">
            <Brand tone="light" />
          </Link>

          <div className="login-aside__copy">
            <span className="eyebrow login-aside__eyebrow">Workspace access</span>
            <h1>Sign in. Your dataset stays local.</h1>
            <p>
              Insightx uses your Google or GitHub account to confirm who is opening the workspace.
              Imported files are still parsed and saved only in this browser.
            </p>
            <ul className="login-aside__list">
              <li>
                <Check size={14} /> OAuth is handled by your provider and Netlify Identity
              </li>
              <li>
                <Check size={14} /> A managed sign-in session is used — no provider password is stored
              </li>
              <li>
                <Check size={14} /> Datasets are never transmitted as part of sign-in
              </li>
            </ul>
          </div>

          <div className="login-aside__card">
            <span className="login-aside__card-icon" aria-hidden="true">
              <Lock size={16} />
            </span>
            <div>
              <span className="login-aside__card-title">Authentication status</span>
              <p>
                {!serviceAvailable
                  ? 'The Insightx auth service is not reachable from this page.'
                  : anyConfigured
                    ? `${configuredCount} of ${PROVIDERS.length} providers configured on this deployment.`
                    : 'No OAuth provider is configured on this deployment yet.'}
              </p>
            </div>
          </div>

          <p className="login-aside__foot">
            <Shield size={14} />
            OAuth 2.0 · managed session · sign-in required
          </p>
        </div>
      </section>

      <main className="login-main" id="login-main">
        <div className="login-main__bar">
          <Link to="/" className="login-back">
            <span aria-hidden="true">←</span>
            Back to Insightx
          </Link>
          <span className={statusChip.className}>{statusChip.label}</span>
        </div>

        <div className="login-panel">
          <div className="login-panel__heading">
            <span className="eyebrow">Sign in</span>
            <h2>Welcome to Insightx</h2>
            <p>
              Use the account you already have. Your provider will confirm the sign-in, then Insightx opens
              the workspace you requested.
            </p>
          </div>

          {errorMessage && (
            <div className="login-auth-error" role="alert">
              <Info size={15} />
              <p>{errorMessage}</p>
            </div>
          )}

          <div className="login-providers">
            {PROVIDERS.map((provider) => {
              const Icon = provider.icon;
              const configured = serviceAvailable && providers[provider.id];
              const content = (
                <>
                  <span className="login-provider__icon" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <span className="login-provider__label">{provider.label}</span>
                  <span className={`login-provider__tag${configured ? ' login-provider__tag--ready' : ''}`}>
                    {configured ? 'Ready' : serviceAvailable ? 'Not configured' : 'Unavailable'}
                  </span>
                </>
              );

              if (configured) {
                return (
                  <button
                    type="button"
                    key={provider.id}
                    className="login-provider"
                    onClick={() => signIn(provider.id, next)}
                    aria-describedby="login-status"
                  >
                    {content}
                  </button>
                );
              }

              return (
                <button
                  key={provider.id}
                  type="button"
                  className="login-provider is-disabled"
                  disabled
                  aria-describedby="login-status"
                >
                  {content}
                </button>
              );
            })}
          </div>

          <div className="login-status" id="login-status" aria-live="polite">
            {!serviceAvailable && (
              <>
                <p>
                  <strong>Sign-in service unavailable.</strong> Please retry in a moment. Your dataset stays in this browser.
                </p>
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => refresh()}>
                  <Refresh size={14} />
                  Retry connection
                </button>
              </>
            )}
            {serviceAvailable && !anyConfigured && (
              <p>
                <strong>No provider is configured yet.</strong> The app owner needs to enable Google and GitHub sign-in before the workspace can be opened.
              </p>
            )}
            {serviceAvailable && anyConfigured && !errorMessage && (
              <p>{configuredCount} of {PROVIDERS.length} providers are available. Select one to continue.</p>
            )}
          </div>

          <div className="login-setup-note">
            <span className="login-setup-note__title">
              {anyConfigured ? 'How sign-in works' : 'Server setup required'}
            </span>
            <p>
              {anyConfigured
                ? 'After your provider confirms the account, Netlify Identity creates a secure session and opens the workspace. Signing out clears that session.'
                : 'The app owner needs to enable Google and GitHub in the project’s Identity provider settings. Retry once setup is complete.'}
            </p>
          </div>

          <p className="login-terms">
            Your provider password is never shared with Insightx. Your dataset remains in this browser and is
            not transmitted during sign-in.
          </p>
        </div>

        <div className="login-main__foot">
          <Link to="/#privacy" className="text-link">
            Privacy
          </Link>
          <span aria-hidden="true">·</span>
          <Link to="/" className="text-link">
            Product overview
          </Link>
        </div>
      </main>
    </div>
  );
}
