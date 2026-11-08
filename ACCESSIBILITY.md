# Accessibility

How Clarity approaches cognitive accessibility, what it does about it, and how
to check that it actually does it.

The short version: **every accessibility claim in this product is measurable on
the screen making it.** Press <kbd>?</kbd> on either surface to open the Judge
overlay and read the numbers live.

---

## 1. The problem being solved

Alex Rivera has a checking account, a credit card six days past due, and
fourteen days without opening the app. The fourteen days are the actual
problem.

Alex's self-declared needs, shown verbatim to every agent:

- Prefers plain language
- Prone to financial avoidance
- One step at a time
- No urgency or pressure language

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
answer; the working stays one tap down under "Show the math".

**The property that matters:** paying the overdue minimum leaves Safe-to-Spend
*unchanged*, because the money was already set aside. The app says so before
you tap:

> "That's exactly what you have now — this money was already set aside for you,
> so paying it changes nothing you were counting on."

That sentence removes the main reason the task gets deferred. It is enforced in
code, not copy: `selectSafeToSpend` counts an unpaid minimum as committed, so
the invariance holds for every arrangement (`lib/selectors.ts`).

### Progressive disclosure

Routing numbers, full account numbers, APR, credit limits, statement mechanics
and late-fee detail are all present and all collapsed by default. Someone
looking for their balance should not have to read past a routing number to find
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

1. **Nothing identifying is collected.** Timestamps of gesture *kinds*, in
   memory, in the tab. Nothing is persisted and nothing leaves the device.
2. **Every signal decays.** Confusion two minutes ago is not evidence about now.
3. **The output is advisory.** It can offer to simplify; it can never act for
   the customer.

### Focus Mode

At strain ≥ 45 the app offers to simplify. Accepting collapses the screen to one
decision — nav hidden, type up, supporting detail gone — and the measured load
drops below the 25 target.

**Verified end to end:** load 29 → **19** on acceptance, visible simultaneously
on the agent console's Customer Lens.

#### Ethical guardrails (non-negotiable)

Adaptive interfaces can harm. These constraints are enforced in the code, not
just intended:

- **It only ever removes or enlarges — never relocates.** Moving a control
  someone has learned the position of is worse than leaving the screen busy.
- **It never diagnoses.** The offer reads "Want this screen simpler?" It does
  not mention a score, and it says nothing about how the customer is behaving.
  Being told an app has noticed you are struggling is its own small humiliation.
- **It is always reversible**, with "Show me everything again" always visible.
- **No means no, permanently.** Declining writes `ui.focusDeclined` to persisted
  state and the app never asks again — on this session or any later one. The
  customer's preference outranks the model.
- **The meter is never shown to the customer.** The load and strain numbers live
  on the agent console and the Judge overlay only.

---

## 4. Stopping the bank making it worse

### The Pressure Index

Nothing reaches the customer without passing through
`lib/engines/pressure.ts`, which scores a draft **as the agent types it** —
because an agent who can see a sentence going wrong rewrites it, while an agent
told afterwards has already done the harm.

| Category | Points each | Cap |
| --- | --- | --- |
| Consequence and threat framing | 20 | 60 |
| Blame directed at the customer | 18 | 54 |
| Urgency and compulsion | 14 | 42 |
| Jargon without a plain-language gloss | 8 | 24 |
| Sentences over 20 words | 6 | 18 |
| Reading level above grade 8 | 4 | 20 |
| More than one decision in one message | 10 | 10 |
| Passive voice hiding who acts | 5 | 10 |

Every finding names the exact span that caused it, the reason in one actionable
sentence, and the points it contributed. No model, no training data, no opacity
— an agent can disagree with the tool and see exactly why it said what it said.

**Measured example:**

> "You must pay the full balance immediately to avoid collections. Failure to do
> so will be reported to the credit bureaus."

scores **100/100 — "Likely to cause another silence"**. One click rewrites it to:

> "You can pay the full balance whenever you're ready. Nothing goes on your
> credit file before 30 days."

which scores **0**, with every factual claim intact.

A message in the harmful band requires a second, explicit confirmation to send.
It is not hard-blocked — agents need autonomy — but it says plainly what the
account history predicts.

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

- "You must…" → pressure is what produced the 14-day avoidance
- "Delinquent", "default", "collections" → escalates without informing
- Stacking options → Alex processes one step at a time
- Mentioning the 14-day gap → naming the avoidance makes it shameful

### The Silence Model, shown not asserted

`lib/engines/silence-model.ts` treats not-opening-the-app as information. Six
features, every weight and contribution on screen, and the panel states plainly
that the weights are **hand-tuned, not trained on any data**. It also names what
a real deployment would need: validation against outcomes, fairness testing
across protected groups, and a route for a customer to see and contest their own
score.

---

## 5. Conventional accessibility

Carried through both surfaces:

| Area | Implementation |
| --- | --- |
| Contrast | Every text token pinned to a measured ratio; floor is 4.5:1. `--color-fg-3` (5.5:1 on the canvas, 4.96:1 at its worst composite) is the lightest text permitted. |
| Brand red | 5.0:1 on the light canvas, so it clears text contrast on its own; white on red is 5.5:1 for text over a red fill, and `--color-red-fg` (7.0:1) is the darker paired red used on a red wash. |
| Focus | One unmistakable style: 2px solid ink (`#0d1522`), 2px offset, on every interactive element — it clears the white panels and the saturated accent fills alike. |
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
  colours the browser actually resolved — compositing each translucent layer
  exactly as the browser does, so the translucent panels are measured *as rendered*,
  not as designed. Large-text thresholds (3:1) are applied where they apply.
- **Touch targets**, using the *effective* hit area: a 16px radio inside a 44px
  label is a 44px target, because the label activates it.
- **Heading structure**, **live-region count**, and the current
  **reduced-motion** state.
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
| Text contrast | 245/245 pass WCAG AA · worst 4.69:1 |
| Touch targets | Pass at the 44px AAA bar |
| Heading structure | 14 headings in order |
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
- The Silence Model is **illustrative and hand-tuned**. It is not trained, not
  validated, and not fairness-tested.
- The Pressure Index lexicon is **English-only** and will miss harm expressed
  without flagged vocabulary. The optional Claude pass exists precisely to cover
  that gap, and the local engine runs regardless.
- The 30-day simulation uses **assumed** engagement constants, printed under it.
- Screen-reader testing has been done against the accessibility tree and
  semantics, **not** with a full manual pass in JAWS, NVDA or VoiceOver.
