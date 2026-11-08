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

Set in the UK. Three demo customers, switchable from the Care Centre's top bar,
each with a different combination of needs — described as preferences, never
diagnoses:

| Customer | Needs | Scenario |
| --- | --- | --- |
| **Alex** | Finds money tasks hard to start | 14 days away; a £41 card payment slipped. The guided demo. |
| **Priya** | Reads numbers more easily than paragraphs (dyslexia) | Confused by her statement; phone already set to *Easier reading*. |
| **Sam** | Forgets dates; small print is hard to read (memory, low vision) | His card's Direct Debit bounced; six on-time payments earn the grace rule; his balance won't cover rent. |

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

**First-run setup** (`lib/struggles.ts`) — the first time someone opens the
app: "What do you find hard? Pick any, or none." Six options in plain words
(reading long text, seeing small text, rather listen, remembering dates,
starting money tasks / too much on screen, phone calls), each saying what it
will change. The app transforms live as they tick. What they tick is stored on
the phone only; sharing the resulting preference labels with support is a
separate choice, **off by default**. It never shows again — everything can be
changed later in **Settings & help**, where unticking an option undoes only what
that option changed (never a setting adjusted by hand). The setup itself offers
*Read this to me* and *Make the text bigger* before asking anything.

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

**Reading and listening** — a reading-friendly font (Lexend, or Atkinson
Hyperlegible for low vision), larger text, wider spacing with no italics, a
cream or soft-blue background, high contrast, and **read-aloud** on every main
card (the browser's own speech, British voice, adjustable speed). One-tap
presets: *Easier reading* and *Bigger and bolder*. Preferences, not
diagnoses; saved on the phone only.

**Reminders** — "remind me N days before payments I make myself", set in the
customer's contact rules, shown in the app on the day and marked in the Time
Machine. Requested, so never counted as outreach.

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

**Accessibility Insights** (`lib/insights-data.ts`) — the aggregate view: top
barriers in customers' own words (from the categories they chose when asking
for help), the hardest journeys, which response pathways resolve requests, and
recommendations. Two recommendations are tips that appear in the app for
everyone on that screen. Built only from requests, journey completion and
pathway outcomes — never from anything on a customer's phone — and no group
under ten is shown. Illustrative data.

**Grace rule** (`lib/engines/grace.ts`) — three on-time payments in a row earn
one forgiven late fee, applied automatically, once a year. It rewards a record
of paying, never a period of silence. Illustrative policy.

**Tone check** (`lib/engines/sentiment.ts`) — the Calm / Warm / Celebrate
buttons label how a message looks on the phone; this checks the words match.
An insult list (catching text-speak like "u" and spellings like "b1tch") makes a
message unsendable — no "send anyway" — and the AFINN sentiment model (`sentiment`
package) flags hostile, negative or firm wording against the tone picked.
Rewrites are written in the picked tone, and changing tone re-types from the
agent's original words.

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

## AI (optional)

Without a key everything runs on local, deterministic engines and the demo is
complete. With one, five surfaces get sharper:

| Surface | What AI adds | Without a key |
| --- | --- | --- |
| **Pressure Index** | A second pass that sees tone and implication, not just a word list | The lexicon, on every keystroke |
| **Rewrite** | A bespoke rewrite in the picked tone | The template rewriter |
| **Financial Advocate** | Drafts the request from validated facts only | A deterministic draft |
| **"What does this mean?"** | Explains a figure on the customer's own screen, in plain words | The standard explanation for that screen |
| **Agent script** | Writes the opener, the lines and the "don't say" list for this call | `buildAgentScript`, from templates |

```bash
cp .env.example .env.local   # add ANTHROPIC_API_KEY, then restart
```

**One seam, not five integrations.** `lib/ai/provider.ts` defines the interface
in domain types; `lib/ai/providers/claude.ts` implements it. No vendor SDK type
crosses that boundary, so another provider is a new file in `providers/` and a
line in `getProvider()` — set `AI_PROVIDER` to choose. With no credentials the
seam returns a provider whose every method resolves `null`, and since `null`
already means "use the local engine", nothing downstream knows whether a key
exists.

**Two rules hold everywhere.** The model never decides anything — every figure,
date and entitlement comes from state the server validated first. And the model
is held to the product's own standards rather than trusted: an explanation is
measured by the same readability engine that grades the bank's messages and
discarded above Flesch–Kincaid grade 8, and a generated agent script is scored
by the same Pressure Index that scores the agent's own words and discarded if
it comes back pressuring.

Server-side only (`app/api/coach/*`, `app/api/advocate/*`, `app/api/explain`,
`app/api/script`); the key never reaches the browser. Nothing measured on the
customer's device is ever sent — the explainer is told to write plainly for
everyone, and the phone applies that customer's own typeface, size and tint
locally, so reading preferences stay on the phone. Every failure path — no key,
rate limit, dropped connection, refusal, a malformed answer, an answer that
fails our own check — falls back to the local engine, and the UI says which
produced the result.

> **Don't deploy publicly with `ANTHROPIC_API_KEY` set.** These routes have no
> authentication, so anyone with the URL could spend your credits. Run the demo
> locally, or deploy without the key — the local engines cover the whole demo.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Framer
Motion · `@anthropic-ai/sdk` (optional). No database, no sockets, no polling.
