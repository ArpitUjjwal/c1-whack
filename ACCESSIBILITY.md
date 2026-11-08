# Accessibility

How Capital One Adaptive Support approaches cognitive accessibility, what it does about it, and how
to check that it actually does it.

The short version: **every accessibility claim in this product is measurable on
the screen making it.** Press <kbd>?</kbd> on either surface to open the Judge
overlay and read the numbers live.

---

## 1. The problem being solved

Alex Rivera has a Capital One UK credit card six days past due (£41, with a
£12 late fee already charged), a current account at another bank linked over
Open Banking, and fourteen days without opening the app. The fourteen days are
the actual problem.

The setting is the UK throughout: pounds, "current account" and "sort code",
"credit file" and "credit reference agencies". Capital One UK's own guidance is
that a payment is reported once it is more than 30 days late, and a missed
payment can stay on a credit file for six years; a payment plan does not stop
that. Every screen reads that wording from one file, `lib/compliance.ts`, and
states it cautiously ("should keep it off your credit file").

How Alex prefers to bank, shown verbatim to every agent. These are
preferences, not conditions — Adaptive Support never asks for a diagnosis or a
reason:

- Plain language
- One step at a time
- No urgency or pressure language
- Written messages over calls

> "Checking my balance makes me panic, so I put it off. Then it gets worse.
> Please keep it short and tell me the one thing to do."

The design premise follows from that: **credit isn't inaccessible because
information is missing. It's inaccessible because the interface demands
executive function the customer doesn't have in that moment — and then the
bank's own outreach spends what little is left.**

So the work splits in two: reduce what the app demands, and stop the bank
making it worse.

---

## 2. Reducing what the app demands

### Safe-to-Spend replaces the ledger

A balance is a number you still have to do arithmetic on, and that arithmetic
is exactly what gets avoided. The app does the subtraction and shows only the
answer; the working stays one tap down under "Show the maths".

**The property that matters:** paying the overdue minimum leaves Safe-to-Spend
*unchanged*, because the money was already set aside. The app says so before
you tap:

> "That's exactly what you have now — this money was already set aside for you,
> so paying it changes nothing you were counting on."

That sentence removes the main reason the task gets deferred. It is enforced in
code, not copy: `selectSafeToSpend` counts an unpaid minimum as committed, so
the invariance holds for every arrangement (`lib/selectors.ts`).

### Progressive disclosure

Sort codes, full account numbers, APR, credit limits, statement mechanics
and late-fee detail are all present and all collapsed by default. Someone
looking for their balance should not have to read past a sort code to find
it. `components/ui/Disclosure.tsx` wires `aria-expanded` / `aria-controls` and
animates height only.

### One thing at a time

- One primary action per screen, with its consequence stated before it is taken.
- One nudge on screen at a time, newest first, the rest queued behind it with
  "*N* more messages after this one". Stacking them would undo the point of a
  home screen with a single thing on it.
- Three navigation destinations, not nine.

### Calming, not alarming

Arrears use violet; attention uses amber. **Red never marks the customer's own
money** — it is reserved for the Capital One mark and for the Pressure Index,
where it marks *the bank's* language. Red reads as danger, and danger triggers
the avoidance the product exists to interrupt.

Language is plain throughout: "A payment slipped past", never "DELINQUENT".

### Dopamine, deliberately

Task avoidance is partly a feedback problem: the effort is immediate and the
payoff is invisible. The success overlay makes the payoff loud and immediate —
a drawn check mark, a spring, a count of things handled — then dismisses itself
after 5.2s so the celebration never becomes another thing to clear.

---

## 3. The Cognitive Load Meter and Adaptive Focus

The app measures the executive load it is demanding, from the live DOM
(`lib/engines/cognitive-load.ts`):

```
load = 3·(committing actions)
     + 1·(every interactive element)
     + 1.5·(distinct numbers on screen)
     + (words / 25)
     + 2·(reading grade above 8)
```

Weights follow from what costs working memory: an irreversible decision costs
most, an available option costs something, a number has to be held and
compared, prose has to be read, dense prose has to be re-read.

Disclosures (`aria-expanded`) and navigation (`data-nav`) count as options, not
commitments. Demo chrome is marked `data-load-ignore` and excluded.

### Interaction strain

`lib/engines/signals.ts` watches *how hard the customer appears to be finding
it*, not what they are doing:

| Signal | Window | Max points |
| --- | --- | --- |
| Scroll direction reversals | 12s | 30 |
| Taps that hit nothing interactive | 20s | 20 |
| Disclosure open/close churn | 30s | 15 |
| Stalled without acting | — | 25 |
| Late-night session (23:00–05:00) | — | 10 |
| Returning after a 7+ day gap | — | 10 |

