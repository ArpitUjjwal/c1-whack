import Image from "next/image";

/**
 * The Capital One wordmark.
 *
 * Two variants of the same asset: the supplied navy mark for light surfaces,
 * and a recoloured one for navy surfaces where the wordmark is white and the
 * red swoosh is left exactly as it is. The swoosh is the only place red
 * appears anywhere in the customer app — it is branding, never a warning.
 */

/** Intrinsic pixel size of both files, used for the aspect ratio. */
const WIDTH = 330;
const HEIGHT = 119;

export function CapitalOneMark({
  className = "w-24",
  tone = "light",
  priority = true,
}: {
  /** Controls the width; height follows from the aspect ratio. */
  className?: string;
  /** "light" for navy backgrounds, "dark" for white ones. */
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
