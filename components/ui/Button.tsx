"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "calm" | "pos" | "danger" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-xl font-semibold " +
  "transition-[transform,background-color,border-color,box-shadow,opacity] duration-150 " +
  "active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40 " +
  "disabled:active:scale-100 select-none";

/*
  Bright accents carry near-black text rather than white. On a dark field that
  is both the higher-contrast choice and the one that reads as deliberate
  rather than as a default button.
*/
const variants: Record<Variant, string> = {
  primary: "bg-link text-void hover:brightness-110",
  calm: "bg-calm text-void hover:brightness-110",
  pos: "bg-pos text-void hover:brightness-110",
  // The one place red is allowed on an action: white on red is 5.5:1.
  danger: "bg-red text-white hover:brightness-110",
  outline:
    "bg-glass text-fg border border-edge hover:bg-glass-2 hover:border-edge-2",
  ghost: "bg-transparent text-fg-2 hover:text-fg hover:bg-glass",
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