Three rules this is built under:

1. **Nothing identifying is collected, and strain never leaves the device.**
   Timestamps of gesture *kinds*, in memory, in the tab. Nothing is persisted.
   **Nothing measured on the device crosses to the bank at all** — not strain,
   not screen load, not Safe Mode state, not which screen Alex is on.
   `lib/useCognitiveMonitor.ts` publishes nothing; the sync carries account
   facts, presence ("in the app"), and requests Alex chooses to send. A bank
   watching a customer's state of mind live is the inferred-health-data
   problem, whatever the intention — and knowing that someone uses a
   low-capacity mode is the profiling risk.
2. **Every signal decays.** Confusion two minutes ago is not evidence about now.
3. **The output is advisory.** It can offer to simplify; it can never act for
   the customer.

### First-run setup: "What do you find hard?"

Shown once, the first time someone opens the app, before anything else. Its
first screen offers *Read this to me* and *Make the text bigger*, so the setup
is usable by the people it is for. Then six options, described as tasks and
experiences rather than conditions, each stating what it will change:

| They find hard | The app changes |
| --- | --- |
| Reading long bits of text | Lexend, wider spacing, cream background, larger text |
| Seeing small text | Atkinson Hyperlegible, extra-large, high contrast |
| Rather listen than read | A prominent *Listen* button on every card |
| Remembering dates | Reminders 3 days before payments they make |
| Starting money tasks, or too much on screen | Opens in Safe Mode |
| Phone calls | Messages in the app, not calls |

The app changes as each box is ticked. **What they tick never leaves the
phone.** The next screen shows exactly which preference labels support would
see and asks whether to share them — switched **off** by default. Contact rules
(like reminders) are the one exception, and the screen says so: support has to
see a rule to follow it. The Claude brief is built only from what was shared.

Afterwards it never shows again; **Settings & help → Accessibility settings**
holds the same checklist, the sharing switch and the note. Ticking applies an
option; unticking undoes only what that option changed, and leaves anything the
customer adjusted by hand. One piece of logic (`toggleStruggle`) serves both
screens, so they cannot disagree. In the demo, Alex starts as a first-time
user; Priya and Sam are already set up.

### Reading and listening

Options anyone can turn on in Help, with no reason asked, saved on the phone
only (`lib/device.ts`, applied through data attributes in `globals.css` so every
component follows):

| Option | What it does |
| --- | --- |
| Font | Lexend (designed for reading ease) or Atkinson Hyperlegible (designed for low vision) |
| Text size | Large or extra large; the whole screen scales and reflows |
| Wider spacing | More letter, word and line spacing, and no italics |
| Background | Cream or soft blue instead of plain |
| High contrast | Near-black text everywhere, solid surfaces, stronger edges and focus |
| Read aloud | A *Listen* button on every main card — the browser's own speech, a British voice, at the chosen speed. Works alongside a real screen reader, not instead of one |

Two one-tap presets bundle common combinations: *Easier reading* and *Bigger and
bolder*. Both pass the live audit (contrast 75/75 at AA; worst 5.76:1 and
6.31:1).

### Reminders

"Remind me N days before payments I make myself" sits in the customer's own
contact rules. Reminders show in the app on the day, the next one is always
named, and the Time Machine marks each payment's reminder date. They were
asked for, so they never count toward the weekly contact limit — and the agent
script only promises a reminder when one is actually switched on.

### Three customers, three combinations

