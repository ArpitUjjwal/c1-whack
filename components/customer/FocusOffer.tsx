"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";

/**
 * The Safe Mode offer.
 *
 * This is the only point at which the adaptive layer speaks to the customer,
 * and the wording carries real weight. It does not diagnose, it does not
 * mention a score, and it does not say anything about how the customer is
 * behaving — being told an app has noticed you are struggling is its own
 * small humiliation.
 *
 * It says what it will do, in words, and it offers a plain "no" that is
 * remembered. Declining it once ends the matter for good.
 */
export function FocusOffer({
  open,
  onAccept,
  onDecline,
}: {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="focus-offer"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
          role="region"
          aria-label="Simpler screen offer"
        >
          <div className="glass bloom rounded-xl2 border-calm/25 bg-calm-dim p-4">
            <p className="text-[0.9375rem] font-semibold text-fg">
              Want this screen simpler?
            </p>
            <p className="mt-1 text-[0.9375rem] text-fg-2">
              I can hide everything except the one thing that needs you. Nothing
              is deleted and you can bring it all back any time.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="calm" onClick={onAccept}>
                Yes, simplify it
              </Button>
              <Button size="sm" variant="ghost" onClick={onDecline}>
                No, leave it as it is
              </Button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
