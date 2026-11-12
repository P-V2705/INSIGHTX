const baseProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  focusable: 'false',
  'aria-hidden': 'true',
};

function IconBase({ size = 18, children, viewBox = '0 0 24 24', ...rest }) {
  return (
    <svg width={size} height={size} viewBox={viewBox} {...baseProps} {...rest}>
      {children}
    </svg>
  );
}

export function ArrowRight({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </IconBase>
  );
}

export function ArrowLeft({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="M20 12H5" />
      <path d="m11 6-6 6 6 6" />
    </IconBase>
  );
}

export function ArrowUpRight({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </IconBase>
  );
}

export function Check({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="m5 12.5 4.2 4.2L19 6.8" />
    </IconBase>
  );
}

export function CheckCircle({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.2 12.3 2.6 2.6 5.1-5.3" />
    </IconBase>
  );
}

export function Lock({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </IconBase>
  );
}

export function Upload({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4.5 15.5v2.8A1.7 1.7 0 0 0 6.2 20h11.6a1.7 1.7 0 0 0 1.7-1.7v-2.8" />
    </IconBase>
  );
}

export function FileText({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </IconBase>
  );
}

export function Database({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
      <path d="M4.5 5.5v6c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-6" />
      <path d="M4.5 11.5v6c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-6" />
    </IconBase>
  );
}

export function Table({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M9.5 9.5v10" />
    </IconBase>
  );
}

export function Sparkle({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9Z" />
      <path d="M18.5 16.5 19.2 19l2.3.7-2.3.8-.7 2.2-.8-2.2-2.2-.8 2.2-.7Z" />
    </IconBase>
  );
}

export function TrendUp({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="M4 16.5 9.5 11l3.5 3 6.5-7" />
      <path d="M14.5 7H20v5.5" />
    </IconBase>
  );
}

export function ChartBar({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </IconBase>
  );
}

export function Gauge({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="M4.5 18a8.5 8.5 0 1 1 15 0" />
      <path d="m12 14 4-4.5" />
      <circle cx="12" cy="14.5" r="1.4" />
    </IconBase>
  );
}

export function Download({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="M12 4v11" />
      <path d="m7.5 11 4.5 4.5L16.5 11" />
      <path d="M5 20h14" />
    </IconBase>
  );
}

export function Shield({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="M12 3.5 19 6v5.5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6Z" />
      <path d="m8.8 11.8 2.2 2.2 4.2-4.4" />
    </IconBase>
  );
}

export function Close({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="m6 6 12 12M18 6 6 18" />
    </IconBase>
  );
}

export function AlertTriangle({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="M10.4 4.2 2.9 17.3A1.8 1.8 0 0 0 4.5 20h15a1.8 1.8 0 0 0 1.6-2.7L13.6 4.2a1.85 1.85 0 0 0-3.2 0Z" />
      <path d="M12 9v4.2M12 16.6v.1" />
    </IconBase>
  );
}

export function Info({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.7v5.4M12 7.6v.1" />
    </IconBase>
  );
}

export function ChevronDown({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  );
}

export function Layers({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="m12 3 8.5 4.6L12 12.2 3.5 7.6Z" />
      <path d="m4 12 8 4.3 8-4.3M4 16.4l8 4.3 8-4.3" />
    </IconBase>
  );
}

export function Rows({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 12h17M8.5 4.5v15" />
    </IconBase>
  );
}

export function Compass({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5.2-5 1.8 2-5.2Z" />
    </IconBase>
  );
}

export function Clock({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </IconBase>
  );
}

export function ExternalLink({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10" />
    </IconBase>
  );
}

export function Refresh({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="M20 11a8 8 0 0 0-14.7-4.5M4 5.5V10h4.5" />
      <path d="M4 13a8 8 0 0 0 14.7 4.5M20 18.5V14h-4.5" />
    </IconBase>
  );
}

export function Minus({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="M5 12h14" />
    </IconBase>
  );
}

export function ArrowDownRight({ size, ...rest }) {
  return (
    <IconBase size={size} {...rest}>
      <path d="M7 7l10 10" />
      <path d="M17 8v9H8" />
    </IconBase>
  );
}

export function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.4 5.4 0 0 1-2.4 3.58v3h3.85c2.25-2.08 3.57-5.14 3.57-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.85-3c-1.08.72-2.45 1.16-4.08 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.29V6.62H1.29A11.99 11.99 0 0 0 0 12c0 1.93.46 3.76 1.29 5.38l3.98-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.7 0 3.99 2.47 1.29 6.09l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

export function GitHubIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.97.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.2.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}
