import { CapitalOneMark } from "./CapitalOneMark";

/**
 * Shown for the frame before the client store comes up. Deliberately still
 * rather than a shimmer — a skeleton that flickers is worse than a calm hold
 * for anyone sensitive to motion.
 */
export function LoadingShell({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="noise flex min-h-dvh flex-col items-center justify-center gap-5 bg-void"
    >
      <CapitalOneMark className="w-36" />
      <p className="text-sm font-medium text-fg-3">{label}</p>
    </div>
  );
}
