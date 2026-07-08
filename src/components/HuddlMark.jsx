import { useId } from 'react';

/**
 * Huddl brand mark — the teal→purple gradient tile with the kanban "H",
 * matching the marketing site (site/images/huddl-icon.svg).
 * Size it with a Tailwind className (e.g. "w-9 h-9 rounded-xl").
 */
export default function HuddlMark({ className }) {
  const gradientId = useId();
  return (
    <svg
      className={className}
      viewBox="0 0 88 88"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Huddl"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#33C4A3" />
          <stop offset="1" stopColor="#7C5EF5" />
        </linearGradient>
      </defs>
      <rect width="88" height="88" rx="20" fill={`url(#${gradientId})`} />
      <rect x="22" y="22" width="12" height="44" rx="6" fill="#ffffff" />
      <rect x="54" y="22" width="12" height="44" rx="6" fill="#ffffff" />
      <rect x="34" y="38" width="20" height="12" rx="6" fill="#ffffff" />
      <circle cx="44" cy="44" r="3.5" fill="#33C4A3" />
    </svg>
  );
}
