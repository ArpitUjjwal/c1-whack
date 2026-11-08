# Capital One Adaptive Support — Make Credit Accessible

Two surfaces, one shared state, no server.

> Most banking apps are designed to help you manage your money when you're
> capable of doing so. But what happens when your mental health makes that
> difficult?

A prototype for the Capital One "Make Credit Accessible" challenge, positioned
as **financial continuity during periods of reduced capacity** — not a budgeting
app and not a mental-health chatbot. It is designed around mental-health-related
barriers but **available to anyone, with no diagnosis or reason required**.

> Nearly half of people who are behind on payments say they feel harassed (49%)
> or overwhelmed (48%) by the volume of contact from their creditors.
> — Money and Mental Health Policy Institute

Set in the UK: Alex has a Capital One UK credit card (£41 past due) and a
current account at another bank, linked over Open Banking.

| Route | Surface |
| --- | --- |
| `/customer` | Alex's phone. Mobile-first, constrained to `max-w-md`. |
| `/bank` | Capital One Care Centre. Desktop-first. |
| `/` | Demo launcher. |

## Running it

```bash
npm install
npm run dev
```

Open `http://localhost:3000/customer` and `http://localhost:3000/bank` in two
**separate windows**, side by side.

- <kbd>D</kbd> — guided demo. One keypress drives **both** windows.
- <kbd>?</kbd> — judge overlay: the mechanism behind the screen, plus a live
  accessibility audit.

## Customer side — banking that stays manageable

**Welcome-back** — after days away, the app says what changed in three lines
and offers one next step. No pile of notifications, no guilt language.

**Safe Mode** — "I can't handle banking today." One tap strips the app to what
matters and pauses non-essential messages. Also offered on-device when the
screen seems hard to use. **The bank is never told** — Safe Mode lives in
device-local storage (`lib/device.ts`), not in shared state.

**Financial Time Machine** (`lib/engines/time-machine.ts`) — "What happens if I
don't touch my finances for N days?" A 1–14 day slider sorts every scheduled
payment into *needs you*, *pays itself* or *can wait*, projects the balance
after scheduled bills, and writes a gentle action plan — all from known facts,
with the assumptions printed. It is read-only: it never pays, extends or waives.

**Financial Advocate** (`lib/advocate.ts`) — "I can't manage this one right
now." Prepares a support request from validated facts and Alex's own answers
(locally, or with Claude when a key is set), shows **exactly what Capital One
will see** beside a **"not shared"** list, and sends only when Alex presses Send.

## Capital One side — the Care Centre

**Support handoff inbox** — request #1042 appears the moment Alex sends it,
with the AI summary, the facts, Alex's contact preference, a **"deliberately
not shared"** box, and an access log of who opened it.

**Financial Rescue Simulator** (`lib/engines/rescue-sim.ts`) — three pathways
for that one request, seen from the customer's side: *standard process*,
*accessible guided payment*, *specialist support review*. No pathway assumes an
extension or a fee waiver. Choosing one updates Alex's phone instantly.

**Concessions follow policy, never the software** — an arrangement needs an
illustrative eligibility check and a second approver; a fee refund only
unlocks after payment, once a year.

**Accessibility Friction Map** — where *journeys* get stuck (credit repayment,
disputes, Direct Debits), from illustrative aggregated data. Journeys, never
people; no mental-health classifications.

**Pressure Index** (`lib/engines/pressure.ts`) — every reply is scored as it is
typed. Threats go; a real consequence stays, once, calmly, with its date
(**100 → 0** on a standard collections sentence). Compliance wording can be
locked, and a frequency guard checks each send against Alex's own contact rules.

**Thirty days, three policies** (`lib/engines/simulation.ts`) — the standard
cadence never resolves and is reported; **the design alone** resolves on day 4
with nothing given away; optional concessions (after approval) make it a day
faster.

## Privacy by design

| Support team sees | Not shared |
| --- | --- |
| The payment issue, the help requested, contact preferences, relevant account details | Mood, diagnoses, mental-health scores, interaction strain, screen measurements, Safe Mode use, Time Machine activity, private conversations |

Nothing measured on the customer's device crosses windows at all — the sync
carries account facts, presence ("in the app"), and requests the customer
chose to send. These are proposed boundaries: a production system would need
technical enforcement, audit trails, retention controls and legal review.

## What stops people exploiting it?

> Our platform doesn't automatically grant financial benefits based on someone
> claiming a mental-health condition. It removes barriers to accessing financial
> information and existing support services. Any financial concessions remain
> subject to the bank's normal approval procedures. We've designed accessibility
> to be available without requiring a diagnosis.

| Risk | How it's handled here |
| --- | --- |
| False claims of difficulty to get concessions | No concession is granted by the software or by self-report; arrangements need eligibility and a second approver |
| Repeated requests to postpone indefinitely | Eligibility check includes "no arrangement in the last 12 months" |
| AI recommending a harmful delay | AI only drafts paperwork from validated facts; the Time Machine never acts |
| Sensitive data used in lending or profiling | No health data is collected; preferences are kept apart from credit decisions |
| Misreading behaviour as illness | Nothing is inferred or diagnosed; on-device signals only offer a simpler screen |

See **[ACCESSIBILITY.md](ACCESSIBILITY.md)** for the full treatment and the
known limits.

## How the sync works

`lib/store.ts` is an external store read through `useSyncExternalStore`, because
the state genuinely lives outside React — in `localStorage` and on a
`BroadcastChannel` shared by every open tab.

- **`BroadcastChannel`** is the primary transport: instant, same-origin, no
  server round trip.
- **A `localStorage` bus key** is the fallback. Envelopes carry an id, so a tab
  receiving one on both transports handles it once.
- **A persisted snapshot** lets a window opened or refreshed mid-demo rejoin.
- **Ephemeral `signal` messages** carry Demo Director beats only. No
  measurement from the customer's device is ever sent.
- **Device-local preferences** (`lib/device.ts`) — Safe Mode, the welcome-back
  card, the adaptive switch — are stored apart from shared state and never
  broadcast.

Conflicts resolve on a monotonic `rev`, and every inbound state — from storage
*and* from the wire — passes the same shape check, so a tab running older code
cannot take down a newer one.

Both surfaces dispatch into one pure reducer, so the customer's payment preview
is computed by the same code that performs it.

## Claude (optional)

Without a key everything runs on local, deterministic engines and the demo is
complete. With one, Claude adds a deeper Pressure Index pass, bespoke rewrites,
and drafts the Advocate's support request from validated facts only.

```bash
cp .env.example .env.local   # add ANTHROPIC_API_KEY, then restart
```

Server-side only (`app/api/coach/*`, `app/api/advocate/*`); the key never
reaches the browser. Every failure path — no key, rate limit, dropped
connection, refusal — falls back silently to the local engine, and the UI says
which produced the result.

> **Don't deploy publicly with `ANTHROPIC_API_KEY` set.** These routes have no
> authentication, so anyone with the URL could spend your credits. Run the demo
> locally, or deploy without the key — the local engines cover the whole demo.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Framer
Motion · `@anthropic-ai/sdk` (optional). No database, no sockets, no polling.
