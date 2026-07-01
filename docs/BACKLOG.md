# Backlog

Every out-of-scope idea gets parked here instead of built. See
`BUILD-SPEC-v0.1.md` for the scope rules and `ARCHITECTURE.md` for the roadmap.

## Scheduled for later versions (from the roadmap)

- **v0.2** — ShellQuest artifact/flag challenges; prerequisite gating (the
  field is already read and stored, just not enforced).
- **v0.2** — Import the 14 missions from `~/shellquest-classic` as
  artifact/flag content. The classic game's `check.sh` model maps directly
  onto the artifact/flag verification runner.
- **v0.3** — Scheduler: dailies, weeklies, spaced-repetition pool.
- **v0.4** — Weekly digest, snippet queue.
- **v0.5** — Stats page, packaged binary, migration runbook.
- **v2** — System-state verification with proper sandboxing.

## Noted during the v0.1 build

- **Packaged binary needs a repo pointer.** The app resolves `content/` and
  `progress/` relative to its own source tree, which works when run from the
  repo (`npm start`) but not from a packaged binary. When v0.5 packaging
  lands, add a config/env pointer to the data repo.
- **Test-runner sandboxing.** The python-test runner executes your own code
  locally with only a 5s timeout. Do not generalize it to untrusted input;
  hardening belongs with the v2 sandboxing work.
- **Git identity.** Auto-commits use the machine's git identity. If a fresh
  machine has none configured, commits fail softly (the pass still counts,
  the UI keeps working). The migration runbook should include `git config`.
- **Auto-push on pass (or on a debounce).** The on-pass sequence commits
  locally but does not push, and the GitHub contribution graph — a core
  §9 goal — only fills on push. Until this is decided (v0.3 scheduler could
  own it), push manually every day or two: `git push`.
- **Re-practice UX.** Re-running a mastered kata awards 0 XP but still
  updates the streak. The v0.3 review track will replace this with real
  spaced-repetition scheduling.
