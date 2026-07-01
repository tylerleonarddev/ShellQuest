# ShellQuest

A git-backed learning platform. One repository is simultaneously the save
file, the curriculum, the backup, the public journal, and the résumé
evidence. Progress is flat files; the commit history is the streak record.

## Run it

```bash
npm install
npm start
```

First launch opens a one-step onboarding that teaches the loop, then the
ladder starts at absolute zero — lesson cards explain each concept before
the katas that use it, and a glossary (`? glossary`, top right) defines
every term. Moving machines? See [`docs/MIGRATION.md`](docs/MIGRATION.md).

**Launching day to day:** `sq` from any terminal, or the ShellQuest entry
in your app grid (both are thin wrappers around `npm start` run from this
repo — the app deliberately lives *with* its data; see ARCHITECTURE.md §2).

**Maintenance scripts:** `npm run publish <draft>` (move a devlog draft to
published + commit) · `npm run digest` (draft the weekly summary) ·
`npm run build-stats` (regenerate the stats page) · `npm run lint-content`
(check content for leaked flags / bad hashes / dangerous commands).

## How it works

- `content/` — the curriculum. Every exercise is one declarative JSON file.
- `progress/` — durable facts about *me* (XP, streak, completions). Synced.
- `devlogs/` — learning-in-public. Drafts are auto-scaffolded on each pass
  (private until edited); published posts live in `devlogs/published/`.
- `app/` — the Electron engine. Rarely changes; everything valuable lives
  in the data directories above.

Passing an exercise runs the on-pass sequence: progress files update, a
devlog draft is scaffolded, and a git commit records the completion.

Full design rationale in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md);
the v0.1 scope in [`docs/BUILD-SPEC-v0.1.md`](docs/BUILD-SPEC-v0.1.md);
parked ideas in [`docs/BACKLOG.md`](docs/BACKLOG.md).
