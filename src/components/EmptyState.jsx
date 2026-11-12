export function EmptyState({ icon, title, children, action, compact = false }) {
  return (
    <div className={`empty-state${compact ? ' empty-state--compact' : ''}`}>
      {icon && <span className="empty-state__icon">{icon}</span>}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
