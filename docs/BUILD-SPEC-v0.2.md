# ShellQuest v0.2 — Claude Code Build Spec

**Run on the box only after v0.1 passes its four loop checks** (pass awards XP, re-pass awards 0, devlog draft lands, git commit lands). This builds on the v0.1 engine — do not rebuild what works.

---

## Mission

**Two content types flow through one engine, and the ladder actually gates.**

> A second kind of exercise — ShellQuest terminal challenges verified by artifact/flag — runs through the same loop as Python katas. Exercises whose prerequisites aren't met are visibly **locked** and can't be opened until unlocked.

That's it. This proves the content layer is truly generic (the architecture's core claim) and turns the flat list into a real ladder.

## Scope boundary

**BUILD (v0.2):**
- New content type `shell-challenge` with a new runner `artifact-check`.
- Port your existing ShellQuest levels into `content/shellquest/` as `shell-challenge` files.
- **Enforce** prerequisite gating: lock exercises whose prereqs aren't in `completions.json`; show a locked state; block opening them.
- Everything else (XP, streak, devlog, commit) reuses the v0.1 pipeline unchanged.

**DO NOT BUILD:**
- ❌ Scheduler / dailies / weeklies / spaced repetition (v0.3)
- ❌ Weekly digest, snippet queue, stats page (v0.4–0.5)
- ❌ System-state verification (v2)
- ❌ Any new content type beyond `shell-challenge`
- Park stray ideas in `docs/BACKLOG.md`.

## The `shell-challenge` content format

A challenge asks you to *do something in the terminal* that produces a verifiable result. Example (`content/shellquest/sq-find-flag.json`):

```json
{
  "id": "sq-find-flag",
  "type": "shell-challenge",
  "track": "progression",
  "title": "Read the hidden file",
  "xp": 25,
  "prerequisites": [],
  "review_interval_days": null,
  "prompt": "There is a file at ~/shellquest-lab/level1/.secret. Read it and submit the flag string it contains.",
  "verification": {
    "runner": "artifact-check",
    "checks": [
      { "kind": "flag", "expected_sha256": "9f86d0818...<hash>" }
    ]
  }
}
```

`artifact-check` supports these `checks` kinds (build the ones you need to port your levels):

- **`flag`** — user pastes a string; app compares its SHA-256 to `expected_sha256`. Pass if equal.
- **`file-exists`** — `{ "kind": "file-exists", "path": "~/foo/bar" }` — pass if the path exists.
- **`file-contains`** — `{ "kind": "file-contains", "path": "...", "pattern": "regex" }` — pass if file matches.
- **`command-output`** — `{ "kind": "command-output", "command": "...", "expect_sha256": "..." }` — run the command, hash stdout, compare.

Pass condition: **all** checks pass.

### ⚠️ Public-repo consequence — hash the answers

The repo is **public**. If a shell challenge stored its flag in plaintext, anyone (including future-you looking for a shortcut) could read the answer straight out of the content file. So flags and expected command outputs are stored as **SHA-256 hashes**, never plaintext. The app hashes the user's submission and compares. Provide a tiny helper so you can generate them:

```bash
printf '%s' 'the-flag-text' | sha256sum   # copy the hash into expected_sha256
```

(Python katas don't need this — their tests aren't answers you can copy without writing the function. Only flag/output answers need hashing.)

## Prerequisite gating (now enforced)

- An exercise is **unlocked** iff every id in its `prerequisites` appears in `completions.json`.
- Locked exercises render visibly locked (dimmed, lock icon, "Requires: <titles>") and **cannot be opened**.
- The dashboard should make the ladder legible — the learner should see what's next and what it takes to unlock it. That "one more unlock away" visibility is part of the pull.

Keep the unlock check in a single pure function (`isUnlocked(exercise, completions)`) so v0.3's scheduler can reuse it.

## Porting your existing ShellQuest levels

Your current ShellQuest content is the seed for `content/shellquest/`. For each level, create one `shell-challenge` file: write the prompt, pick the `checks` that verify it (a flag hash is usually simplest), set XP, and wire `prerequisites` so the levels chain in order. Aim to get the first 3–5 levels in; the rest can trickle in anytime — that's just data.

## Acceptance criteria (v0.2 done when all true)

- [ ] A `shell-challenge` appears on the dashboard alongside Python katas.
- [ ] Completing a shell challenge (correct flag/artifact) runs the same on-pass pipeline: XP up, streak/level update, devlog draft, git commit.
- [ ] Wrong flag/artifact fails cleanly and tells the user what didn't check out.
- [ ] Flags/outputs are stored as SHA-256, never plaintext, in content files.
- [ ] An exercise with an unmet prerequisite is visibly locked and cannot be opened.
- [ ] Completing the prerequisite unlocks it without a restart (or on next dashboard load).
- [ ] `isUnlocked()` is a single reusable pure function.
- [ ] At least 3 real ShellQuest levels are ported and chained by prerequisites.

When these pass, use it for a bit, then come back for v0.3 (the scheduler — where dailies, weeklies, and spaced repetition turn this from a course into a habit).
