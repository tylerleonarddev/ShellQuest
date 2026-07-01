# ShellQuest v0.1 — Claude Code Build Spec

**Run this on the Ubuntu box with Claude Code.** It builds **exactly v0.1 and nothing more.** Read `ARCHITECTURE.md` first for the *why*; this doc is the *what*, scoped to one version.

---

## Mission (the only thing v0.1 must achieve)

**One complete loop, working end to end:**

> open app → pick a Python kata → write code → app runs it against tests → pass → XP ticks up → streak updates → a git commit records the completion → dashboard reflects the new state.

That is the entire win. If the loop feels good, everything after v0.1 is content and polish. Do not build past it.

## Scope boundary — read this before writing code

**BUILD (v0.1):**
- Electron app that boots to a dashboard.
- Git-backed data layer reading/writing the flat-file structure below.
- One content type: `python-kata`.
- One verification runner: `python-test`.
- XP total, current streak, level.
- A dashboard showing: XP/level/streak, and today's available katas.
- An exercise view: prompt, code editor, "Run" button, pass/fail result.
- On pass: update `progress/`, write an auto-scaffolded devlog draft, `git add` + `git commit`.
- 3 seed katas (provided below).

**DO NOT BUILD (later versions — resist the urge):**
- ❌ ShellQuest / artifact / flag challenges (v0.2)
- ❌ Prerequisite gating logic beyond reading the field (v0.2)
- ❌ The scheduler, dailies/weeklies, spaced repetition (v0.3)
- ❌ Weekly digest, snippet queue, stats page (v0.4–0.5)
- ❌ System-state / machine verification (v2)
- ❌ SQLite or any database (flat files only)
- ❌ Auth, accounts, cloud sync, settings screens
- ❌ Any content type other than `python-kata`

If a feature isn't in the BUILD list, it is out of scope. Note it in `docs/BACKLOG.md` and move on.

## Stack

- **Electron** (latest stable). Renderer in plain HTML/CSS/JS or a light setup — no heavy framework required for v0.1.
- **Node** for main process and git operations (use `simple-git` or shell out to `git`).
- **Python 3** invoked as a subprocess for the test runner (the box already has it).
- No database. No bundler gymnastics beyond what Electron needs.

## Folder structure to create

```
shellquest/
├── app/
│   ├── main/main.js              # Electron main process
│   ├── renderer/                 # dashboard + exercise view (HTML/CSS/JS)
│   └── lib/
│       ├── content.js            # loads content/*.json
│       ├── progress.js           # reads/writes progress/, computes XP/streak/level
│       ├── verify-python.js      # runs python-test verification
│       ├── devlog.js             # scaffolds a draft on pass
│       └── git.js                # add + commit
├── content/python/               # the 3 seed katas below
├── progress/
│   ├── profile.json
│   └── completions.json
├── devlogs/drafts/
├── docs/BACKLOG.md               # park every out-of-scope idea here
├── package.json
└── README.md
```

## Data schemas

`progress/profile.json` (initial):
```json
{ "xp": 0, "level": 1, "streak_days": 0, "last_active_date": null }
```

`progress/completions.json` (initial):
```json
{ "completions": [] }
```

A completion entry appended on pass:
```json
{ "exercise_id": "py-sum-even", "passed_at": "2026-07-01T18:30:00Z", "xp_awarded": 20 }
```

Content file format (do not deviate — it must stay compatible with future versions):
```json
{
  "id": "py-sum-even",
  "type": "python-kata",
  "track": "progression",
  "title": "Sum of even numbers",
  "xp": 20,
  "prerequisites": [],
  "review_interval_days": null,
  "prompt": "…",
  "starter_code": "def sum_even(numbers):\n    pass\n",
  "verification": {
    "runner": "python-test",
    "tests": [ { "call": "sum_even([1,2,3,4])", "expect": 6 } ]
  }
}
```

## The `python-test` runner

1. Take the user's submitted code (a function definition).
2. Write it to a temp file, then append a harness that imports/defines it and runs each `tests[].call`, comparing the result to `expect`.
3. Execute with `python3` as a subprocess. **Run with a timeout (e.g. 5s)** so an infinite loop can't hang the app.
4. Return per-test pass/fail plus any stderr, so the exercise view can show the user *which* case failed.
5. v0.1 note: this runs user code locally with a timeout — acceptable for your own machine and your own code. Do **not** generalize this runner to execute untrusted input; hardening/sandboxing is a v2 concern and belongs in `docs/BACKLOG.md`.

Pass condition: **all** tests pass.

## XP, level, streak

- **XP**: on pass, add the exercise's `xp` to `profile.xp`. A given exercise awards XP only once (check `completions.json` first; if already completed, allow re-practice but award 0).
- **Level**: simple curve, e.g. `level = floor(sqrt(xp / 50)) + 1`. Keep it in one function so it's easy to tune later.
- **Streak**: on any pass, compare `last_active_date` to today. Same day → unchanged. Yesterday → `streak_days += 1`. Older or null → `streak_days = 1`. Update `last_active_date`. (Reps/decay rules come in v0.3 — v0.1 just tracks the consecutive-day count.)

