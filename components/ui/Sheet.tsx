"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useOverlayRoot } from "./OverlayRoot";

/**
 * Bottom sheet dialog, scoped to the phone frame rather than the viewport so
 * the demo still looks like a phone when both windows are side by side.
 *
 * It renders through a portal into the frame rather than in place. `absolute
 * inset-0` resolves against the nearest positioned ancestor, and the sheets
 * are opened from inside cards — `Panel` sets `position: relative` whenever it
 * carries a bloom — so rendering in place scoped the sheet, and its scrim, to
 * a single card: the sheet floated mid-screen with its top clipped by the
 * scrolling main, and the rest of the app stayed lit and clickable behind it.
 *
 * Accessibility: `role="dialog"` + `aria-modal`, labelled by its own heading,
 * focus moves in on open and returns to the trigger on close, Escape closes,
 * and Tab is kept inside the sheet while it is open.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const overlayRoot = useOverlayRoot();

  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    // Land on the first control rather than dumping the user at the top.
    const t = window.setTimeout(() => focusables()[0]?.focus(), 60);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  const sheet = (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="sheet"
          className="absolute inset-0 z-40 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-scrim backdrop-blur-sm"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className="glass-2 relative w-full rounded-t-xl3 bg-deep px-5 pt-4 pb-6"
          >
            <div
              aria-hidden="true"
              className="mx-auto mb-4 h-1 w-10 rounded-full bg-edge-2"
            />
            <h2 id={titleId} className="text-xl font-semibold text-fg">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-1.5 text-[0.9375rem] text-fg-2">
                {description}
              </p>
            ) : null}
            <div className="mt-5">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  /*
    No overlay root means no device to stay inside — render in place. The root
    is also null on the very first client render, before the frame's callback
    ref has run, which is harmless: a sheet is only ever opened by a tap.
  */
  return overlayRoot ? createPortal(sheet, overlayRoot) : sheet;
}
