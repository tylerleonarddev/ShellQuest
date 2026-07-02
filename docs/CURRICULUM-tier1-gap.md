# ShellQuest — Tier-1 Gap Bundle: Loops, Lists & Comparisons (with Help)

Closes the three fundamentals the audit flagged — the exact concepts boot.dev's data shows beginners quit on — and does it with a lesson *before* and a Help button *during*. **3 lessons + 6 katas, 125 XP.** Every kata was validated both ways: it passes a correct solution and *fails* a plausible wrong one.

## What's inside
| Concept | Lesson | Katas |
|---|---|---|
| Comparisons & boolean logic | Comparing and combining conditions | `in_range` (and), `either_true` (or) |
| Loops | Doing something to every item | `sum_to` (accumulator), `count_evens` (loop + test + tally) |
| Lists | Lists: holding many things | `first_and_last` (indexing), `append_item` (append) |

Each kata carries a **4-tier help block** (`help`): plain words → analogy → memory hook → Socratic nudge. Examples: `count_evens` = "counting only the red cars" / **LET — Loop, Examine, Tally**; `sum_to` = "stacking coins" / **SLA — Start, Loop, Add**.

## Where it slots
The block sits right after Tier 0, *before* the Tier-1 katas that currently assume these concepts (so a learner meets loops and lists in a lesson before `max_of_list` throws both at once). The chain:

```
py-absolute
  → lesson-comparisons → in-range → either-true
  → lesson-loops       → sum-to   → count-evens
  → lesson-lists       → first-and-last → append-item
  → (Tier 1) reverse-string → ...
```

## One existing edit (the only manual change)
Set `content/python/kata-reverse-string.json` prerequisites to `["py-append-item"]` (currently `["py-absolute"]`). That re-points the start of Tier 1 to come *after* the new block. Everything else chains automatically.

## Requires
The `help` blocks render only once the **Help System engine** (`BUILD-SPEC-help-system.md`) is built. Until then the katas work normally; the help data just sits unused. Build the engine, and every kata here lights up its "Explain this" button.
