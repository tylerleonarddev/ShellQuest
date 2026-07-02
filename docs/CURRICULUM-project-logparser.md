# ShellQuest — Project Track #1: Log Analyzer

The first **Project Track**: fundamentals graduate into building one real, useful tool. 1 intro lesson + 5 verified build steps + 1 capstone = **270 XP**. Every build step was validated against a reference solution (10 test cases), and the assembled tool was run end-to-end against a sample log — it works.

## What the learner builds
A working `logparser.py` that reads a log file and reports totals, counts by severity, and the error messages — the everyday bread-and-butter of a security analyst.

## The steps (each writes one verified function into the real tool)
| Step | Function | XP |
|---|---|---|
| Parse one log line | `parse_line` | 35 |
| Count events by level | `count_by_level` | 35 |
| Filter by level | `filter_by_level` | 35 |
| Pull out the error messages | `error_messages` | 40 |
| Summarize the whole log | `summarize` | 45 |
| **Capstone: Run your log analyzer** | (runs the assembled tool) | 75 |

## How assembly works (the magic, safely)
Each build-step kata carries a `project` block (`{name, file, function}`). When you pass a step, the app writes your verified solution into `projects/logparser/logparser.py` **between the `# --- BEGIN <fn> --- / # --- END <fn> ---` markers.** The tool assembles itself out of parts you earned — in its own folder, isolated from the app, so a wrong answer can never break ShellQuest. The capstone runs the finished tool against `fixtures/sample.log` and passes when the output is correct.

## What's in this bundle
- `content/python/` — the lesson + 6 exercises (drop into your content dir).
- `projects/logparser/logparser.py` — the **scaffold** (stubs + markers; NO answers — safe for a public repo).
- `projects/logparser/fixtures/sample.log` — the sample log the capstone checks against.

## Answer safety
The scaffold ships with `NotImplementedError` stubs, never the solutions — so nothing in your public repo gives away the build steps. (Worth a linter rule: project scaffolds must not contain completed solutions.)
