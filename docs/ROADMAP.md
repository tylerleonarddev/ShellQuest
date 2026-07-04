# Roadmap — after 1.0

Recorded here, deliberately not built yet.

## 2.0 — system-state verification (the flagship)

Completing security/sysadmin modules verifies the *actual machine*
reached the target state: is `PasswordAuthentication no` set, is the
firewall rule present, is the service hardened. "Learning literally
builds your box." Needs elevated privileges and careful sandboxing —
its own major effort, done deliberately. (See ARCHITECTURE.md §6; the
progress-vs-machine-state split in the schema has been ready for this
since day one.)

**First confirmed customer: the terminal track's ceiling** (scoped in
`TERMINAL-ROADMAP.md` at v1.5, when the analyst + fluency tiers
shipped). The missions that genuinely cannot be built on the
artifact-check engine and wait here:

- **Processes** — `ps`, `kill`, jobs, signals: needs a supervised
  runner that starts/stops lab processes and asserts on them.
- **Networking** — `curl`, ports, `ss`: needs a lab-local server with
  teardown guarantees.
- **Services & scheduling** — systemd units, cron: same, plus the
  elevated-privilege questions above.
- **Interactive tools** (`less`, `vim`, `top`): no artifact to check;
  may never fit the outcome-verification philosophy.

## More project tracks

A recon report generator; a systemd service. Same pattern as the log
analyzer: fundamentals → verified build steps → capstone → the finished
tool graduates to its own repo.

## The C concept track

C as the "what CS programs assume you suffered through" track — pointers
and memory made concrete after the linked-list intuition from the
data-structures tier.

## Remaining classic missions

Nine missions from the original terminal game (move, remove, find+size,
grep, pipes, redirect, perms, glob, boss) still await porting as
shell-challenge content. Just data — they can trickle in any time.

## Community content

Only with the threat-modeling flagged in the backlog: content can declare
shell commands, so contributions are a security boundary, and the
linter's denylist is a start, not a defense.

## Smaller parked ideas

`docs/BACKLOG.md` is the living list (streak freeze tokens, project
graduation helper, FSRS parameter training once ~1k reviews exist,
Easy/Hard ratings from solve time, and more).
