'use strict';
// Reference solutions for every python kata — the regression net. Each is
// a KNOWN-CORRECT solution; the test suite runs them through the real
// runner and asserts they pass, so a bad edit to a test case is caught
// immediately. (This is the discipline that would have caught the
// count_vowels('SIGINT') bug on day one.)
module.exports = {
  // Tier 0
  'py-say-hello': 'def say_hello():\n    return "Hello, world!"\n',
  'py-greet': 'def greet(name):\n    return "Hello, " + name + "!"\n',
  'py-add': 'def add(a, b):\n    return a + b\n',
  'py-double': 'def double(n):\n    return n * 2\n',
  'py-square': 'def square(n):\n    return n * n\n',
  'py-is-even': 'def is_even(n):\n    return n % 2 == 0\n',
  'py-last-char': 'def last_char(s):\n    return s[-1]\n',
  'py-shout': 'def shout(s):\n    return s.upper()\n',
  'py-bigger': 'def bigger(a, b):\n    return a if a > b else b\n',
  'py-absolute': 'def absolute_value(n):\n    return n if n >= 0 else -n\n',
  // Tier 1 gap (loops, lists, comparisons)
  'py-in-range': 'def in_range(n, lo, hi):\n    return lo <= n <= hi\n',
  'py-either-true': 'def either_true(a, b):\n    return a or b\n',
  'py-sum-to': 'def sum_to(n):\n    total = 0\n    for i in range(1, n + 1):\n        total += i\n    return total\n',
  'py-count-evens': 'def count_evens(nums):\n    c = 0\n    for x in nums:\n        if x % 2 == 0:\n            c += 1\n    return c\n',
  'py-first-and-last': 'def first_and_last(lst):\n    return [lst[0], lst[-1]]\n',
  'py-append-item': 'def append_item(lst, x):\n    lst.append(x)\n    return lst\n',
  // Tier 1
  'py-reverse-string': 'def reverse_string(s):\n    out = ""\n    for ch in s:\n        out = ch + out\n    return out\n',
  'py-max-of-list': 'def max_of_list(nums):\n    m = nums[0]\n    for n in nums:\n        if n > m:\n            m = n\n    return m\n',
  'py-is-palindrome': 'def is_palindrome(s):\n    t = "".join(c.lower() for c in s if c.isalnum())\n    return t == t[::-1]\n',
  'py-factorial-iter': 'def factorial_iter(n):\n    r = 1\n    for i in range(2, n + 1):\n        r *= i\n    return r\n',
  'py-count-vowels': "def count_vowels(s):\n    return sum(1 for c in s.lower() if c in 'aeiou')\n",
  'py-sum-even': 'def sum_even(numbers):\n    return sum(n for n in numbers if n % 2 == 0)\n',
  'py-fizzbuzz': "def fizzbuzz(n):\n    out = []\n    for i in range(1, n + 1):\n        s = ('Fizz' if i % 3 == 0 else '') + ('Buzz' if i % 5 == 0 else '')\n        out.append(s or i)\n    return out\n",
  // Tier 2
  'py-word-count': 'def word_count(s):\n    d = {}\n    for w in s.split():\n        d[w] = d.get(w, 0) + 1\n    return d\n',
  'py-two-sum': 'def two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        if target - n in seen:\n            return [seen[target - n], i]\n        seen[n] = i\n',
  'py-fibonacci': 'def fibonacci(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n',
  'py-flatten': 'def flatten(lst):\n    out = []\n    for x in lst:\n        if isinstance(x, list):\n            out.extend(flatten(x))\n        else:\n            out.append(x)\n    return out\n',
  'py-is-anagram': 'def is_anagram(a, b):\n    return sorted(a.lower().replace(" ", "")) == sorted(b.lower().replace(" ", ""))\n',
  // Tier 3
  'py-factorial-rec': 'def factorial_rec(n):\n    return 1 if n <= 1 else n * factorial_rec(n - 1)\n',
  'py-sum-digits': 'def sum_digits(n):\n    return n if n < 10 else n % 10 + sum_digits(n // 10)\n',
  'py-power': 'def power(base, exp):\n    return 1 if exp == 0 else base * power(base, exp - 1)\n',
  'py-binary-search': 'def binary_search(nums, target):\n    lo, hi = 0, len(nums) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if nums[mid] == target:\n            return mid\n        if nums[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\n',
  // Tier 4
  'py-is-prime': 'def is_prime(n):\n    if n < 2:\n        return False\n    i = 2\n    while i * i <= n:\n        if n % i == 0:\n            return False\n        i += 1\n    return True\n',
  'py-gcd': 'def gcd(a, b):\n    while b:\n        a, b = b, a % b\n    return a\n',
  'py-bubble-sort': 'def bubble_sort(nums):\n    nums = list(nums)\n    for i in range(len(nums)):\n        for j in range(len(nums) - 1 - i):\n            if nums[j] > nums[j + 1]:\n                nums[j], nums[j + 1] = nums[j + 1], nums[j]\n    return nums\n',
  'py-merge': 'def merge(a, b):\n    out, i, j = [], 0, 0\n    while i < len(a) and j < len(b):\n        if a[i] <= b[j]:\n            out.append(a[i]); i += 1\n        else:\n            out.append(b[j]); j += 1\n    return out + a[i:] + b[j:]\n',
  // Data structures (python-script)
  'py-stack': 'class Stack:\n    def __init__(self):\n        self.items = []\n    def push(self, x):\n        self.items.append(x)\n    def pop(self):\n        return self.items.pop()\n    def peek(self):\n        return self.items[-1]\n    def is_empty(self):\n        return len(self.items) == 0\n    def __len__(self):\n        return len(self.items)\n',
  'py-balanced-parens': "def is_balanced(s):\n    pairs = {')': '(', ']': '[', '}': '{'}\n    stack = []\n    for ch in s:\n        if ch in '([{':\n            stack.append(ch)\n        elif ch in pairs:\n            if not stack or stack.pop() != pairs[ch]:\n                return False\n    return not stack\n",
  'py-queue': 'class Queue:\n    def __init__(self):\n        self.items = []\n    def enqueue(self, x):\n        self.items.append(x)\n    def dequeue(self):\n        return self.items.pop(0)\n    def peek(self):\n        return self.items[0]\n    def is_empty(self):\n        return len(self.items) == 0\n    def __len__(self):\n        return len(self.items)\n',
  'py-linked-list': 'class Node:\n    def __init__(self, value):\n        self.value = value\n        self.next = None\n\nclass LinkedList:\n    def __init__(self):\n        self.head = None\n    def append(self, x):\n        node = Node(x)\n        if not self.head:\n            self.head = node\n            return\n        cur = self.head\n        while cur.next:\n            cur = cur.next\n        cur.next = node\n    def to_list(self):\n        out, cur = [], self.head\n        while cur:\n            out.append(cur.value)\n            cur = cur.next\n        return out\n    def reverse(self):\n        prev, cur = None, self.head\n        while cur:\n            nxt = cur.next\n            cur.next = prev\n            prev, cur = cur, nxt\n        self.head = prev\n',
  'py-bst': 'class _N:\n    def __init__(self, v):\n        self.v, self.l, self.r = v, None, None\n\nclass BST:\n    def __init__(self):\n        self.root = None\n    def insert(self, x):\n        if not self.root:\n            self.root = _N(x)\n            return\n        cur = self.root\n        while True:\n            if x == cur.v:\n                return\n            side = "l" if x < cur.v else "r"\n            nxt = getattr(cur, side)\n            if not nxt:\n                setattr(cur, side, _N(x))\n                return\n            cur = nxt\n    def contains(self, x):\n        cur = self.root\n        while cur:\n            if x == cur.v:\n                return True\n            cur = cur.l if x < cur.v else cur.r\n        return False\n',
  // Tier 2 (variables, dictionaries, errors)
  'py-char-count': 'def char_count(s):\n    counts = {}\n    for c in s:\n        counts[c] = counts.get(c, 0) + 1\n    return counts\n',
  'py-word-lengths': 'def word_lengths(words):\n    return {w: len(w) for w in words}\n',
  'py-safe-divide': 'def safe_divide(a, b):\n    try:\n        return a / b\n    except ZeroDivisionError:\n        return None\n',
  'py-safe-first': 'def safe_first(lst):\n    try:\n        return lst[0]\n    except IndexError:\n        return None\n',
  // Security track (defensive/analytical)
  'py-hash-type': "def hash_type(h):\n    return {32: 'MD5', 40: 'SHA-1', 64: 'SHA-256'}.get(len(h), 'unknown')\n",
  'py-defang-url': "def defang_url(url):\n    return url.replace('http', 'hxxp').replace('.', '[.]')\n",
  'py-password-strength': "def password_strength(pw):\n    s = 0\n    if len(pw) >= 8:\n        s += 1\n    if any(c.islower() for c in pw):\n        s += 1\n    if any(c.isupper() for c in pw):\n        s += 1\n    if any(c.isdigit() for c in pw):\n        s += 1\n    return s\n",
  'py-is-private-ip': "def is_private_ip(ip):\n    a, b = (int(x) for x in ip.split('.')[:2])\n    if a == 10:\n        return True\n    if a == 172 and 16 <= b <= 31:\n        return True\n    if a == 192 and b == 168:\n        return True\n    return False\n",
  'py-extract-ips': "def extract_ips(text):\n    out = []\n    for tok in text.split():\n        parts = tok.split('.')\n        if len(parts) == 4 and all(p.isdigit() and 0 <= int(p) <= 255 for p in parts):\n            out.append(tok)\n    return out\n",
  'py-count-failed-logins': "def count_failed_logins(lines):\n    return sum(1 for l in lines if 'Failed password' in l)\n",
  'py-detect-bruteforce': "def detect_bruteforce(lines, threshold):\n    counts = {}\n    for l in lines:\n        ip = l.split(' from ')[1].split(' ')[0]\n        counts[ip] = counts.get(ip, 0) + 1\n    return sorted(ip for ip, c in counts.items() if c > threshold)\n",
  // Curriculum gaps (classes, sets, f-strings) + practice reps
  'py-counter': 'class Counter:\n    def __init__(self):\n        self.n = 0\n    def increment(self):\n        self.n += 1\n    def value(self):\n        return self.n\n    def reset(self):\n        self.n = 0\n',
  'py-dedupe': 'def dedupe(lst):\n    return sorted(set(lst))\n',
  'py-common': 'def common(a, b):\n    return sorted(set(a) & set(b))\n',
  'py-label': "def label(name, count):\n    return f'{name}: {count}'\n",
  'py-product-of': 'def product_of(nums):\n    p = 1\n    for n in nums:\n        p *= n\n    return p\n',
  'py-count-matching': 'def count_matching(lst, target):\n    return sum(1 for x in lst if x == target)\n',
  'py-invert-dict': 'def invert_dict(d):\n    return {v: k for k, v in d.items()}\n',
  'py-clamp': 'def clamp(n, lo, hi):\n    if n < lo:\n        return lo\n    if n > hi:\n        return hi\n    return n\n',
  'py-average': 'def average(nums):\n    if not nums:\n        return 0\n    return sum(nums) / len(nums)\n',
  // Log-analyzer project build steps
  'proj-parse-line': "def parse_line(line):\n    parts = line.split(' ', 3)\n    return {'timestamp': parts[0] + ' ' + parts[1], 'level': parts[2], 'message': parts[3]}\n",
  'proj-count-by-level': "def count_by_level(entries):\n    counts = {}\n    for e in entries:\n        counts[e['level']] = counts.get(e['level'], 0) + 1\n    return counts\n",
  'proj-filter-by-level': "def filter_by_level(entries, level):\n    return [e for e in entries if e['level'] == level]\n",
  'proj-error-messages': "def error_messages(entries):\n    return [e['message'] for e in entries if e['level'] == 'ERROR']\n",
  'proj-summarize': "def summarize(entries):\n    counts = {}\n    for e in entries:\n        counts[e['level']] = counts.get(e['level'], 0) + 1\n    return {'total': len(entries), 'by_level': counts, 'first': entries[0]['timestamp'] if entries else None, 'last': entries[-1]['timestamp'] if entries else None}\n",
};