The demo carries three customers, switchable from the Care Centre — each
described by what helps, never by a diagnosis: **Alex** (money tasks are hard
to start), **Priya** (reads numbers more easily than paragraphs; already on
*Easier reading*), and **Sam** (forgets dates; small print is hard to read;
already on *Bigger and bolder*; his card's Direct Debit bounced).

### Safe Mode

"I can't handle banking today" is one tap from the home screen and the
welcome-back card, for anyone, with no reason asked. It is also offered on the
device when strain reaches 45. Safe Mode reduces the app to one next step and
the Time Machine — nav hidden, non-essential messages paused behind "read when
you like" — and the measured load drops below the 25 target.

**Measured:** home-screen load 29 → **19**. (One pair, defined once as
`FOCUS_LOAD_BEFORE` / `FOCUS_LOAD_AFTER` in `lib/engines/cognitive-load.ts`,
and quoted by the simulation, the Insights report and the demo.) Safe Mode is
stored in device-local preferences (`lib/device.ts`), never in shared state.

### Welcome-back

After a gap of 7+ days the app opens on what changed — three lines at most —
and one next step, instead of a pile of notifications. No "you missed", no
count of days.

### The Financial Time Machine

`lib/engines/time-machine.ts` answers "what happens if I don't touch my
finances for N days?" for N from 1 to 14. Each scheduled payment is sorted into
*needs you* (paid by hand, or past its date), *pays itself* (Direct Debit) or
*can wait* (after the break), with the projected balance after scheduled bills
and a short plan naming the one thing to do first. Assumptions are printed:
every listed payment goes through, no other income or spending, fictional demo
data. It is read-only — it never pays, extends or waives — and what Alex tries
in it is never shared.

### The Financial Advocate

On any *needs you* item, "I can't manage this one right now" opens one choice
per screen — what's in the way, what would help, optionally what Alex could
pay — then drafts a request from those validated facts (`lib/advocate.ts`;
Claude when a key is set, a deterministic template otherwise). Alex sees
**exactly what Capital One will see**, beside a **"not shared"** list, can edit
it, and sends it. Nothing leaves without that press.

#### Ethical guardrails (non-negotiable)

Adaptive interfaces can harm. These constraints are enforced in the code, not
just intended:

- **It only ever removes or enlarges — never relocates.** Moving a control
  someone has learned the position of is worse than leaving the screen busy.
- **It never diagnoses.** The offer reads "Want this screen simpler?" It does
  not mention a score, and it says nothing about how the customer is behaving.
  Being told an app has noticed you are struggling is its own small humiliation.
- **It is always reversible**, with "Show me everything again" always visible.
- **No means no, permanently.** Declining the on-device offer is remembered on
  the device and the app never asks again. The customer's preference outranks
  the model.
- **The meter is never shown to the customer, and nothing is shown to the
  bank.** Strain and load appear in one place: the Judge overlay on the
  customer's own device.
- **Alex can turn it all off.** The Help tab has a "What Adaptive Support
  notices" panel — what it notices, what it never does — and an *Adaptive
  screen* switch. Off means nothing is measured and nothing is offered.

---

## 4. Stopping the bank making it worse

### The Pressure Index

Nothing reaches the customer without passing through
`lib/engines/pressure.ts`, which scores a draft **as the agent types it** —
because an agent who can see a sentence going wrong rewrites it, while an agent
told afterwards has already done the harm.

| Category | Points each | Cap |
| --- | --- | --- |
| Threats: escalation, vague consequences, "will be reported" | 20 | 60 |
| Blame directed at the customer | 18 | 54 |
| Urgency and compulsion | 14 | 42 |
| Jargon without a plain-language gloss | 8 | 24 |
| Sentences over 20 words | 6 | 18 |
| Reading level above grade 8 | 4 | 20 |
| More than one decision in one message | 10 | 10 |
| Passive voice hiding who acts | 5 | 10 |
| Consequence with no date, or said twice | 10 | 30 |

**Threats are not consequences.** Softening tone is the product; deleting
information the customer needs to decide is not, and UK rules expect
communications to be clear, fair and not misleading. So a real consequence
stated **once, calmly, with a specific date** scores 0 and is underlined as
*allowed*. An undated one, or a second mention, scores.

**Locked wording.** The composer can attach compliance-required segments — the
dated credit-file line and a free-debt-advice signpost (illustrative, after
FCA CONC 7). They sit outside the editable draft, are scored but never
penalised, are never sent to either rewriter, and are appended verbatim on
send.

Every finding names the exact span that caused it, the reason in one actionable
sentence, and the points it contributed. No model, no training data, no opacity
— an agent can disagree with the tool and see exactly why it said what it said.

**Measured example:**

> "You must pay the full balance immediately to avoid collections. Failure to do
> so will be reported to the credit reference agencies."

scores **100/100 — "Likely to cause another silence"**. One click rewrites it to:

> "You can pay the full balance. Paying it by Sunday 29 November should keep it
> off your credit file."

which scores **0**. The threats are gone; the one real consequence is still
there, once, with its date. (The date is the due date plus 28 days, leaving
two days' margin before Capital One's 30-day reporting point.) The Claude
rewrite prompt carries the same rule.

A message in the harmful band requires a second, explicit confirmation to send.
It is not hard-blocked — agents need autonomy — but it says plainly what the
account history predicts.

### Contact preferences and the frequency guard

Alex sets contact rules on a calm day — channel, at most *N* messages a week,
quiet hours — in the app's Help tab, in the spirit of Money and Mental Health's
Advance Choice Documents. They are consent, not inference, so they cannot be
gamed and they need no reading of anyone's state. The console shows them as a
banner under Alex's needs; the composer shows which
message this would be this week ("2nd message this week") and warn, with a
second press required, when a send would break a rule. The evidence is printed
beside it: people getting five or more creditor calls a month were far more
likely to say contact harmed their mental health (91% against 57%).

### The tone check

The Calm / Warm / Celebrate buttons only label how a message is styled on the
phone, so `lib/engines/sentiment.ts` checks that the words match:

- **Insults block outright.** A list of insults, contempt and swearing —
  tolerant of text-speak ("u need to") and spellings like "b1tch" or "f*ck" —
  makes a message unsendable, with no "send anyway". Rewriting starts again
  from the facts.
- **A pre-built sentiment model** (AFINN-165, via the `sentiment` package)
  scores polarity, with ordinary banking words ("pay", "fee", "due") zeroed so
  only real hostility counts.
- **The picked tone is compared with the detected one**, alongside the
  Pressure Index: "You picked Calm, but this reads as hostile / pressuring / a
  little firm". Celebrate is flagged when there is no good news yet.
- **Rewrites follow the tone.** Calm is plain; Warm adds a greeting and a kind
  close; Celebrate leads with the good news. Changing tone re-types from the
  agent's original words, not from the last rewrite.

### Readability

`lib/engines/readability.ts` computes Flesch–Kincaid grade, reading ease,
sentence length and syllable counts. The plain-language target is grade 8.
It is a crude instrument, and the UI says so; it is still the right one, because
it is standard, cheap, and moves the right way when prose gets worse.

### The agent script

`lib/scripts.ts` derives wording from live state, so the script rewrites itself
mid-conversation when the customer acts. Each variant carries a **"Don't say"**
column with the reason — most harm in an arrears conversation comes from
standard phrasing nobody chose:

- "You must…" → pressure is what preceded the 14 quiet days
- "Delinquent", "default", "collections" → escalates without informing
- Leading with a fee refund → goodwill offered before paying rewards going quiet
- Stacking options → Alex processes one step at a time
- Mentioning the 14-day gap → naming it makes it shameful

### The Care Centre: support that starts before a payment fails

Requests arrive only when a customer sends one. Each shows what Alex shared
— summary, facts, help requested, contact preference — beside a
**"deliberately not shared"** box, with an access log of who opened it.

The **Financial Rescue Simulator** (`lib/engines/rescue-sim.ts`) lays out three
pathways for that request from the customer's side: the standard process (four
contacts, likely reported at 30 days), an accessible guided payment (one
message, three small steps, no change to terms) and specialist review. No
pathway assumes an extension or a fee waiver. Choosing one updates Alex's phone
instantly.

