export function Brand({ tone = 'dark', size = 'md' }) {
  return (
    <span className={`brand brand--${tone} brand--${size}`}>
      <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <rect className="brand__tile" width="32" height="32" rx="8.5" />
        <path
          className="brand__line"
          d="M7.5 21.8 12.6 16.7l3.7 2.9 7.4-8.9"
          fill="none"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle className="brand__dot" cx="7.5" cy="21.8" r="1.9" />
        <circle className="brand__dot-end" cx="24.5" cy="10.7" r="1.9" />
      </svg>
      <span className="brand__word">
        Insight<span className="brand__x">x</span>
      </span>
    </span>
  );
}
