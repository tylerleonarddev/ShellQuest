# Changelog

The 0.1 → 1.0 story. Every version below shipped, was verified against
its build spec's acceptance criteria, and went live on this repo — most
of it in a single remarkable week.

## 1.0.0 — 2026-07-02 · The release

The declaration: ShellQuest is a real, stable, teaching, self-documenting
learning platform. A stranger can clone it, start at literal zero, and be
carried from `return "Hello, world!"` through data structures, the
terminal track, and a Project Track that ends in a tool they built.
Front-door README with real screenshots, this changelog, CONTRIBUTING,
ROADMAP, and the v1.0.0 tag.

## 0.9.2 — 2026-07-02 · Deep hardening

A 78-agent adversarially-verified audit (eight specialist sweeps, every
finding attacked by independent skeptics before acceptance) confirmed 46
findings; all were fixed. Headliners: atomic progress writes with
corrupt-file recovery from git (silent total progress loss was possible);
rest days (a fully-caught-up day no longer kills the streak); the
`count_vowels('SIGINT')` test that expected 1 — an unpassable kata that
had survived since the very first spec. The dashboard gained the ❯ prompt
line, THE RECORD contribution grid, the FSRS forecast table, and the
tomorrow handoff.

## 0.9.1 — 2026-07-01 · The ladder reads as the climb

Dashboard exercises grouped by track and ordered by prerequisite depth
(was: alphabetical chaos), with per-track progress and a NEXT UP marker.

## 0.9.0 — 2026-07-01 · Release hardening

Cold-start walkthrough against a real fresh clone (now the standing
regression checklist), migration verified for real, lint wired into CI,
prerequisite-cycle detection, glossary completeness sweep, graceful
failure states everywhere. Resolved the scaffold contradiction: the
curriculum repo commits only stubs; assembled work stays out of git;
finished tools graduate to their own repos.

## 0.8.0 — 2026-07-01 · Project Tracks

The assembly mechanic: passing a build step writes your verified solution
into a real tool under `projects/`, isolation-guarded so it can never
touch the app. The `project-run` capstone runner executes the assembled
tool. Shipped with the Log Analyzer track (lesson + 5 steps + capstone).

## 0.7.0 — 2026-07-01 · Data structures

The `python-script` runner: multi-step tests that build an object and
poke it. Stack, balanced brackets, Queue, linked list, BST — authored and
adversarially validated (every exercise must fail a plausible wrong
solution, a method that immediately caught a weak test set).

## 0.6.0 — 2026-07-01 · FSRS + frictionless devlogs

Replaced SM-2-lite with FSRS (`ts-fsrs`, 90% target retention) with
migration preserving due dates. Reflections editable in-app; publish
became publish-and-push with honest outcome reporting.

## 0.5.0 — 2026-07-01 · Teaching foundation + ship it

The unfailable onboarding, the `lesson` content type, beginner-friendly
failure translation, the searchable glossary, Tier 0 (10 katas + 6
interleaved lessons), the migration runbook, and the GitHub Pages
deploy pipeline for the stats page.

## 0.4.0 — 2026-07-01 · Learning in public

Devlog publish flow, self-writing weekly digest, the stats page
generator, and the content linter (flag leaks, dangerous commands,
schema). Also the day a `git reset --hard` ate an hour of work and
birthed the tree-cleanliness guard that has paid for itself repeatedly.

## 0.3.0 — 2026-07-01 · The scheduler

Spaced repetition, the daily queue, streaks redefined as consecutive
cleared days, weekly goals. The Today panel became the centerpiece.

## 0.2.0 — 2026-07-01 · The terminal track

Shell challenges verified by artifacts and flags — with dynamic
`{{FLAG}}` generation so the public repo never contains an answer — and
prerequisite gating turning the exercise list into a ladder.

## 0.1.0 — 2026-07-01 · The loop

Electron boots to a dashboard; a Python kata runs against hidden tests;
XP ticks up; a devlog draft scaffolds; a git commit records it. The bet
that one git repository could be the save file, curriculum, backup, and
résumé — placed.
