import { Link } from 'react-router-dom';
import { MarketingHeader } from '../components/MarketingHeader.jsx';
import { SiteFooter } from '../components/SiteFooter.jsx';
import { ArrowRight } from '../components/Icons.jsx';

export default function NotFoundPage() {
  return (
    <div className="notfound-page">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <MarketingHeader />
      <main id="main-content" className="notfound-main">
        <div className="notfound__pattern" aria-hidden="true" />
        <div className="container notfound__inner">
          <span className="notfound__code mono" aria-hidden="true">
            404
          </span>
          <span className="eyebrow">Route not found</span>
          <h1>That page is outside this workspace.</h1>
          <p>
            Insightx moves through four stages: about, session setup, analysis, and final report. The address you
            opened is not one of them.
          </p>
          <div className="notfound__actions">
            <Link to="/" className="btn btn--primary">
              Back to overview
              <ArrowRight size={16} />
            </Link>
            <Link to="/setup" className="btn btn--secondary">
              Start a dataset session
            </Link>
          </div>
          <nav className="notfound__rail" aria-label="Workspace stages">
            <span>Workspace stages</span>
            <Link to="/setup">Session setup</Link>
            <Link to="/analysis">Analysis</Link>
            <Link to="/report">Final report</Link>
          </nav>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
