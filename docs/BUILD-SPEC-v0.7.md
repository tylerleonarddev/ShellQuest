# ShellQuest v0.7 — Build Spec (Data Structures Tier)

**Run after v0.6.** This adds the one engine capability the ladder has been missing — tests that drive an object across several steps — and opens the door to the data-structures content that CS coursework and interviews actually live in. It completes the core Python arc.

---

## Mission

> The test runner can exercise a class or object across multiple steps (build it, operate on it, check its state), unlocking a Data Structures tier: stacks, queues, linked lists, and the classic algorithms built on them.

## Scope boundary

**BUILD (v0.7):**
- **Part 1** — a `python-script` runner: multi-step tests that share state.
- **Part 2** — the Data Structures tier content, gated behind Tier 4.

**DO NOT BUILD:**
- ❌ System-state "build up your box" verification — that's its own major version (see the roadmap).
- ❌ New languages (C concept track) — later.
- ❌ Arbitrary code sandboxing beyond the existing timeout — this still runs *your own* code on *your own* machine. (If public content contribution ever opens up, revisit — that's the threat model we flagged.)
- Park extras in `docs/BACKLOG.md`.

## Part 1 — the multi-line test runner (`python-script`)

The current `python-test` runner evaluates a single expression per test — perfect for pure functions, useless for a `Stack` you have to build and poke. Add a second runner, `python-script`, that keeps content-as-data intact (it's just a new `runner` value; the `python-kata` type is unchanged).

**Verified format** (this exact shape was run and passes):
```json
{
  "id": "py-stack",
  "type": "python-kata",
  "track": "progression",
  "title": "Build a Stack",
  "xp": 45,
  "prerequisites": ["py-merge"],
  "review_interval_days": null,
  "prompt": "A stack is last-in, first-out — like a stack of plates. Implement a Stack class with push(x), pop() (removes and returns the top), peek() (returns the top without removing), is_empty(), and support for len(). The next few challenges build on this one.",
  "starter_code": "class Stack:\n    def __init__(self):\n        pass\n",
  "verification": {
    "runner": "python-script",
    "tests": [
      {
        "setup": ["s = Stack()", "s.push(1)", "s.push(2)", "s.push(3)"],
        "checks": [
          { "call": "s.pop()", "expect": 3 },
          { "call": "s.peek()", "expect": 2 },
          { "call": "len(s)", "expect": 2 }
        ]
      },
      {
        "setup": ["s = Stack()"],
        "checks": [ { "call": "s.is_empty()", "expect": true } ]
      }
    ]
  }
}
```

**Runner behavior:** define the user's submitted code once; then for **each** test, create a fresh namespace containing that code, execute the `setup` lines in order, and evaluate each `check.call`, comparing to `check.expect`. A test passes when all its checks pass; the exercise passes when all tests pass. Reuse the existing 5-second timeout and the beginner-friendly failure messages from v0.5 — on a failed check, report it plainly (`"s.pop() gave 2, expected 3"`), and if a setup line throws, map the exception the same way katas already do.

That's the whole engine change. Everything else (XP, FSRS review scheduling, devlog scaffolding, gating) works unchanged, because a `python-script` exercise is still just an exercise.

## Part 2 — the Data Structures tier content

A new cluster of exercises using the runner, gated behind Tier 4 (start it after `py-merge`). Suggested arc, each building on the last:

1. **Build a Stack** (the example above) — LIFO.
2. **Balanced parentheses** — `is_balanced(s)` using a stack. The first "why stacks matter" payoff. *(Verified working.)*
3. **Build a Queue** — FIFO (`enqueue`, `dequeue`, `peek`, `len`). *(Verified working.)*
4. **Singly linked list** — a `LinkedList` with `append` and `to_list`, then `reverse`. The data structure that teaches pointers/references, which C later makes concrete.
5. **Stretch:** a binary search tree with `insert` and `contains` — ties back to the binary-search intuition from Tier 3.

Consider a short **lesson card** before the tier ("What is a data structure?") in the v0.5 lesson format, so the concept is introduced before the first `Stack`. The full tier content (authored and verified against reference solutions, like every prior block) will be delivered as a drop-in content bundle — Part 1 just needs to render the format above.

## Acceptance criteria (v0.7 done when all true)

- [ ] A `python-script` exercise renders, accepts a class definition, runs multi-step tests, and passes/fails correctly.
- [ ] Setup lines share state within a test; each test starts from a fresh namespace.
- [ ] A failed check reports in plain language; a thrown setup line maps to a friendly error.
- [ ] The `Stack`, `Queue`, and `is_balanced` exercises pass with correct solutions and fail with wrong ones.
- [ ] The tier is gated behind Tier 4 and flows in prerequisite order.
- [ ] XP, FSRS review, gating, and devlog scaffolding all work on `python-script` exercises with no special-casing.

When these pass, the core Python arc is complete: a beginner can climb from `return "Hello, world!"` all the way to implementing the data structures a CS program assumes on day one — all self-verifying, all in public. After this, it's hardening and content-fill toward 1.0.
