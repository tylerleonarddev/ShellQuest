# ShellQuest v0.5 — Build Spec (Teaching Foundation + Ship It)

**Run after v0.4 lands.** This is the version that makes the ladder safe for someone who knows *literally nothing* about Python, and then packages, documents, and launches the whole thing. It's broader than earlier specs on purpose — it's the "make it real" release. Two parts: **A) Teaching Foundation** (the priority) and **B) Ship It**.

The guiding principle: **never make the learner learn two things at once.** Right now a true beginner meets a new concept *and* the app's mechanics *and* raw Python errors simultaneously. v0.5 separates those so each is learned alone.

---

## Scope boundary

**BUILD (v0.5):**
- **A1** Onboarding flow — an unfailable first exercise that teaches only the app's mechanics.
- **A2** A new `lesson` content type — plain-English concept cards, completed by reading, that sit in `content/` as data.
- **A3** Beginner-friendly failure messages — plain language, never a raw traceback.
- **A4** A glossary panel — always-available definitions of every term.
- **B1** Seed the full curriculum (Tier 0 + Tiers 1–4) and wire the ladder end to end.
- **B2** Migration runbook (`docs/MIGRATION.md`).
- **B3** Stats page go-live (enable GitHub Pages — the one deliberate launch), gated by a pre-launch checklist.
- **B4** Light packaging — a clean run + desktop launcher (see the caution in B4; do **not** break the repo-as-data model).

**DO NOT BUILD:**
- ❌ System-state verification (v2)
- ❌ Multi-line test runner / data-structure katas (separate future block)
- ❌ Community content / accepting PRs (threat-model first)
- Park extras in `docs/BACKLOG.md`.

---

## Part A — Teaching Foundation

### A1. Onboarding flow (teach the mechanics, nothing else)

On first launch, before any real content, run a single **unfailable** exercise whose only job is to teach how the app works:

- Its `starter_code` already contains the correct answer. The prompt says, in plain words: *"This is the editor. This is the Run button. Press Run — green means you passed. That's the whole loop. Let's go."*
- Passing it shows the reward moment once, so the learner has *felt* a success before any concept appears.
- Mark onboarding complete in `progress/` so it only appears once. Everything else in the ladder depends on it.

The point: when the first real concept arrives, 100% of the learner's attention is on the concept, because the interface is already familiar.

### A2. The `lesson` content type (teach the idea *before* asking for it)

Add a second content type alongside `python-kata`, kept as data in `content/` (the content-is-data rule holds). A lesson teaches one idea in two or three plain sentences, then hands off to the katas that use it.

**Format** (`content/python/lesson-strings.json`):
```json
{
  "id": "lesson-strings",
  "type": "lesson",
  "track": "progression",
  "title": "What is a string?",
  "xp": 5,
  "prerequisites": ["py-square"],
  "body": "A *string* is just text — a word, a sentence, anything. In Python you wrap it in quotes: \"hello\" is a string. You can pull out pieces of it and change it, which is what the next few challenges practice.",
  "completion": "acknowledge"
}
```

