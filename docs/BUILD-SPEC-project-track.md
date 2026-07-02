# ShellQuest — Build Spec: Project Tracks

**A major expansion, buildable as v0.8 (fold hardening in after).** Until now the ladder teaches *concepts* verified by toy tests. A **Project Track** graduates those fundamentals into building **one real, useful tool**, one verified piece at a time — the payoff that turns "I should keep going" into "I want to see this work." The first track (a log analyzer) is authored, verified, and included as a drop-in bundle.

---

## Mission

> A track that runs *fundamentals → verified build steps → capstone*, where each passed step writes a real, working component into a standalone tool in `projects/<name>/`. Finish the track and you have a script that runs on your machine — assembled entirely from parts you earned, and never able to break the app that graded you.

## Scope boundary

**BUILD:**
- **Project Track support** — treat a project as its own track; each build step assembles into a real file.
- **The assembly mechanic** — on passing a build step, write the verified solution into the project file between function markers.
- **One new runner, `project-run`** — the capstone runs the assembled tool and checks its output.
- **Ship the Log Analyzer track** (the included bundle) as the proof-of-concept.

**DO NOT BUILD:**
- ❌ More than one project track right now. Prove the pattern end-to-end with the log analyzer, *then* author more. Ten half-built projects teach less than one finished tool.
- ❌ Letting a project modify `app/` or anything outside its own `projects/<name>/` folder. The isolation is the safety guarantee — do not weaken it.
- ❌ Arbitrary sandboxing beyond the existing timeout — `project-run` executes *your own* assembled code on *your own* machine. (Revisit only if community-contributed projects ever become a thing.)
- Park extras in `docs/BACKLOG.md`.

## How a Project Track is structured

It reuses everything: exercises, prerequisites, XP, FSRS, gating. A project track is just a themed, gated sequence with three kinds of item:

1. **Intro lesson** (`type: "lesson"`) — sets up what you're building and why.
2. **Build steps** (`type: "python-kata"`) — ordinary verified katas (existing `python-test` / `python-script` runners — nothing new), each carrying a `project` block.
3. **Capstone** — runs the finished tool (new `project-run` runner).

Each item uses `track: "project:<name>"` (e.g. `project:logparser`). That's its own track with its own root — which the "one root per content directory" linter rule you already added correctly allows. Gate the intro lesson behind a point in the main ladder where the needed fundamentals are solid (the log analyzer gates behind `py-merge`).

## The `project` block and the assembly mechanic

Each build step carries:
```json
"project": { "name": "logparser", "file": "projects/logparser/logparser.py", "function": "parse_line" }
```

The project file ships as a **scaffold**: a working `main()`/CLI plus one marked, stubbed block per function:
```python
# --- BEGIN parse_line ---
def parse_line(line):
    raise NotImplementedError("Complete the 'Parse one log line' step in ShellQuest.")
# --- END parse_line ---
```

**On passing a build step,** the app replaces everything between `# --- BEGIN <function> --- / # --- END <function> ---` in the named file with the learner's verified solution (re-wrapped in the same markers). The tool assembles itself from parts the learner earned.

Two properties this guarantees, both important:
- **Isolation = safety.** Everything lives under `projects/<name>/`, never `app/`. A wrong or weird solution can, at worst, make the *tool* misbehave — it can never break ShellQuest itself. This is the whole reason we build tools *beside* the app, not *into* it.
- **It's a real artifact.** When the track's done, `projects/logparser/logparser.py` is a genuine script the learner runs, keeps, commits, and can show in an interview.

## The `project-run` runner (capstone only)

The capstone verifies the *assembled tool actually works*:
```json
"verification": {
  "runner": "project-run",
  "command": "python3 projects/logparser/logparser.py projects/logparser/fixtures/sample.log",
  "expect_contains": ["Total lines: 5", "ERROR: 2", "write failed on /var/log"]
}
```
Run the command (reuse the 5s timeout), capture stdout, and pass if **every** string in `expect_contains` is present. On failure, show the actual output so the learner can see what's off. That's the only new engine piece; keep it small.

## Answer safety (public repo)

The scaffold ships with `NotImplementedError` stubs, **never** the solutions — so nothing in the public repo gives away a build step. Add one linter rule: a file under `projects/*/` referenced by a `project` block must not contain a completed solution (i.e. the marked blocks should be stubs in the committed scaffold; the filled-in version is the learner's local working copy). The learner's *own* completed `logparser.py` is fine to commit if they want — that's their earned work, not an answer key shipped with the curriculum.

## Included: the Log Analyzer track (authored + verified)

The drop-in bundle contains the intro lesson, 5 build-step katas (`parse_line`, `count_by_level`, `filter_by_level`, `error_messages`, `summarize`), the capstone, the scaffold, and `fixtures/sample.log`. All 5 steps were validated against reference solutions (10 test cases) and the assembled tool was run end-to-end — it produces the correct report. Gated behind `py-merge`; 270 XP total. Drop `content/python/*` into your content dir and `projects/logparser/*` into the repo.

## Acceptance criteria

- [ ] A `project:logparser` track appears, gated behind `py-merge`, flowing in order.
- [ ] Passing a build step writes the learner's solution into `projects/logparser/logparser.py` between the correct markers.
- [ ] The assembly only ever touches files under `projects/<name>/` — never `app/`.
- [ ] The `project-run` capstone executes the assembled tool and passes only when the output contains all expected strings.
- [ ] XP, FSRS review, gating, and devlog scaffolding work on project steps unchanged.
- [ ] The shipped scaffold contains only stubs (no solutions); the linter enforces this.

When this works, ShellQuest stops being only a set of exercises and becomes a place where finishing the fundamentals means *building something real*. That's the motivational engine for the long haul — and the first tool a learner points at and says "I made that."
