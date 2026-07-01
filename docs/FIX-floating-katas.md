# Fix: two ungated katas jumping the ladder

**Symptom:** an intro lesson was followed by `count_vowels` (a much harder kata).

**Cause:** `count_vowels` and `sum_even` — leftover v0.1 seed katas — had `prerequisites: []`, so they were unlocked from the very start and could be served at any time. This is a data problem, not an app bug; the gating engine works fine.

**Fix:** the two files in `content/python/` here have proper prerequisites set. Drop them in (overwrite the existing two):

- `kata-sum-even.json`: `[]` → `["py-max-of-list"]` (it iterates a list with a condition, so it now follows max-of-list)
- `kata-count-vowels.json`: `[]` → `["py-is-palindrome"]` (it iterates a string and counts, so it now follows the palindrome kata)

`fizzbuzz` already chained behind `sum_even`, so it needed no change — once `sum_even` is gated, `fizzbuzz` is too.

**After dropping these in, the only thing unlocked at the start is `lesson-functions`** — exactly one clean entry point, and the whole ladder flows in order from there.

**Tip to avoid this class of bug going forward:** the content linter (v0.4/v0.5) can be extended with one rule — *"exactly one content item may have empty prerequisites"* — so any future floating kata is caught automatically instead of surfacing in front of a beginner.
