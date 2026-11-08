"use client";

import type { ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * The product card.
 *
 * Card art rather than a row: in the real app your card is the first thing on
 * the screen, rendered as the object you carry, with the balance on it. It
 * anchors the screen and makes the figure below it feel like it belongs to
 * something.
 *
 * The art is a flat dark field, not a photograph, so the type on it is
 * measurable — white on #070A0F is about 19:1, and the muted label still
 * clears the floor comfortably.
 */
export function CardTile({
  name,
  last4,
  balance,
  caption,
  locked,
  action,
}: {
  /** Product name, set in the spaced capitals the real cards use. */
  name: string;
  last4: string;
  balance: string;
  /** What the figure is — "Current balance", "Owed right now". */
  caption: string;
  locked?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#070a0f] p-5 text-white">
      {/* A single soft highlight, so the field reads as a surface not a block. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(22rem 14rem at 88% -20%, rgba(255,255,255,0.14), transparent 70%)",
        }}
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-[0.9375rem] font-semibold tracking-[0.14em] uppercase">
            {name}
          </p>
          <p className="tnum mt-0.5 text-[0.8125rem] text-white/70">•••• {last4}</p>
        </div>

        {locked ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[0.75rem] font-semibold">
            <Icon name="lock" size={14} />
            Locked
          </span>
        ) : null}
      </div>

      <div className="relative mt-6">
        <p className="text-[0.8125rem] text-white/70">{caption}</p>
        <p className="tnum mt-0.5 text-[2rem] leading-none font-semibold tracking-tight">
          {balance}
        </p>
      </div>

      {action ? <div className="relative mt-5">{action}</div> : null}
    </div>
  );
}
