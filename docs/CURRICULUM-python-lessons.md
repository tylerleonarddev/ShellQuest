# ShellQuest — Tier 0 with Lesson Cards (Absolute-Zero Bundle)

This bundle makes the ladder teach, not just test. It contains **6 lesson cards** + the **10 Tier 0 katas re-wired** so each concept is explained in plain English *before* the challenges that use it. Total added lesson XP: **30**.

## ⚠️ This replaces the earlier Tier 0 files
The 10 kata files here are the *same katas* as the first Tier 0 drop, but with updated `prerequisites` so lessons gate them. **Overwrite** the earlier `kata-*.json` files in `content/python/` with these, and add the 6 `lesson-*.json` files alongside. (Requires the v0.5 `lesson` content-type engine to render the cards.)

## The interleaved ladder
```
[onboarding — runs first, built into the app]
LESSON  What is a function?          → kata  Your first function
LESSON  Giving a function input      → kata  Give it an input
LESSON  Numbers and math             → kata  Add two numbers
                                        kata  Double it
                                        kata  Square a number
LESSON  True, False, and remainders  → kata  Even or odd
LESSON  Working with strings         → kata  Last letter
                                        kata  Make it loud
LESSON  Making a decision            → kata  Pick the bigger one
                                        kata  Strip the minus sign
        ...then → reverse-string (Tier 1)
```

## One-line wiring change (unchanged from before)
Open `content/python/kata-reverse-string.json` and set:
```json
"prerequisites": ["py-absolute"]
```
That connects Tier 0 to the rest of the ladder.

## How a lesson behaves (recap of the v0.5 engine contract)
- Renders its `body` and a single **"Got it"** button — no editor, no Run.
- Completing it awards the small XP, records completion, unlocks the next item.
- Lessons don't scaffold devlogs and don't enter spaced repetition.

## Design notes
- Every lesson defines each term before it's used, and ends by pointing at the very next challenge — so momentum never breaks between reading and doing.
- No prompt or lesson uses a word that isn't defined inline or available in the glossary (`content/glossary.json`, per the v0.5 spec).
- Lessons are deliberately 3–4 sentences. A beginner reads, nods, and immediately applies it. Longer would break the rhythm.
