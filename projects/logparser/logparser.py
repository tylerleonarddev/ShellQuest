#!/usr/bin/env python3
"""logparser — built step by step in ShellQuest.

Each function below is filled in automatically as you complete its build step.
Once every step is done, run it:
    python logparser.py fixtures/sample.log
"""
import sys

# === ShellQuest writes your completed, verified solutions between these markers. ===
# --- BEGIN parse_line ---
def parse_line(line):
    raise NotImplementedError("Complete the 'Parse one log line' step in ShellQuest.")
# --- END parse_line ---

# --- BEGIN count_by_level ---
def count_by_level(entries):
    raise NotImplementedError("Complete the 'Count events by level' step.")
# --- END count_by_level ---

# --- BEGIN filter_by_level ---
def filter_by_level(entries, level):
    raise NotImplementedError("Complete the 'Filter by level' step.")
# --- END filter_by_level ---

# --- BEGIN error_messages ---
def error_messages(entries):
    raise NotImplementedError("Complete the 'Pull out the error messages' step.")
# --- END error_messages ---

# --- BEGIN summarize ---
def summarize(entries):
    raise NotImplementedError("Complete the 'Summarize the whole log' step.")
# --- END summarize ---

def main():
    if len(sys.argv) < 2:
        print("usage: python logparser.py <logfile>"); sys.exit(1)
    try:
        with open(sys.argv[1]) as f:
            lines = [ln.strip() for ln in f if ln.strip()]
        entries = [parse_line(ln) for ln in lines]
        s = summarize(entries)
        print(f"Total lines: {s['total']}")
        for lvl, c in sorted(s['by_level'].items()):
            print(f"  {lvl}: {c}")
        errs = error_messages(entries)
        if errs:
            print("Errors:")
            for m in errs:
                print(f"  - {m}")
    except NotImplementedError as e:
        print("This tool isn't finished yet:", e); sys.exit(1)

if __name__ == "__main__":
    main()
