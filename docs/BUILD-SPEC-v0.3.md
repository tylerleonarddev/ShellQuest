# ShellQuest v0.3 — Build Spec (The Scheduler)

**Run after v0.2 passes its checks** (shell challenge runs the full pipeline, flags are hashed, gating works). This adds the game brain on top of the existing engine — reuse everything already built.

---

## Mission

**Turn a list of exercises into a daily habit with a memory.**

> The app decides what you should do *today* — a small queue mixing exercises due for review with the next rung of new content. Clearing the daily keeps your streak alive. Passed exercises resurface on a spaced schedule so skills don't decay. A weekly goal sits above the dailies.

This is the version that makes you *want* to open it tomorrow.

## Scope boundary

**BUILD (v0.3):**
- Spaced-repetition scheduling: every passed exercise gets a review schedule that expands as you keep getting it right.
- A **daily queue** generated each day: due reviews first, then the next unlocked new content, capped at N.
- **Streak** redefined as consecutive days the daily was cleared.
- A **weekly goal** with visible progress.
- Bonus XP for clearing the daily and the weekly.
- A **"Today"** panel as the dashboard centerpiece.

**DO NOT BUILD:**
- ❌ Devlog digest, snippet queue, stats page (v0.4)
- ❌ System-state verification (v2)
- ❌ New content types
- ❌ Background daemons / OS notifications — keep scheduling in-app for now (park in backlog)
- Stray ideas → `docs/BACKLOG.md`.

## Spaced repetition (SM-2-lite)

A **review** simply re-surfaces an exercise you've already passed; re-passing its existing tests counts as a successful review. No new content needed — this reuses the v0.1 runner.

Each passed exercise gets a schedule record with `interval_days`, `ease` (starts 2.3), and `next_review`:

- **First pass** (initial ladder completion): `interval_days = review_interval_days if set, else 1`; `next_review = today + interval`. *(The seed content has `review_interval_days: null`, so it defaults to 1 — existing files need no editing.)*
- **Review passed**: `interval_days = round(interval_days * ease)`; `ease = min(3.0, ease + 0.1)`; `next_review = today + interval_days`.
- **Review failed**: `interval_days = 1`; `ease = max(1.3, ease - 0.2)`; `next_review = tomorrow`.

Getting something right repeatedly pushes it far into the future (1 → 2 → 5 → 12 days…); getting it wrong pulls it back to daily until it sticks. That's the whole engine of durable retention.

## Daily queue generation

Generate once per day (regenerate when the stored date ≠ today; otherwise keep it stable so the day's target doesn't move):

1. `reviews_due` = scheduled exercises with `next_review <= today`, most-overdue first.
2. `new_rung` = the next 1–2 **unlocked, not-yet-completed** ladder exercises.
3. `daily` = up to **N = 5** items: fill with due reviews first, then new content to reach N.

The daily is **cleared** when every item in it has been passed today.

## Streak (redefined)

- `streak_days` = consecutive days the daily queue was cleared.
- Clear today's daily → if yesterday was also cleared, `streak_days += 1`, else `streak_days = 1`.
- A day passes with the daily uncleared → streak resets to 0.
- Keep N small (5) so the streak is achievable on a busy day. (A "freeze"/skip token is a nice later mechanic — backlog it.)

## Weekly goal

One or two simple counters reset each week (`week_start` = Monday):

- e.g. **"Clear the daily 5 of 7 days"** and/or **"Complete 3 new ladder exercises."**
- Show progress (3/5 days, 1/3 new). Award a **weekly bonus XP** on completion.

Keep the goal logic in data (a small `weekly.json` with the goal definition) so you can tune targets without code changes.

## New data files

`progress/reviews.json`
```json
{ "schedules": { "py-reverse-string": { "interval_days": 2, "ease": 2.4, "next_review": "2026-07-03", "last_result": "pass" } } }
```

`progress/daily.json` (regenerated when date changes)
```json
{ "date": "2026-07-01", "queue": ["py-two-sum","py-reverse-string"], "completed": ["py-reverse-string"] }
```

`progress/weekly.json`
```json
{ "week_start": "2026-06-29", "goals": [ {"kind":"clear_daily_days","target":5,"progress":3}, {"kind":"new_exercises","target":3,"progress":1} ], "bonus_awarded": false }
```

All still flat files in git — the scheduler's state travels with a `git clone` like everything else.

## Dashboard: the "Today" panel

Make **Today** the centerpiece — it's the first thing you see and the reason to come back:

- The day's queue with each item's state (done / to-do) and whether it's a **review** or **new**.
- A clear "daily cleared!" moment when the last item passes — this is the dopamine beat; make it land (one orchestrated reward, not scattered confetti).
- Streak flame with the current count, and weekly-goal progress bars.
- Below the fold: the full ladder for when you want extra reps beyond the daily.

## Acceptance criteria (v0.3 done when all true)

- [ ] Passing an exercise creates/updates its schedule in `reviews.json` (interval, ease, next_review).
- [ ] A previously-passed exercise reappears as a **review** in the daily once `next_review` is due.
- [ ] Passing a review expands its interval; failing one resets it to 1 day.
- [ ] The daily queue generates fresh each new day, capped at 5, reviews prioritized over new content.
- [ ] Clearing the daily increments the streak; missing a day resets it.
- [ ] The weekly goal shows progress and awards bonus XP on completion.
- [ ] The "Today" panel is the dashboard centerpiece with a satisfying daily-cleared moment.
- [ ] All new state is flat files under `progress/` — no database.
- [ ] Interval/streak math lives in small pure functions (easy to test and tune).

When these pass, you have a living system: something with a memory that asks for you daily. Use it for a few days for real before v0.4 (learning-in-public) — because by then you'll have a real streak worth showing.
