import { Link } from 'react-router-dom';
import { ArrowRight, Lock } from './Icons.jsx';

export function PageHeader({ eyebrow, title, description, actions, aside }) {
  return (
    <div className="page-header">
      <div className="page-header__copy">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {(actions || aside) && <div className="page-header__aside">{actions || aside}</div>}
    </div>
  );
}

export function StageGate({
  stage,
  title,
  description,
  primaryTo,
  primaryLabel,
  secondaryTo,
  secondaryLabel,
}) {
  return (
    <section className="stage-gate">
      <span className="stage-gate__icon" aria-hidden="true">
        <Lock size={22} />
      </span>
      <span className="eyebrow">{stage}</span>
      <h1>{title}</h1>
      <p>{description}</p>
      <div className="stage-gate__actions">
        <Link to={primaryTo} className="btn btn--primary">
          {primaryLabel}
          <ArrowRight size={16} />
        </Link>
        {secondaryTo && (
          <Link to={secondaryTo} className="btn btn--secondary">
            {secondaryLabel}
          </Link>
        )}
      </div>
    </section>
  );
}
