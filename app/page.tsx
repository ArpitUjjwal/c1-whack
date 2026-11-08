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
            "radial-gradient(70rem 45rem at 20% -10%, rgba(15,86,184,0.08), transparent 65%), radial-gradient(55rem 40rem at 85% 10%, rgba(81,52,196,0.07), transparent 65%)",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-6 py-16">
        <CapitalOneMark className="w-32" />

        <p className="mt-12 text-xs font-semibold tracking-[0.2em] text-link uppercase">
          Make Credit Accessible
        </p>
        <h1 className="display mt-3 text-5xl tracking-tight sm:text-6xl">
          Capital One Adaptive Support
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-fg-2">
          Most banking apps help you manage money when you&apos;re able to. This
          keeps banking manageable on your hardest days — and helps you ask for
          support before a payment fails. No diagnosis needed, and available to
          anyone.
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
              Safe Mode in one tap, a Financial Time Machine for stepping away,
              and an Advocate that prepares a support request for Alex to
              review and send.
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
            <h2 className="mt-2 text-2xl font-semibold">Care Centre</h2>
            <p className="mt-2 text-[0.9375rem] text-fg-2">
              Receives only what the customer chose to share, explores support
              pathways before offering anything, and maps where journeys —
              not people — get stuck.
            </p>
            <p className="mt-4 text-sm font-semibold text-link underline underline-offset-4">
              Open the Care Centre →
            </p>
          </Link>
        </div>

        <section className="glass mt-10 rounded-xl2 p-6">
          <h2 className="text-lg font-semibold">What stops people exploiting it?</h2>
          <p className="mt-3 text-[0.9375rem] text-fg-2">
            Nothing here grants a financial benefit because someone says
            they&apos;re struggling. It removes barriers to information and to
            the bank&apos;s existing support. Any arrangement goes through an
            eligibility check and a second approver; a fee refund only follows
            a payment. And the bank never sees a diagnosis, a mood, or anything
            measured on the customer&apos;s phone.
          </p>
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
