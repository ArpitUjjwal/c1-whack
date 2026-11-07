"use client";

import type { ReactNode, Ref } from "react";

/**
 * Simulated phone. Width is constrained so the customer surface still reads as
 * a native app when it is one of two windows on a demo laptop.
 *
 * `relative` matters: nudges, sheets and the success overlay position against
 * this element rather than the viewport, so they stay inside the "device".
 */
export function PhoneFrame({
  children,
  frameRef,
}: {
  children: ReactNode;
  frameRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div className="noise flex min-h-dvh items-center justify-center bg-abyss p-0 sm:p-6">
      {/* Ambient field behind the device. Decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60rem 40rem at 50% -10%, rgba(79,156,249,0.10), transparent 70%), radial-gradient(40rem 30rem at 50% 110%, rgba(157,140,255,0.08), transparent 70%)",
        }}
      />
      <div
        ref={frameRef}
        className="relative z-10 mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-void sm:h-[880px] sm:max-h-[94vh] sm:rounded-[2.5rem] sm:ring-1 sm:ring-edge-2 sm:shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]"
      >
        {/* Device chrome. Decorative, and excluded from every measurement. */}
        <div
          aria-hidden="true"
          data-load-ignore
          data-a11y-ignore
          className="flex shrink-0 items-center justify-between px-7 pt-3 pb-1 text-[0.6875rem] font-medium text-fg-3"
        >
          <span>9:41</span>
          <span className="flex items-center gap-1.5">
            <span>5G</span>
            <span>100%</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
