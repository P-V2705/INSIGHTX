import { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Brand } from "../components/Brand.jsx";
import {
  Check,
  GitHubIcon,
  GoogleIcon,
  Info,
  Lock,
  Refresh,
  Shield,
} from "../components/Icons.jsx";
import { useAuth } from "../auth/AuthProvider.jsx";
import { AuthLoading } from "../auth/AuthLoading.jsx";
import { PROVIDER_LABELS } from "../auth/providerLabels.js";
import { sanitizeNext } from "../../shared/nextPath.js";
import "../styles/login-v2.css";

const PROVIDERS = [
  { id: "google", label: "Continue with Google", icon: GoogleIcon },
  { id: "github", label: "Continue with GitHub", icon: GitHubIcon },
];

const ERROR_MESSAGES = {
  cancelled: "Sign-in was cancelled before your provider confirmed it. Choose a provider to try again.",
  state_invalid: "That sign-in attempt expired or could not be verified. Start again from this page.",
  provider_error: "The provider did not complete sign-in. Try again or choose a different provider.",
  exchange_failed: "The provider could not confirm your account with Insightx. Try again or choose a different provider.",
  nonce_invalid: "The provider response failed a security check. Start the sign-in again.",
  unavailable: "That provider is not configured on this deployment yet.",
  rate_limited: "Too many sign-in attempts. Wait a few minutes and try again.",
  session: "Your session could not be confirmed. Sign in again.",
};

export default function LoginPage() {
  const { status, user, providers, serviceAvailable, authError, refresh, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const next = useMemo(
    () => sanitizeNext(location.state?.from || params.get("next")),
    [location.state, params],
  );
  const configuredCount = Object.values(providers).filter(Boolean).length;
  const anyConfigured = configuredCount > 0;
  const errorCode = params.get("auth_error");
  const errorProvider = PROVIDER_LABELS[params.get("provider")];
  const errorMessage = errorCode
    ? `${errorProvider ? `${errorProvider}: ` : ""}${ERROR_MESSAGES[errorCode] || "Sign-in could not be completed. Try again."}`
    : authError;

  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, navigate, next]);

  if (status === "loading") return <AuthLoading />;
  if (user) {
    return <AuthLoading title="Opening your workspace" message="You are already signed in." />;
  }

  const statusBadge = !serviceAvailable
    ? { label: "Service offline", variant: "warning" }
    : anyConfigured
      ? { label: "Sign-in ready", variant: "success" }
      : { label: "Setup required", variant: "warning" };

  return (
    <div className="login-page-v2">
      <a className="skip-link" href="#login-content">
        Skip to sign in
      </a>

      <div className="login-hero">
        <div className="login-hero__content">
          <Link to="/" className="login-logo" aria-label="Insightx home">
            <Brand tone="dark" size="lg" />
          </Link>

          <div className="login-hero__text">
            <h1>Sign in to Insightx</h1>
            <p>Your dataset stays local. Only your account is confirmed via OAuth.</p>
          </div>

          <ul className="login-features">
            <li>
              <Check size={16} />
              OAuth handled by your provider
            </li>
            <li>
              <Check size={16} />
              Secure HTTP-only session
            </li>
            <li>
              <Check size={16} />
              Datasets never transmitted
            </li>
          </ul>
        </div>
      </div>

      <main className="login-card-section" id="login-content">
        <div className="login-card">
          <div className="login-card__header">
            <span className="login-status-badge" data-variant={statusBadge.variant}>
              {statusBadge.label}
            </span>
          </div>

          <div className="login-card__body">
            <h2>Welcome back</h2>
            <p className="login-subtitle">
              Use your Google or GitHub account to open your workspace.
            </p>

            {errorMessage && (
              <div className="login-alert login-alert--error" role="alert">
                <Info size={16} />
                <p>{errorMessage}</p>
              </div>
            )}

            <div className="login-providers-grid">
              {PROVIDERS.map((provider) => {
                const Icon = provider.icon;
                const configured = serviceAvailable && providers[provider.id];

                return (
                  <button
                    type="button"
                    key={provider.id}
                    className={"login-provider-btn " + (configured ? "" : "login-provider-btn--disabled")}
                    onClick={() => configured && signIn(provider.id, next)}
                    disabled={!configured}
                    aria-label={provider.label}
                    title={!configured ? (serviceAvailable ? "Not configured" : "Service unavailable") : ""}
                  >
                    <span className="login-provider-icon">
                      <Icon size={20} />
                    </span>
                    <span className="login-provider-text">
                      <span className="login-provider-label">{provider.label}</span>
                      <span className="login-provider-status">
                        {configured ? "Ready" : serviceAvailable ? "Not configured" : "Unavailable"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="login-message" role="status" aria-live="polite">
              {!serviceAvailable && (
                <>
                  <p className="login-message__text">
                    <strong>Sign-in service unavailable.</strong> Your dataset stays in this browser. Please retry in a moment.
                  </p>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => refresh()}
                    style={{ marginTop: "var(--space-3)" }}
                  >
                    <Refresh size={14} />
                    Retry connection
                  </button>
                </>
              )}
              {serviceAvailable && !anyConfigured && (
                <p className="login-message__text">
                  <strong>No provider is configured yet.</strong> The app owner needs to enable Google and GitHub sign-in.
                </p>
              )}
              {serviceAvailable && anyConfigured && !errorMessage && (
                <p className="login-message__text">
                  {configuredCount} of {PROVIDERS.length} providers available. Select one to continue.
                </p>
              )}
            </div>

            <div className="login-info-box">
              <Lock size={16} />
              <div>
                <span className="login-info-title">Privacy & Security</span>
                <p className="login-info-text">
                  Your provider password is never shared with Insightx. Datasets remain in this browser and are not transmitted during sign-in.
                </p>
              </div>
            </div>
          </div>

          <div className="login-card__footer">
            <div className="login-footer-links">
              <Link to="/#privacy" className="login-link">
                Privacy Policy
              </Link>
              <span className="login-link-divider">·</span>
              <Link to="/" className="login-link">
                Product Overview
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
