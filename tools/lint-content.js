#!/usr/bin/env node
'use strict';
// Content linter: catches the mistakes that matter in a PUBLIC repo
// before they reach a commit. Exit 1 on any error; warnings don't fail.
//   npm run lint-content
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content');

// The exact placeholder is the only sanctioned flag-shaped string.
const FLAG_RE = /SQ\{[^}]*\}/g;
const SHA256_RE = /^[0-9a-f]{64}$/;
const DANGEROUS = [
  /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\b/, // rm -rf variants
  /\bmkfs\b/,
  /\bdd\s+if=/,
  /:\(\)\s*\{/,                                             // fork bomb
  /\b(curl|wget)\b[^|;]*\|\s*(ba)?sh\b/,                    // pipe-to-shell
  /(>|>>)\s*\/dev\/sd/,
];
const REQUIRED = ['id', 'type', 'verification'];
const KNOWN_CHECK_KINDS = new Set(['flag', 'file-exists', 'file-contains', 'command-output']);

const errors = [];
const warnings = [];

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (e.name.endsWith('.json')) out.push(full);
  }
  return out;
}

const files = walk(CONTENT);
const ids = new Map(); // id -> file
const allPrereqs = []; // [file, id, prereq]

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const raw = fs.readFileSync(file, 'utf8');

  // 1. Leaked flag — the big one. {{FLAG}} placeholders are fine; any
  // literal SQ{...} is an answer sitting in a public file.
  const flagHits = raw.match(FLAG_RE) || [];
  for (const hit of flagHits) {
    errors.push(`${rel}: literal flag value ${hit} — only the {{FLAG}} placeholder is allowed`);
  }

  let ex;
  try {
    ex = JSON.parse(raw);
  } catch (e) {
    errors.push(`${rel}: invalid JSON — ${e.message}`);
    continue;
  }

  // 2. Schema sanity
  for (const f of REQUIRED) {
    if (ex[f] === undefined) errors.push(`${rel}: missing required field "${f}"`);
  }
  if (ex.id) {
    if (ids.has(ex.id)) errors.push(`${rel}: duplicate id "${ex.id}" (also in ${ids.get(ex.id)})`);
    ids.set(ex.id, rel);
    // Convention check only: v0.1 seeded kata-*.json files with py-* ids.
    const base = path.basename(file, '.json');
    if (base !== ex.id && !ex.id.endsWith(base.replace(/^kata-/, ''))) {
      warnings.push(`${rel}: filename doesn't echo id "${ex.id}"`);
    }
  }
  for (const p of ex.prerequisites || []) allPrereqs.push([rel, ex.id, p]);

  const v = ex.verification || {};
  const checks = v.checks || [];
  const tests = v.tests || [];
  if (ex.type === 'python-kata' && !tests.length) errors.push(`${rel}: python-kata with no tests`);
  if (ex.type === 'shell-challenge' && !checks.length) errors.push(`${rel}: shell-challenge with no checks`);

  for (const c of checks) {
    if (!KNOWN_CHECK_KINDS.has(c.kind)) errors.push(`${rel}: unknown check kind "${c.kind}"`);
    // 3. Malformed hash — a plaintext answer hiding in the hash field
    if (c.expected_sha256 !== undefined && !SHA256_RE.test(c.expected_sha256)) {
      errors.push(`${rel}: expected_sha256 is not a 64-char hex hash (plaintext answer?)`);
    }
    // 4. Dangerous command
    if (c.command) {
      for (const re of DANGEROUS) {
        if (re.test(c.command)) errors.push(`${rel}: dangerous command matches ${re}: "${c.command}"`);
      }
    }
  }
}

// 5. Prerequisites resolve
for (const [rel, id, p] of allPrereqs) {
  if (!ids.has(p)) errors.push(`${rel}: ${id} requires unknown exercise "${p}"`);
}

for (const w of warnings) console.log(`⚠ ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n${errors.length} error(s) across ${files.length} content files.`);
  process.exit(1);
}
console.log(`✓ ${files.length} content files clean (${warnings.length} naming warnings)`);
