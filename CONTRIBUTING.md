# Contributing

ShellQuest isn't taking outside contributions yet — the curriculum and
engine are still moving fast, and community content needs a proper threat
model first (exercises can declare shell commands; see
`docs/BACKLOG.md`).

If you're exploring the code anyway:

- `app/` is the engine (Electron main, renderer, libs). It changes rarely.
- `content/` is the curriculum — pure JSON, validated by
  `npm run lint-content` (which also runs in CI on every push).
- `progress/` is the save file. `projects/` are scaffolds the learner
  assembles — committed stubs only, never solutions.
- `docs/` holds the architecture, every build spec, the decision log, and
  the cold-start regression checklist.

Found a bug? An issue with a repro is genuinely welcome.
