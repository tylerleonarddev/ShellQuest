# ShellQuest — Python Curriculum, Tier 0 (Absolute Beginner On-Ramp)

10 katas, 27 validated test cases, **135 XP**. This is the bottom of the ladder — genuine day-zero start. Each kata teaches exactly **one** new idea, and the prompt itself is the mini-lesson. They're meant to be quick wins: first XP, first streak, first "oh, I can do this."

## The concepts, in order
| # | Kata | The one new idea |
|---|---|---|
| 1 | Your first function | `return` — a function hands back a value |
| 2 | Give it an input | parameters + joining text with `+` |
| 3 | Add two numbers | arithmetic with two inputs |
| 4 | Double it | multiplication (`*`) |
| 5 | Square a number | reusing a value |
| 6 | Even or odd | the `%` remainder operator + returning `True`/`False` |
| 7 | Last letter | string indexing (`s[-1]`) |
| 8 | Make it loud | string methods (`s.upper()`) |
| 9 | Pick the bigger one | your first `if/else` decision |
| 10 | Strip the minus sign | a decision that transforms the input |

By the end you've met: functions, return values, parameters, arithmetic, booleans, the modulo operator, string indexing, string methods, and conditionals — which is exactly the toolkit the original Tier 1 assumed you already had.

## One-line wiring change
Tier 0 chains internally (kata 1 → 2 → … → 10). To make the original ladder unlock *after* Tier 0, open `content/python/kata-reverse-string.json` and change its prerequisites from `[]` to:

```json
"prerequisites": ["py-absolute"]
```

Now the whole thing is one continuous climb: day-zero basics → strings/loops/dicts → recursion → algorithms. Drop these 10 files into `content/python/` alongside the existing ones.

## A note for when you're using it
If a Tier 0 kata ever feels *too* easy — good. That means the basic is solid, and the spaced-repetition system (v0.3) will stop resurfacing it quickly. Easy early wins aren't wasted; they're how the streak and the confidence get built.
