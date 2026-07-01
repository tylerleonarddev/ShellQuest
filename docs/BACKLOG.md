# Backlog

Every out-of-scope idea gets parked here instead of built. See
`BUILD-SPEC-v0.1.md` for the scope rules and `ARCHITECTURE.md` for the roadmap.

## Scheduled for later versions (from the roadmap)

- ~~**v0.2** — artifact/flag challenges; prerequisite gating~~ *shipped;
  see `DECISIONS.md` for the setup/dynamic-flag design.*
- **v0.2 content trickle** — 5 of 14 classic missions ported
  (explore/make/tree/copy/find). Remaining: move, remove, find+size,
  grep, pipes, redirect, perms, glob, boss. Just data — port anytime.
- ~~**v0.3** — Scheduler: dailies, weeklies, spaced-repetition pool~~
  *shipped; see `DECISIONS.md` for the failure rule, bonuses, and
  depth-ordering.*
- **Streak freeze / skip token** — one earned "shield" day so a single
  miss doesn't erase a long streak (spec suggested backlogging this).
- **OS notifications / background reminder** — explicitly deferred by the
  v0.3 spec; scheduling stays in-app for now.
- **Tier 5: data structures (Stack/Queue/linked list)** — blocked on
  extending the python-test runner to accept a multi-step test *script*
  instead of single-expression calls (per CURRICULUM-python.md).
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
