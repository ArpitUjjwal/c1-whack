/**
 * The grey band that labels a run of rows — "Available", "Connected",
 * "Next 2 weeks". Quiet by design: it names the group without competing with
 * the rows underneath it.
 *
 * It is a real heading, so the document outline the Proof Layer measures
 * matches the grouping a sighted reader sees. `level` exists because the right
 * rank depends on what is above it on that screen.
 */
export function SectionHeader({
  children,
  level = 3,
  className = "",
}: {
  children: string;
  level?: 2 | 3 | 4;
  className?: string;
}) {
  const Tag = `h${level}` as "h2" | "h3" | "h4";
  return (
    <Tag
      className={`px-4 pt-5 pb-2 text-[0.8125rem] font-semibold tracking-[0.02em] text-fg-3 ${className}`}
    >
      {children}
    </Tag>
  );
}
