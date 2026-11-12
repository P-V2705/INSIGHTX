export function Notice({ tone = 'info', title, children, id, role }) {
  const icon = {
    info: 'i',
    success: '✓',
    warning: '!',
    error: '!',
  }[tone];

  return (
    <div
      className={`notice notice--${tone}`}
      id={id}
      role={role || (tone === 'error' ? 'alert' : 'status')}
    >
      <span className="notice__icon" aria-hidden="true">
        {icon}
      </span>
      <div className="notice__body">
        {title && <strong className="notice__title">{title}</strong>}
        {children && <div className="notice__text">{children}</div>}
      </div>
    </div>
  );
}
