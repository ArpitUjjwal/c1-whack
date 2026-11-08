"use client";

import { useState, type ReactNode } from "react";
import { OverlayRootProvider } from "@/components/ui/OverlayRoot";
import type { DevicePrefs } from "@/lib/device";

/**
 * The device.
 *
 * Sized and proportioned as an iPhone 15/16 — 393×852 logical pixels, a 51px
 * corner radius, a Dynamic Island and a home indicator — because the customer
 * surface is meant to read as the real Capital One app sitting beside the care
 * console, not as a web page in a rounded box.
 *
 * `relative` matters: nudges, sheets and the success overlay position against
 * this element rather than the viewport, so they stay inside the "device".
 *
 * Being the positioned ancestor is not enough on its own, though — it only
 * works for an overlay rendered as a direct child, which is true of the nudge
 * stack and the success overlay but not of a sheet opened from inside a card.
 * So the frame also publishes itself as the overlay root, and overlays that
 * must cover the whole device portal into it from wherever they are declared.
 *
 * There is exactly one frame element at every width. The bezel and the device
 * dimensions are applied with responsive classes rather than by rendering a
 * second copy — two copies would both claim the overlay root, and sheets would
 * portal into whichever one happened to mount last.
 *
 * Below `sm` it goes full-bleed: on a real phone the browser chrome is already
 * the frame, and drawing a second one wastes the only screen there is.
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
    <div className="flex min-h-dvh items-center justify-center bg-abyss p-0 sm:p-6">
      {/*
        The teal bloom over the navy field, as the UK app's own onboarding
        screens light it. Decorative, and behind everything.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(48rem 34rem at 50% 6%, rgba(36,68,85,0.9), transparent 66%), radial-gradient(38rem 28rem at 50% 104%, rgba(14,110,120,0.3), transparent 70%)",
        }}
      />

      {/* The titanium bezel, drawn only once there is room for it. */}
      <div className="relative z-10 w-full sm:w-auto sm:rounded-[3.75rem] sm:bg-[#2b2d33] sm:p-[11px] sm:shadow-[0_50px_140px_-30px_rgba(0,0,0,0.7)]">
        <div
          ref={setFrame}
          data-font={reading?.font}
          data-size={reading?.textSize}
          data-spacing={reading?.wideSpacing ? "wide" : undefined}
          data-tint={reading?.tint}
          data-contrast={reading?.highContrast ? "high" : undefined}
          className="relative flex h-dvh w-full flex-col overflow-hidden bg-void sm:h-[852px] sm:max-h-[86vh] sm:w-[393px] sm:rounded-[3.1875rem]"
        >
          {/* --------------------------------------------- device chrome -- */}
          {/* Decorative throughout, and excluded from every measurement. */}
          <div
            aria-hidden="true"
            data-load-ignore
            data-a11y-ignore
            className="relative z-30 flex h-[54px] shrink-0 items-center justify-between px-9 pt-3 text-fg"
          >
            <span className="text-[0.9375rem] font-semibold tracking-tight">9:41</span>

            {/* The Dynamic Island, floating over the status row. */}
            <span className="absolute top-[11px] left-1/2 hidden h-[36px] w-[125px] -translate-x-1/2 rounded-full bg-black sm:block" />

            <span className="flex items-center gap-[5px]">
              <SignalBars />
              <Wifi />
              <Battery />
            </span>
          </div>

          <OverlayRootProvider node={frame}>{children}</OverlayRootProvider>

          {/*
            The home indicator sits in the flex flow rather than over it, so
            the tab bar above it is never covered. Hidden below `sm`, where the
            real phone draws its own.
          */}
          <div
            aria-hidden="true"
            data-load-ignore
            data-a11y-ignore
            className="hidden h-[22px] shrink-0 items-center justify-center sm:flex"
          >
            <span className="h-[5px] w-[140px] rounded-full bg-fg/30" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- status icons ---- */
/*
  Inline rather than from an icon package: three glyphs do not justify a
  dependency, and these inherit `currentColor` so the high-contrast reading
  option carries them too.
*/

function SignalBars() {
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor" aria-hidden="true">
      <rect x="0" y="8" width="3" height="4" rx="1" />
      <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
      <rect x="10" y="3" width="3" height="9" rx="1" />
      <rect x="15" y="0.5" width="3" height="11.5" rx="1" />
    </svg>
  );
}

function Wifi() {
  return (
    <svg width="16" height="12" viewBox="0 0 16 12" fill="none" aria-hidden="true">
      <path
        d="M8 10.4 6.2 8.5a2.6 2.6 0 0 1 3.6 0L8 10.4ZM4.3 6.6a5.3 5.3 0 0 1 7.4 0l1.3-1.4a7.2 7.2 0 0 0-10 0l1.3 1.4ZM1.4 3.6a9.4 9.4 0 0 1 13.2 0L16 2.2a11.4 11.4 0 0 0-16 0l1.4 1.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Battery() {
  return (
    <svg width="26" height="13" viewBox="0 0 26 13" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="22" height="12" rx="3.5" stroke="currentColor" opacity="0.4" />
      <rect x="2" y="2" width="19" height="9" rx="2.2" fill="currentColor" />
      <path d="M24 4.5v4a2.1 2.1 0 0 0 0-4Z" fill="currentColor" opacity="0.4" />
    </svg>
  );
}
