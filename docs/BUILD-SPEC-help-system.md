# ShellQuest — Build Spec: The Help System ("Explain this")

**A content + UI feature, buildable as a v1.x expansion.** When a learner is stuck, a button in the kata opens tiered, plain-language help — built around association, analogy, and mnemonics — that guides *toward* understanding without ever handing over the answer.

---

## Why this design (grounded, not guessed)

Programming-education research is consistent on two points, and they shape everything below:

1. **Tiered, progressive help beats a single explanation, and must stop short of the solution.** The effective pattern is scaffolding that fades — guidance that goes from *abstract concept → concrete nudge*, provided only as needed, keeping the learner doing the actual thinking. Give-the-answer help produces passive learning and weak retention; the whole point is support that's "actionable enough to move forward, indirect enough to preserve reasoning."
2. **Analogies and mnemonics are legitimate, powerful scaffolds.** A good analogy builds a "cognitive framework" that makes the unfamiliar graspable; acronyms/acrostics give a "cognitive cueing structure" for recall. (Caveat from the literature: a mnemonic aids *recall*, it doesn't replace *understanding* — so it rides alongside a real explanation, never instead of one.)

That maps perfectly onto how you've said you learn — association, acronyms, comparisons — so this feature leans into exactly those, by design.

## The shape: a tiered "Explain this" panel

A button in every kata (and lesson) opens a panel that reveals help **one tier at a time** — the learner clicks "still stuck?" to go deeper, so they only ever get as much as they need:

- **Tier 1 — In plain words + an analogy.** Restate the task with zero jargon, then a real-world comparison. *(Your comparison style.)*
- **Tier 2 — A memory hook.** An acronym, acrostic, or vivid association for the concept. *(Your acronym style.)*
- **Tier 3 — A Socratic nudge.** One guiding question that points at the first step — not the step itself. ("What do you need to look at *first* in the list?")
- **Tier 4 — A worked *analogous* example.** A structurally-similar but *different* problem, solved. Research calls this analogical transfer: it teaches the pattern without letting the learner copy this problem's answer.

**Never a Tier 5 that gives the solution.** The floor of the panel is the analogous example; the learner always writes the final code themselves. This is the line that keeps it a teaching tool instead of an answer key.

## The data format (content-as-data, as always)

Add an optional `help` block to any exercise or lesson. It's pure data — no engine logic embedded, and exercises without it simply show no Help button.

```json
"help": {
  "plain": "You need to walk through each number and keep a running total of just the even ones.",
  "analogy": "Like counting only the red M&Ms in a bag — you look at each one, skip the others, and tally the reds.",
  "mnemonic": "LEA — Loop, Examine, Add. Loop over the list, Examine each item, Add it if it qualifies.",
  "nudge": "How do you check whether a single number is even? (You already built that.)",
  "example": {
    "problem": "Sum the ODD numbers in [1,2,3,4] (a different task).",
    "solution": "total = 0\nfor n in [1,2,3,4]:\n    if n % 2 == 1:\n        total += n\nreturn total",
    "note": "Same shape as your task — loop, test each item, add when it matches. Yours tests for even instead of odd."
  }
}
```

Any tier may be omitted; the panel shows only what's present, in order.

## Two worked examples (the pattern in practice)

**For `sum_even` (a Tier-1-gap kata):**
- *Plain:* "Walk through the list and total only the even numbers."
- *Analogy:* "Counting only the red M&Ms — look at each, skip the rest, tally the reds."
- *Mnemonic:* **LEA — Loop, Examine, Add.**
- *Nudge:* "How do you test one number for even? You built `is_even` already."
- *Example:* the odd-sum version above.

**For `two_sum` (the hash-map insight):**
- *Plain:* "For each number, you're asking 'have I already seen the number that would complete the pair?'"
- *Analogy:* "Like a coat check — as you pass each number you jot down where you left it, so when its partner shows up you instantly know where the first one is. No re-searching the whole pile."
- *Mnemonic:* **SIP — Seen It? Pair.** For each number: have I *Seen* the complement? If so, *Pair* them; if not, note this one as *Seen*.
- *Nudge:* "What could you store as you go, so you don't have to re-scan the earlier numbers?"
- *Example:* a solved "find two numbers that multiply to N" using the same seen-as-you-go trick.

Notice the analogies aren't decoration — the coat-check *is* the hash-map insight. A good analogy carries the actual concept.

## Scope

**BUILD:**
- The `help` block format + a Help button on any exercise/lesson that has one.
- Tiered progressive reveal (one tier per click), floor = analogous example.
- Authoring: help content for the highest-value katas first (the Tier-1-gap concepts and the trickiest katas — `two_sum`, `binary_search`, recursion, the data structures).

**DO NOT BUILD:**
- ❌ A tier that reveals this exercise's actual solution.
- ❌ An AI-generated live hint system (a nice future idea, but it risks give-the-answer drift and needs its own guardrails — backlog it; start with authored, reviewed help).
- ❌ Help as a required step — it's always optional, never gates progress.

## How it fits everything else

- **Content-as-data:** `help` is just more JSON; it travels in git, ships in the same files, needs no new runner.
- **The linter** should confirm no `help.example.solution` is the actual answer to *its own* kata (it must be a *different* problem) — the same "no answer leak" discipline you already enforce.
- **Pairs with the audit:** author `help` blocks alongside the new Tier-1 lessons (loops, lists, comparisons). A fragile beginner hitting a hard concept gets both a lesson *before* and a Help button *during* — belt and suspenders exactly where the drop-off data says they're needed most.

## Acceptance criteria

- [ ] Any exercise/lesson with a `help` block shows an "Explain this" button; those without it don't.
- [ ] The panel reveals one tier at a time; the learner controls how deep to go.
- [ ] The deepest tier is an analogous *different* example — never this exercise's solution.
- [ ] Help is optional and never blocks progress.
- [ ] The linter rejects a `help.example.solution` that solves the host kata itself.

When this ships, "stuck" stops being a dead end. A learner who freezes gets a plain-words explanation, a comparison they can picture, an acronym they'll remember, a question that unsticks them — and still writes the code themselves. That's the difference between a tool that tests you and one that teaches you.