**Engine behavior for `type: "lesson"`:**
- The view renders `body` (markdown) and a single **"Got it"** button — no editor, no Run.
- Clicking "Got it" completes it: award the small `xp`, record the completion, unlock dependents. Reuse the existing on-pass pipeline for XP/unlock/commit.
- Lessons do **not** scaffold a devlog (they aren't achievements to write up) and do **not** enter spaced repetition (nothing to re-solve). Guard both.
- Lessons **may** appear in the daily queue as "read this" items — a daily like "read 1 lesson, do 2 katas" is ideal.

Lessons become **prerequisites of the katas they introduce**, so the ladder interleaves: *lesson → the katas that use it → next lesson → …*. (The full set of lesson cards and the re-wired prerequisites will be delivered as a content drop — build the engine to the format above; the content arrives as data.)

### A3. Beginner-friendly failure messages

A red Python traceback scares off beginners faster than anything. When a kata fails, translate:

- **Wrong answer** (test ran, result mismatched): show it plainly —
  *"For `sum_even([1,2,3,4])` your code gave back **7**, but the challenge expected **6**."*
  The runner already has the call, the expected value, and the actual value; surface them in that sentence, don't dump the raw comparison.
- **Code error** (an exception was raised): map the common ones to one plain line, and hide the traceback behind an optional "show details":
  - `NameError` → "You used a name Python doesn't recognize — check spelling, or that it's defined."
  - `SyntaxError` → "Python couldn't read this line — often a missing `:` or an unclosed quote/bracket."
  - `TypeError` → "You mixed two kinds of value that don't go together (like a number and text)."
  - `IndexError` → "You reached past the end of a list or string."
  - `ZeroDivisionError` → "Something divided by zero."
  - anything else → "Your code hit an error: `<ExceptionName>`." + details toggle.

The advanced learner can always open the raw output; the beginner never has to.

### A4. Glossary panel

An always-available side panel or modal, rendered from one data file `content/glossary.json` (a list of `{term, definition}`), so no word in a prompt is ever a dead end:

```json
[
  { "term": "function", "definition": "A named block of code that takes input and hands back a result." },
  { "term": "return", "definition": "The keyword that hands a value back out of a function." },
  { "term": "parameter", "definition": "A named input a function receives, like `name` in greet(name)." },
  { "term": "string", "definition": "Text, written in quotes: \"hello\"." },
  { "term": "integer", "definition": "A whole number, like 5 or -3." },
  { "term": "boolean", "definition": "A True/False value." }
]
```

Keep it data so the glossary grows by editing one file, never code. A **jargon pass** over every existing prompt is part of this task: no term should appear in a prompt before it's either defined inline or present in the glossary.

---

## Part B — Ship It

### B1. Seed the full curriculum and wire the ladder

- Ensure Tier 0 (10 katas) + Tiers 1–4 (17 katas) are all in `content/python/`.
- Wire the single continuous climb: onboarding → Tier 0 (with lesson cards interleaved) → `kata-reverse-string` (prerequisite `py-absolute`) → Tiers 1–4.
- Run the content linter (from v0.4) and confirm it passes clean.

### B2. Migration runbook — `docs/MIGRATION.md`

Write the exact steps to move to a new machine, matching the architecture's progress-vs-machine-state separation:
```
git clone <repo> && cd shellquest && npm install && npm start
```
Document that curriculum progress and XP come across in git untouched; the app detects the new hostname and rebuilds `machine-state/` by re-running checks against the new box. Nothing about *you* is lost; only *this machine's* state is rebuilt from reality.

### B3. Stats page go-live (the one deliberate launch)

The stats page was built in v0.4 but not hosted. v0.5 flips it on — enable GitHub Pages pointing at the generated `site/`. Gate it behind a **pre-launch checklist**, because this is the moment things become truly visible:
- [ ] Content linter passes (no literal `SQ{...}` flags, no risky commands).
- [ ] `devlogs/drafts/` confirmed gitignored; only intended posts in `published/`.
- [ ] No secrets, tokens, or personal info anywhere in tracked files (`git grep` for the obvious).
- [ ] Repo description + topics set.
- [ ] Stats page reviewed — reads the way you'd want a hiring reviewer to see it.

This is the only "announcement" the project needs, and it's a quiet one: the page simply goes live with real history already behind it.

### B4. Light packaging — ⚠️ mind the data model

The natural instinct is to package a standalone binary — but **the app operates on the repo it lives in** (`content/`, `progress/`, `devlogs/` are siblings of `app/`). A binary installed elsewhere would sever the app from its data and break the repo-as-save-file model. So:

- Keep the primary run path `npm start` **from inside the repo** — that's not a limitation, it's what keeps data and app together.
- Acceptable additions: a **desktop launcher** (`.desktop` entry) that runs the app against the repo directory, and a documented one-time setup in the README.
- Do **not** build a distributable that copies the app away from the repo or stores progress outside git. If a portable binary is ever wanted, that's a real architecture change for a later version — note it in the backlog, don't sneak it in here.

---

## Acceptance criteria (v0.5 done when all true)

**Teaching foundation**
- [ ] First launch runs an unfailable onboarding exercise that teaches the mechanics, shown only once.
- [ ] `type: "lesson"` renders body + a "Got it" button, completes on acknowledge, awards XP, unlocks dependents — no editor, no devlog, no review scheduling.
- [ ] A failing kata shows a plain-language message (wrong-answer diff or mapped error), with raw details behind an optional toggle.
- [ ] A glossary panel is always reachable and renders from `content/glossary.json`.
- [ ] No prompt uses a term that isn't defined inline or in the glossary.

**Ship it**
- [ ] Full ladder wired: onboarding → Tier 0 (+lessons) → Tiers 1–4, unlocking in order.
- [ ] `docs/MIGRATION.md` exists and is accurate.
- [ ] GitHub Pages is live for the stats page, and the pre-launch checklist passed.
- [ ] `npm start` from the repo runs cleanly; optional desktop launcher works; no build stores progress outside git.
- [ ] Content linter passes.

When these pass, ShellQuest is a real, teaching, self-documenting, publicly-visible learning platform that starts a total beginner at zero and carries them into CS-fundamentals territory — running on a repo that's simultaneously your save file, your curriculum, your public journal, and your résumé. That's the foundation built. Everything after is more content and the occasional engine tweak (multi-line tests → data structures; system-state checks → building up your box).
