# Cold-start walkthrough — the regression checklist

Run this before every release. It simulates a stranger: a fresh clone, a
reset-to-zero profile, and a climb through every mechanic. First executed
and passed 2026-07-01 (v0.9) via a scripted walkthrough against a real
clone with an isolated `$HOME`.

## Migration (run against the clone BEFORE resetting progress)

- [ ] `git clone` + `npm ci` + libs load — no missing dependencies.
- [ ] XP, level, streak, completions, and FSRS review cards all arrive
      exactly as they were (they live in `progress/`, in git).
- [ ] No machine-local state is inherited: `~/shellquest-lab` starts
      empty and rebuilds on first challenge open, with a FRESH dynamic
      flag (never synced as truth).
- [ ] Git identity is per-machine: set `git config user.name/email` per
      `MIGRATION.md` or auto-commits fail (softly, with the reason shown).

## Cold start (after resetting `progress/` to zero)

- [ ] First launch opens onboarding; its starter code passes **as
      shipped** — truly unfailable.
- [ ] First daily = the intro lesson + the guided terminal flag hunt
      (`lesson-functions`, `sq-01-explore`) — nothing a beginner can't do.
- [ ] Lesson completes on "Got it", unlocks its kata; kata pass fires
      XP → devlog draft → git commit; re-pass awards 0 XP.
- [ ] The passed kata returns as a **review** in the daily on its FSRS
      due date (~3 days out; not same-day).
- [ ] Publishing a draft whose name matches an already-published post
      refuses cleanly ("Already published: …") — public history is never
      overwritten. (Found by this walkthrough, kept as a check.)
- [ ] Publish with no reachable remote: commits locally, reports the
      real reason in plain words, offers retry — never silent.
- [ ] Project track: passing build steps assembles solutions into
      `projects/logparser/logparser.py` between the markers; git remains
      blind to the assembled work (`git ls-files -v` shows `S`, status is
      clean); the capstone passes only against the finished tool.
- [ ] Every locked exercise explains itself: unmet prerequisites resolve
      to real, displayed titles.

## How to run it

The scripted version lives in the session scratchpad history; the manual
version is: clone to a scratch dir, `npm ci`, verify the migration boxes,
then reset `progress/` and climb: onboarding → lesson → kata → fake the
date → review → publish (offline and colliding) → project track. Every
box above must check.
