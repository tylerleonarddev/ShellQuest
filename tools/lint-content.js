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

const files = walk(CONTENT).filter((f) => path.basename(f) !== 'glossary.json');

// The glossary is its own shape: an array of {term, definition}.
const glossaryFile = path.join(CONTENT, 'glossary.json');
if (fs.existsSync(glossaryFile)) {
  try {
    const g = JSON.parse(fs.readFileSync(glossaryFile, 'utf8'));
    if (!Array.isArray(g) || g.some((e) => !e.term || !e.definition)) {
      errors.push('content/glossary.json: must be an array of {term, definition}');
    }
  } catch (e) {
    errors.push(`content/glossary.json: invalid JSON — ${e.message}`);
  }
}

const ids = new Map(); // id -> file
const allPrereqs = []; // [file, id, prereq]
const scaffoldChecks = []; // [contentFile, projectFile, function]

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

  // 2. Schema sanity (lessons are read-cards: body/completion, no verification)
  const required = ex.type === 'lesson' ? ['id', 'type', 'body', 'completion'] : REQUIRED;
  for (const f of required) {
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
  if (ex.type === 'python-kata' && v.runner !== 'project-run' && !tests.length) {
    errors.push(`${rel}: python-kata with no tests`);
  }
  if (v.runner === 'project-run') {
    if (!v.command) errors.push(`${rel}: project-run with no command`);
    if (!(v.expect_contains || []).length) errors.push(`${rel}: project-run with no expect_contains`);
    for (const re of DANGEROUS) {
      if (v.command && re.test(v.command)) errors.push(`${rel}: dangerous command matches ${re}: "${v.command}"`);
    }
  }
  if (ex.type === 'shell-challenge' && !checks.length) errors.push(`${rel}: shell-challenge with no checks`);

  // Project blocks: shape + isolation + collect scaffold files for the
  // stubs-only rule below.
  if (ex.project) {
    const p = ex.project;
    if (!p.name || !p.file) errors.push(`${rel}: project block missing name/file`);
    else {
      const relToProject = path.relative(path.join(ROOT, 'projects', p.name), path.resolve(ROOT, p.file));
      if (relToProject.startsWith('..') || path.isAbsolute(relToProject)) {
        errors.push(`${rel}: project.file "${p.file}" escapes projects/${p.name}/`);
      } else if (p.function) {
        scaffoldChecks.push([rel, p.file, p.function]);
      }
    }
  }

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

// 5. Prerequisites resolve, and the graph is a valid DAG (no cycles —
// a cycle would make part of the ladder permanently unreachable)
const prereqsOf = {};
for (const [rel, id, p] of allPrereqs) {
  if (!ids.has(p)) errors.push(`${rel}: ${id} requires unknown exercise "${p}"`);
  (prereqsOf[id] = prereqsOf[id] || []).push(p);
}
{
  const state = {}; // 1 = visiting, 2 = done
  const visit = (id, trail) => {
    if (state[id] === 2) return;
    if (state[id] === 1) {
      errors.push(`prerequisite cycle: ${[...trail, id].join(' -> ')}`);
      return;
    }
    state[id] = 1;
    for (const p of prereqsOf[id] || []) visit(p, [...trail, id]);
    state[id] = 2;
  };
  for (const id of ids.keys()) visit(id, []);
}

// 6. Exactly one ladder entry point per content directory — a second
// empty-prerequisite item is a "floating" exercise that can be served to
// a beginner out of order. (Onboarding is the app's own gate; exempt.)
const rootsByDir = {};
for (const file of files) {
  let ex;
  try { ex = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
  if (ex.track === 'onboarding') continue;
  if ((ex.prerequisites || []).length === 0) {
    const dir = path.relative(CONTENT, path.dirname(file)) || '.';
    (rootsByDir[dir] = rootsByDir[dir] || []).push(ex.id);
  }
}
for (const [dir, roots] of Object.entries(rootsByDir)) {
  if (roots.length > 1) {
    errors.push(`content/${dir}: ${roots.length} items have no prerequisites (${roots.join(', ')}) — only one entry point allowed; the rest are floating`);
  }
}

// 7. Scaffold stubs-only: the COMMITTED version of any project file a
// build step assembles into must contain a stub (NotImplementedError)
// between its markers — a public repo must never ship the answers.
// Checks HEAD (falling back to the working tree for not-yet-committed
// files) so the learner's local assembled work doesn't trip local runs.
const { execSync } = require('child_process');
for (const [contentFile, projectFile, fn] of scaffoldChecks) {
  let source;
  try {
    source = execSync(`git show HEAD:${JSON.stringify(projectFile)}`, { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] }).toString();
  } catch {
    try {
      source = fs.readFileSync(path.resolve(ROOT, projectFile), 'utf8');
    } catch {
      errors.push(`${contentFile}: project file ${projectFile} does not exist`);
      continue;
    }
  }
  const m = source.match(new RegExp(`# --- BEGIN ${fn} ---\\n([\\s\\S]*?)# --- END ${fn} ---`));
  if (!m) {
    errors.push(`${projectFile}: markers for ${fn} missing (referenced by ${contentFile})`);
  } else if (!m[1].includes('NotImplementedError')) {
    errors.push(`${projectFile}: committed scaffold for ${fn} contains a solution, not a stub — answers must never ship in the public repo`);
  }
}

for (const w of warnings) console.log(`⚠ ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n${errors.length} error(s) across ${files.length} content files.`);
  process.exit(1);
}
console.log(`✓ ${files.length} content files clean (${warnings.length} naming warnings)`);
