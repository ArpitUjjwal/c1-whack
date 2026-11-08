import type { ReactElement, SVGProps } from "react";

/**
 * The icon set.
 *
 * Inline paths rather than an icon package: the whole app needs about a dozen
 * glyphs, and a dependency for that would cost more than it saves. Every icon
 * is a 24×24 stroked outline inheriting `currentColor`, so the high-contrast
 * reading option and every accent token carry them without a second variant.
 *
 * Icons here are decorative by default — `aria-hidden` unless a `title` is
 * passed. A row's meaning always lives in its text, never in the glyph.
 */

export type IconName =
  | "home"
  | "ahead"
  | "card"
  | "help"
  | "chevron"
  | "arrow"
  | "lock"
  | "shield"
  | "clock"
  | "info"
  | "plus"
  | "pay"
  | "settings"
  | "speaker"
  | "check";

const paths: Record<IconName, ReactElement> = {
  home: (
    <path d="M3.6 10.2 12 3.6l8.4 6.6M5.7 8.6v10.3a.9.9 0 0 0 .9.9h10.8a.9.9 0 0 0 .9-.9V8.6" />
  ),
  ahead: (
    <>
      <rect x="3.4" y="5" width="17.2" height="15.1" rx="2.4" />
      <path d="M3.4 9.6h17.2M8.2 3.3v3.4M15.8 3.3v3.4M12 12.6v3.6M10.2 14.4h3.6" />
    </>
  ),
  card: (
    <>
      <rect x="2.6" y="5.2" width="18.8" height="13.6" rx="2.6" />
      <path d="M2.6 9.9h18.8M6.1 14.8h3.4" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.9" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.5" />
      <path d="M12 16.9h.01" />
    </>
  ),
  chevron: <path d="M9.2 5.4 15.8 12l-6.6 6.6" />,
  arrow: <path d="M4.5 12h14.4m-5.6-5.7 5.7 5.7-5.7 5.7" />,
  lock: (
    <>
      <rect x="4.6" y="10.3" width="14.8" height="10.1" rx="2.4" />
      <path d="M8.1 10.3V7.6a3.9 3.9 0 0 1 7.8 0v2.7" />
    </>
  ),
  shield: <path d="M12 3.2 4.8 6.1v5.3c0 4.2 3 7.8 7.2 9.4 4.2-1.6 7.2-5.2 7.2-9.4V6.1L12 3.2Z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.9" />
      <path d="M12 6.9V12l3.4 2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.9" />
      <path d="M12 11.1v5.3M12 7.8h.01" />
    </>
  ),
  plus: <path d="M12 5.2v13.6M5.2 12h13.6" />,
  pay: (
    <>
      <rect x="2.6" y="6" width="18.8" height="12" rx="2.4" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.1 14.4a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.6 1.1v.2a1.8 1.8 0 1 1-3.6 0v-.1a1.5 1.5 0 0 0-2.6-1.1l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0-1.1-2.6h-.2a1.8 1.8 0 1 1 0-3.6h.1a1.5 1.5 0 0 0 1.1-2.6l-.1-.1A1.8 1.8 0 1 1 7.7 4.7l.1.1a1.5 1.5 0 0 0 2.6-1.1v-.2a1.8 1.8 0 1 1 3.6 0v.1a1.5 1.5 0 0 0 2.6 1.1l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0 1.1 2.6h.2a1.8 1.8 0 1 1 0 3.6h-.1a1.5 1.5 0 0 0-1.3.9Z" />
    </>
  ),
  speaker: (
    <>
      <path d="M11 4.9 6.4 8.7H3.2v6.6h3.2L11 19.1V4.9Z" />
      <path d="M15.6 8.9a4.4 4.4 0 0 1 0 6.2M18.4 6.1a8.3 8.3 0 0 1 0 11.8" />
    </>
  ),
  check: <path d="M4.8 12.6 9.6 17.4 19.2 6.6" />,
};

export function Icon({
  name,
  size = 24,
  title,
  className = "",
  ...rest
}: {
  name: IconName;
  size?: number;
  /** Supply only when the icon is the sole carrier of meaning. */
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
