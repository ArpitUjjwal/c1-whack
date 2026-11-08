import Image from "next/image";

/**
 * The Capital One wordmark.
 *
 * Two variants of the same asset: the supplied navy mark, and a recoloured one
 * where the wordmark is white for dark surfaces. In both the red swoosh is
 * left exactly as it is — it is the only place red appears anywhere in the
 * customer app, and it is branding, never a warning.
 *
 * Every surface here is light paper, so the navy mark is the default and the
 * white one is kept only for a dark fill.
 */

/** Intrinsic pixel size of both files, used for the aspect ratio. */
const WIDTH = 330;
const HEIGHT = 119;

export function CapitalOneMark({
  className = "w-24",
  tone = "dark",
  priority = true,
}: {
  /** Controls the width; height follows from the aspect ratio. */
  className?: string;
  /** "dark" is the navy mark for light surfaces; "light" is the white mark for dark ones. */
  tone?: "light" | "dark";
  priority?: boolean;
}) {
  return (
    <Image
      src={tone === "light" ? "/capital-one-white.png" : "/capital-one.png"}
      alt="Capital One"
      width={WIDTH}
      height={HEIGHT}
      priority={priority}
      className={`h-auto ${className}`}
    />
  );
}
