# ShellQuest

A git-backed learning platform. One repository is simultaneously the save
file, the curriculum, the backup, the public journal, and the résumé
evidence. Progress is flat files; the commit history is the streak record.

## Run it

```bash
npm install
npm start
```

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