**Concessions follow policy, never the software or a self-report.** An
arrangement needs an illustrative eligibility check (asked for by the customer,
none in the last 12 months, within adviser authority) and a second approver. A
fee refund only unlocks after payment, once a year.

**Accessibility Insights** is the aggregate view: the top barriers in
customers' own words (the categories they chose when asking for help), the
hardest journeys, which response pathways resolve requests, and
recommendations — two of which are tips shown in the app to everyone on that
screen. It is built only from requests, journey completion and pathway
outcomes. Nothing from a customer's phone (Safe Mode, reading settings,
read-aloud, the Time Machine) feeds it, there are no mental-health
classifications, and no group under ten is shown. Illustrative data.

The **grace rule** waives a late fee automatically when the last three
payments were on time, once a year. It needs no request and no explanation,
and it rewards a record of paying rather than a period of silence.

The 30-day simulation runs three lanes: the standard cadence, **the design
alone** (one in-app message, welcome-back and Safe Mode, the Time Machine, a
guided payment — nothing given away, the fee stands), and the design plus
optional concessions after approval. The design-only lane resolves on day 4.

---

## 5. Conventional accessibility

Carried through both surfaces:

| Area | Implementation |
| --- | --- |
| Contrast | Every text token pinned to a measured ratio; floor is 4.5:1. The palette is Capital One UK — navy `#1C2641` on the `#F6F7F8` canvas is 13.6:1 — and where a brand value would not clear the floor the hue is kept and the lightness pulled down until it does. `--color-fg-3` (5.5:1) is the lightest text permitted. |
| Brand red | Capital One red `#D03027` is 4.7:1 on the canvas, so it clears text contrast on its own; white on red is 5.1:1 for text over a red fill, and `--color-red-fg` (7.1:1) is the darker paired red used on a red wash. |
| Focus | One unmistakable style: 2px solid navy (`#1C2641`), 2px offset, on every interactive element — it clears the white cards and the saturated accent fills alike. |
| Yellow | The Capital One UK action yellow (`#FDE236`) is a **fill-only** token. Navy on it is 11.2:1; as a text colour on white it would be 1.30:1, so it is paired with `--color-on-cta` and never used as type. |
| Touch targets | 44px minimum height at every button size (WCAG 2.5.5 AAA; the AA floor is 24px). |
| Live regions | `aria-live="polite"` throughout — never `assertive`. A screen reader finishes its sentence before announcing an incoming nudge, which matters a great deal mid-task. |
| Dialogs | `role="dialog"`, `aria-modal`, labelled by their own heading, focus moved in on open, Tab trapped inside, Escape closes, focus restored to the trigger. |
| Meters | Real `role="meter"` with `aria-valuetext` carrying the plain-language reading — "72 of 100, high", not a bare number with no scale. |
| Colour independence | Status is always carried by text as well as colour. |
| Reduced motion | `prefers-reduced-motion` collapses every animation, removes confetti and the scan/noise effects, and Framer Motion's own handling takes over transforms. |
| Forced colors | Windows High Contrast restores hairline borders and drops translucency and glow. |
| Skip links | "Skip to main content" first in the tab order on both surfaces, and `scroll-padding-top` keeps the landing clear of the console's sticky top bar rather than parking the heading underneath it. |
| Headings | Real `h1`/`h2`/`h3` outline, verified by the Judge overlay. |
| Keyboard | Every flow completable without a mouse. |

