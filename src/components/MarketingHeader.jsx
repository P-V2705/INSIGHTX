import { Link } from 'react-router-dom';
import { Brand } from './Brand.jsx';
import { ArrowUpRight } from './Icons.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';

export function MarketingHeader() {
  const { user } = useAuth();
  return (
    <header className="marketing-header">
      <div className="container marketing-header__inner">
        <Link to="/" aria-label="Insightx home" className="marketing-header__brand">
          <Brand tone="light" />
        </Link>
        <nav className="marketing-header__nav" aria-label="Primary">
          <a href="#workflow">How it works</a>
          <a href="#privacy">Privacy</a>
        </nav>
        <div className="marketing-header__actions">
          <Link to={user ? '/setup' : '/login'} className="marketing-signin">
            {user ? 'Open workspace' : 'Sign in'}
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
    </header>
  );
}
