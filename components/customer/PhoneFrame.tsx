"use client";

import { useState, type ReactNode } from "react";
import { OverlayRootProvider } from "@/components/ui/OverlayRoot";
import type { DevicePrefs } from "@/lib/device";

/**
 * Simulated phone. Width is constrained so the customer surface still reads as
 * a native app when it is one of two windows on a demo laptop.
 *
 * `relative` matters: nudges, sheets and the success overlay position against
 * this element rather than the viewport, so they stay inside the "device".
 *
 * Being the positioned ancestor is not enough on its own, though — it only
 * works for an overlay rendered as a direct child, which is true of the nudge
 * stack and the success overlay but not of a sheet opened from inside a card.
 * So the frame also publishes itself as the overlay root, and overlays that
 * must cover the whole device portal into it from wherever they are declared.
 */
export function PhoneFrame({
  children,
  reading,
}: {
  children: ReactNode;
  /** The customer's reading options. Applied as data attributes; see globals.css. */
  reading?: Pick<DevicePrefs, "font" | "textSize" | "wideSpacing" | "tint" | "highContrast">;
}) {
  /*
    State rather than a ref: the overlay root is read during render by the
    components portalling into it, so they have to re-render once it exists.
  */
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);

  return (
    <div className="noise flex min-h-dvh items-center justify-center bg-abyss p-0 sm:p-6">
      {/* Ambient field behind the device. Decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60rem 40rem at 50% -10%, rgba(15,86,184,0.07), transparent 70%), radial-gradient(40rem 30rem at 50% 110%, rgba(81,52,196,0.06), transparent 70%)",
        }}
      />
      <div
        ref={setFrame}
        data-font={reading?.font}
        data-size={reading?.textSize}
        data-spacing={reading?.wideSpacing ? "wide" : undefined}
        data-tint={reading?.tint}
        data-contrast={reading?.highContrast ? "high" : undefined}
        className="relative z-10 mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-void sm:h-[880px] sm:max-h-[94vh] sm:rounded-[2.5rem] sm:ring-1 sm:ring-edge-2 sm:shadow-[0_40px_120px_-20px_rgba(13,21,34,0.18)]"
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
        <OverlayRootProvider node={frame}>{children}</OverlayRootProvider>
      </div>
    </div>
  );
}
