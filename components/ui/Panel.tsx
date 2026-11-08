import type { ReactNode } from "react";

/**
 * The single surface primitive. Everything on both screens is one of these, so
 * depth stays consistent and there is exactly one glass recipe to audit.
 */
export function Panel({
  children,
  className = "",
  as: Tag = "section",
  bloom,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "aside";
  /** Optional coloured glow behind the panel. Decorative only. */
  bloom?: "link" | "pos" | "attn" | "calm" | "red";
} & Record<string, unknown>) {
  const bloomColor: Record<string, string> = {
    link: "rgba(15,86,184,0.08)",
    pos: "rgba(7,107,72,0.08)",
    attn: "rgba(122,73,0,0.08)",
    calm: "rgba(81,52,196,0.08)",
    red: "rgba(204,36,39,0.08)",
  };

  return (
    <Tag
      className={`glass rounded-xl2 ${bloom ? "bloom" : ""} ${className}`}
      style={
        bloom
          ? ({ "--bloom-color": bloomColor[bloom] } as React.CSSProperties)
          : undefined
      }
      {...rest}
    >
      {children}
    </Tag>
  );
}
