# ShellQuest — Architecture

*The design document. Read this before writing code. It explains **why** the system is shaped the way it is, so that four years and several rewrites from now the decisions still make sense.*

---

## 1. The bet

This is not a to-do app with XP. It is the substrate your public learning identity runs on from now until you're applying for cleared AI-security work. It has to survive:

- **Years of daily use** without becoming abandonware.
- **At least one machine migration** (your Ubuntu box may move).
- **Several rewrites of the frontend** without losing a single exercise or a day of progress history.
- **Growing difficulty** — what's hard today is trivial in a year, and the system must absorb that as data, not code changes.

Everything below is in service of those four survival requirements.

## 2. The one idea that makes it work

**One git repository is simultaneously your save file, your curriculum, your backup, your public journal, and your résumé evidence.**

Progress and content live as flat files (Markdown / JSON / YAML) in a git repo. That single decision buys you:

- **Backup** — it's already versioned and pushable to GitHub.
- **Migration** — a new machine is a `git clone`.
- **Public learning** — the repo is public; your commit graph fills in as you learn.
- **Portability** — even a total frontend rewrite keeps every exercise, because content isn't trapped in an app-specific database schema.
- **An honest activity log** — your commit history *is* your streak record. It can't be faked and it's already public.

If you remember nothing else from this doc: **content and progress are data in git, never logic in code.**

## 3. Two tracks, not one

The app looks like one thing but runs on two opposite mechanics. Designing for both from day one is the single most important structural decision.

| | **Progression track (the ladder)** | **Review track (the reps)** |
|---|---|---|
| Purpose | Learn new territory | Keep old skills from decaying |
| Logic | Gate new content behind mastery of prerequisites; never show again once passed | Resurface known material on a spaced schedule |
| Examples | ShellQuest levels, new Python concepts, CS fundamentals | Terminal fluency drills, previously-passed katas |
| Ships in | v0.1–0.2 | v0.3 |

They share a login, a profile, an XP total, and the same content format — but the scheduler treats them differently. Build one engine that understands both from the start and you never retrofit.

## 4. The three layers

**Content layer** — pure data. Every exercise, regardless of type, is a declarative definition: a prompt, a verification method, an XP value, prerequisites, and a `review_interval` flag if it belongs in the reps pool. No exercise logic lives in app code. This is what lets you add hundreds of exercises over four years without touching the engine, and what makes "it got too easy" a non-problem — harder content is just more files, and difficulty is a field.

**Verification layer** — how the app proves you actually did the thing. Mixed model (see §6).

**Progress / scheduling layer** — the game brain. Tracks XP and streaks, and decides *what to show you today*: some due reviews from the spaced-repetition pool plus the next unlocked rung of the ladder.

## 5. The distinction that prevents the migration nightmare

Verification will eventually include **system-state checks** ("is SSH actually hardened on this box"). That means "did I complete this" is partly a fact about a *specific machine*. If you don't separate two concepts cleanly, moving to a new box either wipes your progress or — worse — the app thinks your fresh machine has hardened SSH because a *completion* was recorded even though the *state* isn't real.

So the data model separates, on day one:

- **Curriculum progress** — *"I have demonstrated I know how to harden SSH."* A durable fact about **you**. Lives in git, syncs to every machine.
- **Machine state** — *"**this** host currently has SSH hardened."* A fact about **a host**. Re-checked fresh, per machine, never synced as truth.

Get this into the schema now and migration is `git clone` + re-run the state checks. Miss it and migration is a rewrite. This distinction is worth more than any framework choice.

## 6. Verification models

Difficulty and honesty both come from *how* completion is proven. Mixed by content type:

- **Test-runner** (programming) — you write a function; the app runs your code against hidden test cases and reports pass/fail. Real feedback, not quizzes. *Ships v0.1.*
- **Artifact / flag** (ShellQuest-style) — the challenge produces a verifiable output: a file at a path, a flag string, specific command output. The app checks for it. This is the OverTheWire/Bandit model you already know. *Ships v0.2.*
- **System-state** (Ubuntu / config, "build up my box") — the app runs a check against the live machine: is `PasswordAuthentication no` in sshd_config, is the service running, is the firewall rule present. Completing the curriculum literally means your box is built up. Needs elevated privileges and careful sandboxing. *Ships v2, on the box, after Fable — it benefits least from a strong chat model and most from careful local work.*
- **Recall prompt** (CS theory) — lightweight self-graded or short-answer resurface. *Ships with the review track, v0.3.*

## 7. Repo layout

```
shellquest/
├── app/                      # Electron application code (the engine — rarely changes)
│   ├── main/                 # Electron main process
│   ├── renderer/             # UI (dashboard, exercise view)
│   └── lib/                  # verification runners, scheduler, git helpers
├── content/                  # THE CURRICULUM — pure data, grows forever
│   ├── python/
│   │   └── kata-sum-even.json
│   ├── shellquest/
│   └── cs/
├── progress/                 # CURRICULUM PROGRESS — durable facts about YOU (synced)
│   ├── profile.json          # XP total, streak, level
│   └── completions.json      # which exercises you've passed, when
├── machine-state/            # per-host facts (NOT synced as truth; re-checked)
│   └── <hostname>.json
├── devlogs/                  # learning-in-public output
│   ├── drafts/               # auto-scaffolded, awaiting your edit
│   └── published/
├── docs/                     # this file, the build specs, the migration runbook
└── README.md
```

