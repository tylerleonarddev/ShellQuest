# Terminal Track Roadmap — beyond the classic 14

*Written at v1.4.0, when the classic campaign reached full strength (14
missions). This is the honest map of how far the terminal ladder can go
on the current engine, what small extensions buy, and what genuinely
waits for the v2.0 system-state engine.*

## Where we are

The classic arc is complete and teaches the survival kit in order:
navigate → read → create → organize → move/rename → delete → find →
grep → pipes → sort/redirect → permissions → wildcards → the boss
sweep. That's the "can work a Linux box without freezing" bar.

## The design constraint that shapes everything

The artifact-check engine verifies **outcomes, never keystrokes**. Four
check kinds: `flag` (dynamic, per-machine), `file-exists`,
`file-contains` (regex), `command-output` (bash, stdout hash). Setup is
pure data (dirs + files). The consequence:

> **Any skill whose success leaves a testable file, output, or
> discoverable secret is buildable today.** Any skill whose success is
> a running process, a network conversation, or *the way* the learner
> did it, is not.

That line decides the tiers below.

## Tier 2 — Terminal for Analysts (~10 missions, security track)

Vehicle 2 of `SCOPE-security-direction.md`, carried `track: "security"`
so it lands in the SECURITY ladder group, chained off `sq-14-boss`.
Buildable **today, zero engine changes**:

1. **Hidden in plain sight** — dotfiles; `ls -a` finds a planted
   `.secrets/` the plain `ls` misses. (flag)
2. **Triage the auth log** — realistic `auth.log`; count `Failed
   password` lines. (command-output)
3. **Top talker** — `grep | cut | sort | uniq -c | sort -n` to find the
   IP with the most failures; its count+IP is the answer. (command-output)
4. **Field surgeon** — `cut -d' ' -f N` / `awk '{print $N}'` to extract
   a column from structured log lines into a file. (command-output)
5. **The needle across files** — `grep -r` with `-l` (which FILE
   contains it), not just which line. (flag hidden by filename)
6. **Integrity check** — a `MANIFEST.sha256` of planted files; ONE file
   was tampered with; `sha256sum -c` names it; the tampered file holds
   the flag. (Hashes of static contents precomputed at authoring.)
7. **Case of the duplicate** — two near-identical configs; `diff` finds
   the one changed line. (command-output)
8. **Count what matters** — `wc` variants over a log corpus; answers
   assembled into a report file. (command-output)
9. **The biggest file** — `du -a | sort -n` / `find -size` to locate
   the one bloated file in a deep tree; it holds the flag. (flag)
10. **Boss: incident triage** — given a mini-incident's logs: count the
    failures, extract the attacker IPs, sort unique, report file +
    flag. Everything above in one sweep.

## Tier 3 — Daily-driver fluency (~6 missions, needs 4 small setup extensions)

Each blocked item needs one **data-only** setup extension (no scripts —
the content-is-data rule holds):

| Extension | Field | Unlocks |
|---|---|---|
| File mode | `{ "path": ..., "mode": "0777" }` | **find-by-permission** (the world-writable file among hundreds — a real hardening check) |
| Symlinks | `{ "link": "a", "target": "b" }` | **follow the trail** (symlink chains, `ls -l`/`readlink`) |
| Mtimes | `{ "path": ..., "mtime": "-3d" }` | **what changed last?** (`ls -t`, `find -newer` — the first question at any incident) |
| Binary/base64 | `{ "path": ..., "base64": ... }` | **the nested archive** (`tar -xzf`, archives inside archives, flag at the center) |

Each is ~5 lines in `lab.js materialize()` plus a linter rule. Worth
doing as one batch when Tier 3 gets built.

## What genuinely waits for the v2.0 system-state engine

Named honestly so nobody burns a weekend trying to fake these on the
current engine:

- **Processes** (`ps`, `kill`, jobs, signals) — needs a supervised
  runner that starts/stops lab processes and can assert on them.
- **Networking** (`curl`, ports, `ss`) — needs a lab-local server and
  teardown guarantees.
- **Services/systemd, cron** — same, plus root questions.
- **Verifying the HOW** ("did they actually use a pipe, or edit by
  hand?") — needs shell-session capture; philosophically different
  (we verify outcomes on purpose). Probably never.
- **Interactive tools** (`less`, `vim`, `top`) — no artifact to check.

This is exactly the "system-state verification" line item already in
`ROADMAP.md` for 2.0 — the terminal track is its first real customer.

## The count

| | missions | engine work | status |
|---|---|---|---|
| Classic campaign | 14 | — | shipped v1.4 |
| + Analyst tier | 24 | none | **shipped v1.5** (`sec-01`…`sec-10`) |
| + Fluency tier | 30 | mode/symlink/mtime/base64 | **shipped v1.5** (`sq-15`…`sq-20`, extensions in `lab.js` + linter + CI) |
| + v2.0 engine | 35+ | supervised runner | scoped in `ROADMAP.md` 2.0 |

Both tiers landed in one drop (v1.5.0): the analyst tier as the
terminal half of the SOC arc (SECURITY ladder group, chained off the
boss), the fluency tier as `sq-15`–`sq-20` on the terminal ladder. The
four setup extensions stayed data-only as designed. What remains above
is exactly the v2.0 list — now recorded in `ROADMAP.md` under
system-state verification.
