import Link from "next/link";
import { CapitalOneMark } from "@/components/ui/CapitalOneMark";

/**
 * Demo launcher. Open the two routes in separate windows side by side — they
 * share one state object and stay in step with no server involved.
 */
export default function Home() {
  return (
    <div className="noise relative min-h-dvh bg-void text-fg">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(70rem 45rem at 20% -10%, rgba(79,156,249,0.14), transparent 65%), radial-gradient(55rem 40rem at 85% 10%, rgba(157,140,255,0.10), transparent 65%)",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-6 py-16">
        <CapitalOneMark className="w-32" />

        <p className="mt-12 text-xs font-semibold tracking-[0.2em] text-link uppercase">
          Make Credit Accessible
        </p>
        <h1 className="display mt-3 text-5xl tracking-tight sm:text-6xl">
          Clarity
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-fg-2">
          Credit isn&apos;t inaccessible because the information is missing.
          It&apos;s inaccessible because the interface demands executive
          function the customer doesn&apos;t have in that moment — and then the
          bank&apos;s own outreach spends what little is left.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link
            href="/customer"
            className="glass group rounded-xl2 p-6 transition-colors hover:border-edge-2 hover:bg-glass-2"
          >
            <p className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
              Route 1 · /customer
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Alex&apos;s phone</h2>
            <p className="mt-2 text-[0.9375rem] text-fg-2">
              Measures the executive load it is demanding, and offers to reduce
              it. One safe-to-spend number, jargon folded away, a missed payment
              framed as fixable rather than shameful.
            </p>
            <p className="mt-4 text-sm font-semibold text-link underline underline-offset-4">
              Open the app →
            </p>
          </Link>

          <Link
            href="/bank"
            className="glass group rounded-xl2 p-6 transition-colors hover:border-edge-2 hover:bg-glass-2"
          >
            <p className="text-xs font-semibold tracking-[0.12em] text-fg-3 uppercase">
              Route 2 · /bank
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Care console</h2>
            <p className="mt-2 text-[0.9375rem] text-fg-2">
              Scores the agent&apos;s own language before it is sent, reads the
              14-day silence as a signal, and plays out thirty days under two
              policies side by side.
            </p>
            <p className="mt-4 text-sm font-semibold text-link underline underline-offset-4">
              Open the console →
            </p>
          </Link>
        </div>

        <section className="glass mt-10 rounded-xl2 p-6">
          <h2 className="text-lg font-semibold">Three mechanisms, not three claims</h2>
          <dl className="mt-4 space-y-4 text-[0.9375rem]">
            <div>
              <dt className="font-semibold text-fg">Cognitive Load Meter</dt>
              <dd className="text-fg-2">
                Scores what the screen demands, watches how hard the customer is
                finding it, and offers Focus Mode. It only ever removes or
                enlarges, always says what it did, and never asks twice.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-fg">Pressure Index</dt>
              <dd className="text-fg-2">
                Scores every outgoing message as the agent types it, highlights
                the exact words doing harm, and rewrites them. Red appears here
                and in the logo — never on the customer&apos;s own money.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-fg">Silence Model</dt>
              <dd className="text-fg-2">
                Treats not-opening-the-app as information. Six features,
                hand-tuned weights, every contribution shown — explicitly not
                trained on anything, so it can be argued with.
              </dd>
            </div>
          </dl>
        </section>

        <p className="mt-8 text-sm text-fg-3">
          Press{" "}
          <kbd className="glass rounded px-1.5 py-0.5 text-xs text-fg-2">?</kbd>{" "}
          on either surface for the judge overlay and the live accessibility
          proof panel.
        </p>
      </div>
    </div>
  );
}