Rule of thumb: `app/` is the engine and changes rarely. `content/` and `progress/` are the living data and change constantly. A frontend rewrite touches `app/` and leaves everything valuable untouched.

## 8. Content definition format

Every exercise is one declarative file. Example (`content/python/kata-sum-even.json`):

```json
{
  "id": "py-sum-even",
  "type": "python-kata",
  "track": "progression",
  "title": "Sum of even numbers",
  "xp": 20,
  "prerequisites": [],
  "review_interval_days": null,
  "prompt": "Write sum_even(numbers) that returns the sum of the even values in a list of integers.",
  "starter_code": "def sum_even(numbers):\n    pass\n",
  "verification": {
    "runner": "python-test",
    "tests": [
      { "call": "sum_even([1,2,3,4])", "expect": 6 },
      { "call": "sum_even([])", "expect": 0 },
      { "call": "sum_even([2,4,6])", "expect": 12 }
    ]
  }
}
```

Adding content = adding files. `track` routes it to the ladder or the reps pool. `review_interval_days` (null = ladder-only) is how a passed exercise later enters spaced repetition. This format is stable across all versions; new `type` and `runner` values extend it without breaking old content.

## 9. Learning-in-public layer

Because progress is already flat files in git, learning-in-public falls out almost for free — the same source of truth becomes five outputs:

1. **Auto-scaffolded devlogs** — finishing a module generates a pre-filled Markdown draft in `devlogs/drafts/` (what you did, the code, the verification that passed, a reflection prompt). You edit and move it to `published/`. This kills the blank-editor problem, which is the thing that actually stops you.
2. **Weekly digest** — the scheduler knows everything you did this week, so it drafts a "this week I learned" summary on a cadence, no willpower required.
3. **GitHub contribution graph = your streak** — progress commits fill your graph at github.com/tylerleonarddev. Learning-in-public by default, and exactly the credible consistency signal a hiring reviewer wants.
4. **Public stats page** — the repo → GitHub Pages → a hosted page showing XP, streak, modules, languages, recent devlogs. Free, from the one source of truth. *Kept unlisted until v0.5 — polished before it's a headline.*
5. **Bloggable-snippet queue** — solutions + reflections you tag `interesting` become a standing queue of post seeds, so reps feed a content pipeline instead of blogging being a separate chore.

**Publicity policy:** repo is **public from commit one** (graph fills immediately, low-stakes exposure reps). Stats page stays **unlisted until v0.5**. No launch announcement required — the trail simply exists and can be pointed at whenever you want.

## 10. Migration runbook (the target experience)

On a new machine:

```
git clone <your-repo>
cd shellquest && npm install && npm start
```

Curriculum progress and XP history come across untouched (they're in `progress/`). The app detects a new hostname, creates a fresh `machine-state/<hostname>.json`, and re-runs system-state checks against the new box. Nothing about *you* is lost; only *this machine's* state is rebuilt from reality. Write this runbook into `docs/` at v0.5.

## 11. Version roadmap

| Version | Days | Delivers |
|---|---|---|
| **v0.1** | 1–2 | The loop: Electron boots, git-backed data, Python katas, test-runner, XP + streak, "today" dashboard. One complete cycle end to end. |
| **v0.2** | 2–3 | ShellQuest levels as artifact/flag challenges; prerequisite gating. |
| **v0.3** | 3–4 | The scheduler: dailies, weeklies, spaced-repetition pool, "what should I do today." |
| **v0.4** | 4–5 | Learning-in-public: devlog scaffolding, weekly digest, snippet queue. |
| **v0.5** | 5–6 | Seed real curriculum, polish, package the binary, write the migration runbook, ready the stats page. |
| **v2** | later, on-box | System-state verification. Built at leisure after Fable, with proper sandboxing. |

Fable (in chat) does the reasoning-heavy, non-flaggable work: architecture, curriculum design, content generation, code review. **Claude Code on the box does the implementation** — it's structurally suited to touching your real files, and it sidesteps the classifier entirely.

## 12. Stack decisions

- **Electron** — reuses your existing web skills, `cyber-quest.html` ports almost directly, Claude Code works fluently in it, and it's boring/stable enough to still run in 2028. (Tauri was the stretch pick; Rust would have eaten the sprint. Reconsider for a v-next rewrite if you want the smaller binary and by then know Rust.)
- **Git as datastore** — see §2. Flat files, no database server to maintain for four years.
- **SQLite** — optional, only if query performance ever demands it; if introduced, it's a *cache* derived from the flat files, never the source of truth.
- **Python test-runner** — matches your boot.dev track; real code feedback from day one.
- **Language order** — Python first (fluency/review track). C enters later as the concept track — it teaches what CS programs assume you already suffered through.
