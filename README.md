# Clarity — Make Credit Accessible

Two surfaces, one shared state, no server.

A prototype for the Capital One "Make Credit Accessible" problem statement:
helping customers with cognitive accessibility requirements — ADHD, anxiety,
task avoidance — manage credit independently.

> Credit isn't inaccessible because information is missing. It's inaccessible
> because the interface demands executive function the customer doesn't have in
> that moment — and then the bank's own outreach spends what little is left.

| Route | Surface |
| --- | --- |
| `/customer` | Alex's phone. Mobile-first, constrained to `max-w-md`. |
| `/bank` | The care console. Desktop-first. |
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

## Three mechanisms, not three claims

**Cognitive Load Meter + Adaptive Focus** (`lib/engines/cognitive-load.ts`,
`signals.ts`) — scores what the screen demands of working memory from the live
DOM, watches how hard the customer is finding it, and offers Focus Mode above
strain 45. Measured: load **29 → 19** on acceptance, under the 25 target.

**Pressure Index** (`lib/engines/pressure.ts`) — scores every outgoing message
*as the agent types it*, underlines the exact words doing harm with the reason
and the points, and rewrites them. Measured: a standard collections sentence
scores **100 → 0** with every factual claim intact.

**Silence Model** (`lib/engines/silence-model.ts`) — treats not-opening-the-app
as information. Six features, every weight and contribution on screen, stated
plainly as hand-tuned rather than trained. Feeds a deterministic 30-day
two-policy simulation: standard cadence never resolves and reports to the
bureau; Clarity resolves on day 4 with no fee.

See **[ACCESSIBILITY.md](ACCESSIBILITY.md)** for the full treatment, including
the ethical guardrails on the adaptive layer and the known limits.

## How the sync works

`lib/store.ts` is an external store read through `useSyncExternalStore`, because
the state genuinely lives outside React — in `localStorage` and on a
`BroadcastChannel` shared by every open tab.

- **`BroadcastChannel`** is the primary transport: instant, same-origin, no
  server round trip.
- **A `localStorage` bus key** is the fallback. Envelopes carry an id, so a tab
  receiving one on both transports handles it once.
- **A persisted snapshot** lets a window opened or refreshed mid-demo rejoin.
- **Ephemeral `signal` messages** carry live telemetry and director beats, so a
  once-a-second measurement never churns the revision counter.

Conflicts resolve on a monotonic `rev`, and every inbound state — from storage
*and* from the wire — passes the same shape check, so a tab running older code
cannot take down a newer one.

Both surfaces dispatch into one pure reducer, so the customer's payment preview
is computed by the same code that performs it.

## Claude (optional)

Without a key the console runs entirely on the local engine and the demo is
complete. With one, a deeper pass runs on a typing pause and writes a bespoke
rewrite.

```bash
cp .env.example .env.local   # add ANTHROPIC_API_KEY, then restart
```

Server-side only (`app/api/coach/*`); the key never reaches the browser. Every
failure path — no key, rate limit, dropped connection, refusal — falls back
silently to the local engine, and the UI badge says which produced the result.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Framer
Motion · `@anthropic-ai/sdk` (optional). No database, no sockets, no polling.