## On-pass sequence (the loop's payoff)

When all tests pass:
1. Append to `completions.json`; update `profile.json` (xp, level, streak, last_active_date).
2. Scaffold `devlogs/drafts/<date>-<exercise-id>.md` with: title, the prompt, the user's passing code in a fenced block, the tests that passed, and a `## Reflection` heading with a one-line prompt for them to fill in. **70% pre-filled** is the goal.
3. `git add -A && git commit -m "Complete <title> (+<xp> XP)"`.
4. Return to dashboard with a visible reward moment (see design intent).

## Dashboard requirements

Must show, at a glance: current **level**, **XP** (and progress toward next level), **streak**, and a list of **available katas** (title + XP) that opens the exercise view on click. Completed katas visibly marked.

## Design intent (so it doesn't look like a bootstrap template)

The subject is a *terminal learning quest for a SIGINT-veteran-turned-cyber-student* — lean into that world, don't fight it. A dark, terminal-adjacent palette with **one** confident accent for progress/reward (pick a single signature color and commit — not three gradients). Monospace for data/code, a characterful non-default display face for headings. The dopamine moment on pass should be **one** well-orchestrated beat (XP counting up, streak flame, a short satisfying transition) rather than scattered confetti everywhere — restraint reads as intentional, noise reads as AI-generated. If a `frontend-design` skill is available on the box, use it for the renderer and derive every color/type choice from a stated token system.

## Seed content (create these three files)

`content/python/kata-sum-even.json`
```json
{ "id": "py-sum-even", "type": "python-kata", "track": "progression", "title": "Sum of even numbers", "xp": 20, "prerequisites": [], "review_interval_days": null,
  "prompt": "Write sum_even(numbers) that returns the sum of the even integers in a list.",
  "starter_code": "def sum_even(numbers):\n    pass\n",
  "verification": { "runner": "python-test", "tests": [ {"call":"sum_even([1,2,3,4])","expect":6}, {"call":"sum_even([])","expect":0}, {"call":"sum_even([2,4,6])","expect":12}, {"call":"sum_even([1,3,5])","expect":0} ] } }
```

`content/python/kata-count-vowels.json`
```json
{ "id": "py-count-vowels", "type": "python-kata", "track": "progression", "title": "Count the vowels", "xp": 20, "prerequisites": [], "review_interval_days": null,
  "prompt": "Write count_vowels(s) that returns how many vowels (a, e, i, o, u, case-insensitive) are in the string s.",
  "starter_code": "def count_vowels(s):\n    pass\n",
  "verification": { "runner": "python-test", "tests": [ {"call":"count_vowels('hello')","expect":2}, {"call":"count_vowels('SIGINT')","expect":1}, {"call":"count_vowels('')","expect":0}, {"call":"count_vowels('AEIOU')","expect":5} ] } }
```

`content/python/kata-fizzbuzz.json`
```json
{ "id": "py-fizzbuzz", "type": "python-kata", "track": "progression", "title": "FizzBuzz list", "xp": 30, "prerequisites": ["py-sum-even"], "review_interval_days": null,
  "prompt": "Write fizzbuzz(n) that returns a list for 1..n where multiples of 3 are 'Fizz', of 5 are 'Buzz', of both are 'FizzBuzz', otherwise the number itself.",
  "starter_code": "def fizzbuzz(n):\n    pass\n",
  "verification": { "runner": "python-test", "tests": [ {"call":"fizzbuzz(5)","expect":[1,2,"Fizz",4,"Buzz"]}, {"call":"fizzbuzz(3)","expect":[1,2,"Fizz"]}, {"call":"fizzbuzz(15)[-1]","expect":"FizzBuzz"} ] } }
```

*(Note `py-fizzbuzz` lists a prerequisite. v0.1 only needs to **read and store** that field and may show all katas; enforcing gating is v0.2. Don't build gating now — just don't lose the data.)*

## Acceptance criteria (v0.1 is done when all are true)

- [ ] `npm start` boots the Electron app to a dashboard.
- [ ] Dashboard shows level, XP, streak, and the three seed katas.
- [ ] Opening a kata shows its prompt, an editor with starter code, and a Run button.
- [ ] Running correct code passes all tests; running wrong code shows which test failed.
- [ ] On pass: XP increases, level/streak update, dashboard reflects it immediately.
- [ ] On pass: a devlog draft appears in `devlogs/drafts/`, ~70% pre-filled.
- [ ] On pass: a git commit is created recording the completion.
- [ ] Re-completing an already-passed kata awards 0 XP (no double-counting).
- [ ] All data lives in flat files under `content/`, `progress/`, `devlogs/` — no database.
- [ ] `docs/BACKLOG.md` exists and every out-of-scope idea encountered is parked there.

## First commands

```bash
git init shellquest && cd shellquest
# then hand this spec to Claude Code and let it scaffold app/, content/, progress/
# make the repo public on GitHub once the loop works — commit one goes public
```

When v0.1 passes every acceptance box, stop, use the app for real for a day, then come back for the v0.2 spec.