---

## 6. The Proof Layer — checking all of the above

Press <kbd>?</kbd> on either surface. `lib/engines/a11y-audit.ts` re-measures
the live DOM and reports:

- **Contrast** of every element that owns visible text, computed from the
  colours the browser actually resolved — compositing each translucent layer,
  and each inherited `opacity`, exactly as the browser does, so surfaces are
  measured *as rendered*, not as designed. Large-text thresholds (3:1) are
  applied where they apply. Two things are exempt, as WCAG 1.4.3 exempts them:
  `aria-hidden` decoration, and disabled controls, which are dimmed precisely
  *to* signal that they cannot be pressed. One known limit, stated rather than
  hidden: background **gradients** are not sampled, so text over one is
  measured against the solid colour beneath it.
- **Touch targets**, using the *effective* hit area: a 16px radio inside a 44px
  label is a 44px target, because the label activates it. Measured from the
  layout box rather than the painted rect, so a screen animating in from
  `scale: 0.98` is not reported as eight undersized controls.
- **Heading structure** — the outline is walked and a skipped level (h2 → h4)
  is named and failed, rather than the panel printing "in order" beside a
  count it never checked.
- **Live regions**, counted *and* checked for politeness: an `assertive`
  region is reported as a failure, not summarised away.
- The current **reduced-motion** state.
- On the customer surface, the **cognitive load breakdown** with the formula
  printed beside its own result.

It is deliberately capable of reporting a failure, and it does — a real contrast
miss or an undersized control shows in red with the ratio and the element that
caused it. **A proof panel that can only say "pass" proves nothing.** Two
genuine failures were found and fixed this way: 36×24px "Use" buttons, and the
audit's own over-strict reading of labelled radio inputs.

### Current measured state (console, `/bank`)

| Check | Result |
| --- | --- |
| Text contrast | 344/344 pass WCAG AA · worst 4.69:1 |
| Touch targets | 23/23 pass at the 44px AAA bar |
| Heading structure | 15 headings in order |
| Live regions | 5 present, none assertive |
| Reduced motion | Honoured |

Re-measure on any screen with the button in the overlay — the numbers above are
a snapshot, not a guarantee.

---

## 7. Known limits

Stated plainly, because a hackathon prototype that claims to be finished is not
credible:

- The cognitive-load formula is a **heuristic**, not validated against any
  measure of real cognitive effort. It is shown beside its own output so it can
  be argued with.
- The Rescue Simulator, eligibility rules, grace rule and Insights report use **illustrative**
  logic and data, not Capital One policy or real task-completion figures.
- Device-local preferences share an origin with the console in this demo; on a
  real phone they would live in the device's own storage.
- The Pressure Index lexicon is **English-only** and will miss harm expressed
  without flagged vocabulary. The optional Claude pass exists precisely to cover
  that gap, and the local engine runs regardless.
- The 30-day simulation uses **assumed** engagement constants, printed under it.
- Compliance wording (`lib/compliance.ts`) is **illustrative**. The reporting
  rule follows Capital One UK's published guidance; a real deployment would
  take every locked segment verbatim from Capital One's compliance team.
- Screen-reader testing has been done against the accessibility tree and
  semantics, **not** with a full manual pass in JAWS, NVDA or VoiceOver.
