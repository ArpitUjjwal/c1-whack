"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * The element that full-surface overlays should render into.
 *
 * An overlay that positions itself with `absolute inset-0` is at the mercy of
 * whichever ancestor happens to be positioned. On the customer surface that is
 * rarely the device: `Panel` carries `.bloom`, which sets `position: relative`
 * so the decorative glow has something to anchor to, so a sheet rendered
 * inside a card covered the card rather than the phone — scrim and all.
 *
 * Rather than ask every overlay's caller to be rendered in exactly the right
 * place, the frame publishes itself here and overlays portal into it. The
 * contract then holds wherever the component tree puts them.
 */
const OverlayRootContext = createContext<HTMLElement | null>(null);

export function OverlayRootProvider({
  node,
  children,
}: {
  node: HTMLElement | null;
  children: ReactNode;
}) {
  return (
    <OverlayRootContext.Provider value={node}>
      {children}
    </OverlayRootContext.Provider>
  );
}

/**
 * The current overlay root, or `null` when there is none — on the bank console
 * there is no device to stay inside, so overlays there render in place.
 */
export function useOverlayRoot() {
  return useContext(OverlayRootContext);
}
