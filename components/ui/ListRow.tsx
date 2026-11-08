"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/**
 * The chevron row.
 *
 * The single most repeated shape in the Capital One app — a leading icon, a
 * title, sometimes a line of detail, and a chevron. The whole "My card" screen
 * is a stack of these, and so is the wallet list.
 *
 * It renders as a `<button>` when it does something and a plain `<div>` when
 * it only states something, rather than a button that ignores its own click.
 * Either way the row is the target, never the chevron: 56px minimum, the full
 * width of the group.
 */
export function ListRow({
  icon,
  title,
  detail,
  value,
  onClick,
  tone = "default",
  trailing = "chevron",
}: {
  icon?: IconName;
  title: string;
  /** A second line under the title. */
  detail?: string;
  /** Right-aligned value, shown before the chevron. */
  value?: ReactNode;
  onClick?: () => void;
  /** `danger` tints the icon and title for destructive or alerting rows. */
  tone?: "default" | "danger";
  trailing?: "chevron" | "arrow" | "none";
}) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={`flex min-h-14 w-full items-center gap-3.5 px-4 py-3 text-left ${
        onClick ? "hover:bg-deep active:bg-deep" : ""
      }`}
    >
      {icon ? (
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            tone === "danger" ? "bg-red-dim text-red-fg" : "bg-link-dim text-link"
          }`}
        >
          <Icon name={icon} size={20} />
        </span>
      ) : null}

      <span className="min-w-0 flex-1">
        <span
          className={`block text-[0.9375rem] font-medium ${
            tone === "danger" ? "text-red-fg" : "text-fg"
          }`}
        >
          {title}
        </span>
        {detail ? (
          <span className="mt-0.5 block text-[0.8125rem] leading-snug text-fg-3">
            {detail}
          </span>
        ) : null}
      </span>

      {value ? (
        <span className="tnum shrink-0 text-[0.9375rem] font-semibold text-fg">
          {value}
        </span>
      ) : null}

      {trailing !== "none" ? (
        <Icon
          name={trailing}
          size={trailing === "chevron" ? 18 : 20}
          className="shrink-0 text-link"
        />
      ) : null}
    </Tag>
  );
}

/**
 * The white card that holds a run of rows, with hairlines between them and
 * none at the ends — the grouped-list look the real app uses everywhere.
 */
export function ListGroup({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-glass [&>*+*]:border-t [&>*+*]:border-edge">
      {children}
    </div>
  );
}
