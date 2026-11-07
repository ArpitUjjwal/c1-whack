import type { ReactNode } from "react";

type Tone = "neutral" | "pos" | "attn" | "calm" | "link" | "red";

const tones: Record<Tone, string> = {
  neutral: "bg-glass text-fg-2 border-edge",
  pos: "bg-pos-dim text-pos border-pos/25",
  attn: "bg-attn-dim text-attn border-attn/25",
  calm: "bg-calm-dim text-calm border-calm/25",
  link: "bg-link-dim text-link border-link/25",
  red: "bg-red-dim text-red-fg border-red-fg/25",
};

export function StatusPill({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
