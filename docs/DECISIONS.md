# Design decisions (deviations & clarifications)

## v1.1

**Help-example no-leak is mechanical, not heuristic.** The spec asks the
linter to confirm a `help.example.solution` doesn't solve its own kata.
Rather than guess, `tools/lint-content.js` runs each example through the
HOST kata's real tests via the runner and fails if it passes. Example
functions are also deliberately named differently (sum_odd, product_pair,
car_count…) so they can't accidentally satisfy the host test.

**Help tiers group as the spec intends:** plain + analogy reveal together
as tier 1, then mnemonic, nudge, and the analogous example each on their
own "still stuck?" click. Any tier may be omitted; the bundle's gentle
katas stop at the nudge, while the hard katas (two_sum, binary_search,
recursion, data structures) carry the full example.

**Regression suite lives in `tests/` now** (`npm test`), consolidated from
the per-version scratchpad suites into one self-contained runner that
validates every kata against a reference solution. Wired into CI so the
net travels with the clone — it should have from the start.

**reverse-string rewire:** its prerequisite moved from `py-absolute` to
`py-append-item` so the new loops/lists/comparisons block sits before
Tier 1. Both anchors are deep and locked, so no daily queue was stranded
(and v0.9.2's ghost reconcile covers the general case regardless).

## v0.9.2 (pre-1.0 hardening audit)

A 78-agent adversarially-verified audit produced 46 confirmed findings;
all were fixed. The load-bearing decisions:

**Progress durability:** all progress JSON goes through `app/lib/store.js`
— atomic temp+rename writes; a corrupt file is backed up
(`*.corrupt-<ts>`), restored from the last git commit when possible, and
never silently replaced by defaults.

**Rest days:** a day whose daily queue generates empty (all content done,
no reviews due) auto-clears with no bonus XP — a caught-up user's streak
survives. Ghost ids stranded in today's queue by a content change are
reconciled on load.

**FSRS fairness:** failed runs only rate `Again` when a real graded
attempt happened (per-test results exist) — timeouts, syntax errors, and
environment failures don't count as forgetting.

**`review_interval_days`** remains in the content schema as a reserved
field; FSRS supersedes it and nothing consumes it.

**The stats page build (`site/`) is no longer committed** — CI regenerates
and deploys it on every push; a committed copy only goes stale.

## v0.8

**Assembly does not auto-commit the assembled tool.** The spec says the
learner's completed logparser.py is "fine to commit if they want" — but it
also mandates (and v0.9 re-asserts) a linter rule that committed scaffolds
contain only stubs. Those two can't both hold if the learner commits their
work. v0.8 resolution: pass-commits stage only progress/ as always; the
assembled file stays a local working copy, and the linter checks the
HEAD version of scaffold files (falling back to the working tree for
never-committed files).

**RESOLVED (v0.9 amendment, decided upstream):** one clean rule, no
exceptions — the curriculum repo commits only stubs under `projects/`;
the learner's assembled copy never enters git; finished tools graduate to
their own repo (e.g. tylerleonarddev/logparser), where they're genuinely
the learner's to show. Implementation note: a tracked file can't be
.gitignored, so assembly marks the target with
`git update-index --skip-worktree` — git stays blind to local solutions
while the committed scaffold remains stubs. If a curriculum update ever
changes a scaffold, clear the flag first
(`git update-index --no-skip-worktree <file>`), pull, and replay
completed steps by re-passing them.

**Isolation is enforced in code, twice.** `resolveProjectFile` refuses any
`project.file` whose resolved path escapes `projects/<name>/` (traversal,
absolute paths, sibling projects, the dir itself), and the linter rejects
such content before it ships. Marker format and project-block shape are
frozen — v0.9's cold-start walkthrough asserts against them.


## v0.6

**FSRS runs with `enable_short_term: false`.** The library's default
learning steps would make a freshly passed exercise due 10 minutes later —
same-day resurfacing in a daily-granularity queue. Long-term-only
scheduling starts at ~3 days, which matches how ShellQuest reviews work.

**Failure guard carried over:** `Rating.Again` applies only to a due
review, at most once per local day (`sq_last_failed_on` rides on the card;
ts-fsrs ignores extra fields). Repeated same-day attempts while relearning
don't compound lapses.

**CI installs prod deps via `npm ci --omit=dev` before `build-stats.js`;**
adding a runtime dep on the stats path needs no workflow change, but a new
build tool might.

**Migration preserved due dates** (the spec offered due=today or
preserved): existing SM-2 schedules became fresh FSRS cards keeping their
next_review as `due`, so the upgrade changed nothing about the next day's
queue. The memory model self-corrects within a couple of reviews.


## v0.5

**Onboarding is content + a first-launch gate,** not a prerequisite of
every root. `content/onboarding.json` is a normal python-kata whose track
is `onboarding`; the renderer opens it on launch until it's completed. It
is excluded from the ladder view, the daily queue, spaced repetition, and
devlog scaffolding.

**Lesson guards live in the engine,** per the spec: no devlog, no review
schedule, allowed in the daily queue as "new" items. The content loader
and linter validate lessons by their own shape (body/completion instead of
prompt/verification).

**Pages deploys via GitHub Actions** (`.github/workflows/pages.yml`)
rather than branch-based Pages, because branch deploys only serve / or
/docs and the stats page lives in site/. The workflow regenerates the page
from progress data on every push, so it's always current. The launch
moment is flipping Settings → Pages → Source to "GitHub Actions".

**glossary.json** lives in content/ (it is content) but is skipped by the
exercise loader and schema-linted by its own rule; its "flag" definition
legitimately mentions the SQ{...} shape, which the flag-leak rule would
otherwise reject.


Where the build diverged from or extended the specs, and why. The specs are
kept verbatim in this folder; this file is the delta.

## v0.2

**Declarative lab setup (`setup` field).** The spec's challenge example
references planted files (`.secret` in a lab dir) but defines no planting
mechanism. Challenges may declare `"setup": { "dirs": [...], "files":
[{path, contents}] }` — pure data, materialized into
`~/shellquest-lab/<challenge-id>/` on first open (or on "reset lab"). Data,
never scripts, per the architecture's content-is-data rule.

**Dynamic flags.** The spec stores flags as SHA-256 hashes so the public
repo never contains answers — but a *planted* flag would still appear in
plaintext inside its `setup` data, defeating the hash. So planted flags are
dynamic: content carries a `{{FLAG}}` placeholder, the app generates a
random flag per materialization, and only its hash is stored, locally, in
`~/shellquest-lab/.verify/` (outside the repo, per-machine — consistent
with the machine-state principle). A `flag` check without `expected_sha256`
verifies against the generated hash. Static `expected_sha256` remains
supported for answers that are not planted (external wargames, knowledge
flags).

**Field naming.** The spec uses `expected_sha256` for flags but
`expect_sha256` for command-output; both are `expected_sha256` in the
implementation.

## v0.3

**"Failing a review" defined.** A failed run of a *due* exercise hits its
schedule immediately (interval → 1, ease −0.2); passing later the same day
counts as a review pass from the reduced interval. Failures on unscheduled
or not-yet-due exercises never touch schedules — practice is free.

**Bonus amounts (unspecified in the spec, all data-tunable):** +15 XP for
clearing the daily (`daily.json: bonus_xp`); weekly goals carry their own
`bonus_xp` (60 for 5/7 days, 40 for 3 new exercises), awarded as a lump
when every goal hits its target.

**"Next" new content = prerequisite-depth order,** then id. Alphabetical
would serve Binary search before Reverse a string.

**Streak with no daemon.** Missed days are detected lazily: the dashboard
shows `effectiveStreak()` (0 if the last clear is older than yesterday),
and the write happens on the next clear. Queue item kinds (review/new) are
frozen into `daily.json` at generation so a new item passed today doesn't
relabel itself.

**Migration backfill.** Completions that predate the scheduler get a
schedule due immediately — existing wins enter the review pool instead of
vanishing.

## v0.2 (cont.)

**Gating enforced in the main process,** not just hidden in the UI — a
locked exercise cannot be opened or run via IPC regardless of renderer
state.
