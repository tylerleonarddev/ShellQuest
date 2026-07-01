# ShellQuest — Python Curriculum, Block 1

17 katas, 63 validated test cases, **480 XP** total. Every test case has been checked against a reference solution — the expected values are known-correct, not guessed. All files are in the v0.1 `python-kata` format and drop straight into `content/python/`.

The ladder chains by `prerequisites`, so once v0.2's gating is on, they unlock in order — each tier assumes the last. It starts near where boot.dev has you and climbs toward the algorithmic thinking a CS program assumes on day one.

## Tier 1 — Fundamentals (strings, loops, control flow)
| Kata | XP | Teaches |
|---|---|---|
| Reverse a string | 20 | string indexing |
| Max without max() | 20 | accumulator pattern, no crutches |
| Palindrome check | 20 | normalize-then-compare |
| Factorial (iterative) | 20 | building up a result in a loop |

## Tier 2 — Collections & logic (dicts, the hash-map insight)
| Kata | XP | Teaches |
|---|---|---|
| Word frequency | 25 | `dict.get`, counting |
| Two Sum | 30 | the hash-map trick — turns O(n²) into O(n) |
| Fibonacci (iterative) | 25 | state you carry forward |
| Flatten a nested list | 25 | nested iteration |
| Anagram check | 25 | canonical form comparison |

## Tier 3 — Recursion (a function that calls itself)
| Kata | XP | Teaches |
|---|---|---|
| Factorial (recursive) | 30 | base case + recursive case |
| Sum of digits (recursive) | 30 | shrinking the problem |
| Power (recursive) | 30 | recursion on a counter |
| Binary search | 35 | your first O(log n) — halving the search space |

## Tier 4 — Algorithms & CS fundamentals
| Kata | XP | Teaches |
|---|---|---|
| Prime check | 30 | the sqrt(n) optimization |
| GCD (Euclid) | 35 | a 2000-year-old algorithm you'll meet again |
| Bubble sort | 40 | feel O(n²) in your hands |
| Merge two sorted lists | 40 | the merge step of merge sort (sets up O(n log n)) |

## The arc, on purpose
The last three tiers are laid out so the *ideas* connect, not just the syntax. Two Sum plants the hash-map insight; binary search introduces "halve the problem"; bubble sort lets you feel why quadratic is painful; merge sets up the sorted-merge that merge sort is built on. When your CS courses hit sorting and complexity, you'll have already felt these in your fingers — which is the whole point of getting a head start.

## What's deliberately not here yet
Class-based exercises (implement a Stack, a Queue, a linked list) are held back because the v0.1 test runner evaluates single expressions and can't drive a multi-step object yet. When you extend the runner to accept a short test *script* (a v-next tweak), those unlock a whole Tier 5 on data structures. Parked in the backlog, not forgotten.
