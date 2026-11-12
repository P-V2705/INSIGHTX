import { Brand } from '../components/Brand.jsx';

export function AuthLoading({
  title = 'Securing your session',
  message = 'Checking with the Insightx sign-in service…',
}) {
  return (
    <div className="auth-loading" role="status" aria-live="polite">
      <div className="auth-loading__glow" aria-hidden="true" />
      <div className="auth-loading__inner">
        <Brand tone="light" />
        <span className="loading-mark auth-loading__mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <h1>{title}</h1>
        <p>{message}</p>
      </div>
    </div>
  );
}
