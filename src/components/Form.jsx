import { ChevronDown } from './Icons.jsx';

export function SelectField({ id, label, value, onChange, disabled, hint, children, className = '' }) {
  return (
    <div className={`field ${className}`.trim()}>
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <div className="select-shell">
        <select
          id={id}
          className="select"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        >
          {children}
        </select>
        <ChevronDown size={15} className="select-shell__chevron" />
      </div>
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}

export function SegmentedControl({ label, value, onChange, options, hint, id }) {
  return (
    <div className="field" id={id}>
      <span className="field__label">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`segmented__option${value === option.value ? ' is-active' : ''}`}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}

export function FormHint({ children, id }) {
  return (
    <p className="field__hint" id={id}>
      {children}
    </p>
  );
}
