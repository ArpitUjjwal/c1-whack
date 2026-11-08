"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "brand" | "primary" | "calm" | "pos" | "danger" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

/*
  No radius here. It lives on the variants instead, because the brand button is
  a full pill and a `rounded-full` in the variant string would lose to a
  `rounded-xl` in this one — Tailwind resolves that by stylesheet order, not by
  the order the classes appear in the attribute.
*/
const base =
  "relative inline-flex items-center justify-center gap-2 font-semibold " +
  "transition-[transform,background-color,border-color,box-shadow,opacity] duration-150 " +
  "active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40 " +
  "disabled:active:scale-100 select-none";

/*
  Accent fills carry canvas-light text (`text-void`), not ink. Every accent is
  deep enough that this clears 6:1, and on a light field a saturated fill with
  light type reads as deliberate rather than as a default button.
*/
const variants: Record<Variant, string> = {
  /*
    The Capital One UK primary: yellow fill, navy label, fully rounded. Navy on
    this yellow is 11.2:1. `text-on-cta` is the only foreground the yellow is
    allowed to carry — as a text colour on white it would be 1.30:1.
  */
  brand: "rounded-full bg-cta text-on-cta hover:brightness-[1.04]",
  primary: "rounded-xl bg-link text-void hover:brightness-110",
  calm: "rounded-xl bg-calm text-void hover:brightness-110",
  pos: "rounded-xl bg-pos text-void hover:brightness-110",
  // The one place red is allowed on an action: white on red is 5.1:1.
  danger: "rounded-xl bg-red text-white hover:brightness-110",
  outline:
    "rounded-xl bg-glass text-fg border border-edge hover:bg-glass-2 hover:border-edge-2",
  ghost: "rounded-xl bg-transparent text-fg-2 hover:text-fg hover:bg-glass",
};

/** 44px minimum height at every size — comfortable, reachable targets. */
const sizes: Record<Size, string> = {
  sm: "min-h-11 px-3.5 text-sm",
  md: "min-h-12 px-5 text-[0.9375rem]",
  lg: "min-h-14 px-6 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  /** Decorative leading glyph — hidden from assistive tech. */
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", fullWidth, icon, className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`${base} ${variants[variant]} ${sizes[size]} ${
        fullWidth ? "w-full" : ""
      } ${className}`}
      {...rest}
    >
      {icon ? (
        <span aria-hidden="true" className="text-[1.05em] leading-none">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </button>
  );
});
