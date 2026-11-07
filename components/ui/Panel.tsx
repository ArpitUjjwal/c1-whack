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
    link: "rgba(79,156,249,0.16)",
    pos: "rgba(61,220,151,0.14)",
    attn: "rgba(240,169,59,0.14)",
    calm: "rgba(157,140,255,0.16)",
    red: "rgba(204,36,39,0.16)",
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
