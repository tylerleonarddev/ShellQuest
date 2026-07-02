# ShellQuest — Python Fundamentals Coverage Audit

**Question:** are the fundamentals actually there? **Answer:** the ladder is strong on functions, arithmetic, recursion, and data structures — but it's missing explicit teaching for three foundational concepts, and they happen to be *the exact three where beginners most often quit.*

---

## The benchmark

Measured against boot.dev's "Learn to Code in Python" (an intro-from-zero course — the closest public analog to what ShellQuest is, and the track you're already on). Its fundamentals chapters: **Variables, Functions, Scope, Testing/Debugging, Computing (arithmetic), Comparisons, Loops, Lists, Dictionaries, Sets, Errors, Type Hints.**

**The critical data point:** boot.dev published its learner drop-off funnel, and the three chapters with the highest quit rates are **Comparisons, Loops, and Lists** (chapters 7–9). Those are the walls beginners hit. So coverage of those three isn't just "nice to have complete" — it's where a learning platform most has to hold the learner's hand, or lose them.

## Coverage matrix

| Fundamental | In ShellQuest? | Where | Verdict |
|---|---|---|---|
| Variables | Implicit only | (taught via functions) | ⚠️ no explicit intro |
| Functions | ✅ Strong | lesson-functions, lesson-parameters, say-hello, greet | solid |
| Scope | ❌ | — | minor gap |
| Testing / Debugging | Partial | the whole app *is* testing | debugging not taught (the Help system addresses this) |
| Computing (arithmetic) | ✅ | lesson-numbers, add/double/square | solid |
| **Comparisons & boolean logic** | ⚠️ Thin | lesson-booleans (==, %); used in bigger, balanced-parens | **high-drop-off — needs an explicit lesson** |
| **Loops (for/while/range)** | ❌ Implicit only | used everywhere (max-of-list, fibonacci…) never taught | **highest-drop-off — biggest gap** |
| **Lists** | ❌ Implicit only | used everywhere (flatten, two-sum…) never introduced | **high-drop-off — big gap** |
| Dictionaries | ⚠️ Used, not taught | word-count, two-sum, count-by-level | medium gap |
| Sets | ❌ | not used at all | minor gap |
| Errors (try/except) | ❌ | — (log parser reads files, which can throw) | medium gap |
| Type Hints | ❌ | — | minor/modern |
| Recursion | ✅ Strong | factorial-rec, sum-digits, power | solid (bonus vs. benchmark) |
| Data structures | ✅ Strong | stack, queue, linked-list, bst, balanced-parens | solid (bonus vs. benchmark) |
| Classes / objects | ⚠️ Used, primer thin | lesson-data-structures intro; Stack et al. use classes | consider a "what is a class" primer |

## The headline finding

**The three concepts where beginners most often quit — Comparisons, Loops, and Lists — are exactly the three your ladder leans on constantly but never explicitly teaches with a lesson before the katas.** A learner currently first meets a loop *inside* `max_of_list` while also trying to learn the accumulator pattern — two new things at once, which is the failure mode v0.5's teaching layer was built to prevent. The katas assume these concepts; the curriculum never introduces them. That's the single most important gap to close, and it's backed by real funnel data, not opinion.

## Prioritized additions

**Tier 1 — Critical (close the drop-off gaps).** Author these as lesson cards *plus* a couple of gentle explicit katas each, slotted into the ladder *before* the katas that currently assume them:
1. **Loops** — for-loops, `range`, iterating a list, the accumulator pattern (count/sum/build). Place before `max_of_list`.
2. **Lists** — create, index, slice, `append`, iterate. Place before the first list-consuming kata.
3. **Comparisons & boolean logic** — `<, >, <=, >=, ==, !=` and `and / or / not`. Place after `lesson-booleans`, before `bigger` and `balanced-parens`.

**Tier 2 — Important:**
4. **Variables** — an explicit first primer (assignment, naming) at the very start, before `lesson-functions`.
5. **Dictionaries** — a lesson before `word_count`.
6. **Errors (try/except)** — a lesson + one kata; ties naturally to the file-reading in the log-parser project.
7. **Classes / objects** — a short "what is a class" primer before the data-structures tier.

**Tier 3 — Nice-to-have / modern:** Sets, Type Hints, Scope, f-string formatting. Add once Tier 1–2 land.

## Sequencing note

Every Tier 1 addition should sit **before** the kata that first needs it, wired via `prerequisites`, so the interleave stays *lesson → the katas that use it*. That's the same principle already working in Tier 0 — it just needs to extend to loops, lists, and comparisons, which slipped in implicitly during the early builds.

## Bottom line

The ladder is genuinely strong — arguably *ahead* of the benchmark on recursion and data structures. But it has three holes precisely where beginners are most fragile. Fill the Tier 1 gaps (loops, lists, comparisons) with explicit lessons and gentle katas, and ShellQuest goes from "great for someone with a little momentum" to "genuinely safe from absolute zero" — which is the stated goal.
