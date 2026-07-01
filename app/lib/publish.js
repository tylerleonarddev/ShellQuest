'use strict';
const fs = require('fs');
const path = require('path');
const { DRAFTS_DIR } = require('./paths');
const { commitPaths, push } = require('./git');

const PUBLISHED_DIR = path.join(DRAFTS_DIR, '..', 'published');

// First markdown heading = the post's title.
function titleOf(file) {
  try {
    const m = fs.readFileSync(file, 'utf8').match(/^#\s+(.+)$/m);
    return m ? m[1] : path.basename(file, '.md');
  } catch {
    return path.basename(file, '.md');
  }
}

function listDrafts() {
  if (!fs.existsSync(DRAFTS_DIR)) return [];
  return fs
    .readdirSync(DRAFTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => ({ file: f, title: titleOf(path.join(DRAFTS_DIR, f)) }));
}

function listPublished() {
  if (!fs.existsSync(PUBLISHED_DIR)) return [];
  return fs
    .readdirSync(PUBLISHED_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .reverse()
    .map((f) => ({ file: f, title: titleOf(path.join(PUBLISHED_DIR, f)) }));
}

// The deliberate act: drafts are private (gitignored); moving one to
// published/ puts it into git history AND pushes it (v0.6) — one action,
// with the real outcome reported, never a silent failure.
async function publishDraft(filename) {
  const base = path.basename(filename); // no traversal
  const from = path.join(DRAFTS_DIR, base);
  if (!base.endsWith('.md') || !fs.existsSync(from)) {
    return { published: false, error: `No such draft: ${base}` };
  }
  fs.mkdirSync(PUBLISHED_DIR, { recursive: true });
  const to = path.join(PUBLISHED_DIR, base);
  if (fs.existsSync(to)) {
    return { published: false, error: `Already published: ${base}` };
  }
  fs.renameSync(from, to);
  const commit = await commitPaths(
    ['devlogs/published/' + base],
    `Publish devlog: ${titleOf(to)}`
  );
  const pushResult = commit.committed
    ? await push()
    : { pushed: false, reason: commit.error || 'commit failed' };
  return { published: true, file: base, commit, push: pushResult };
}

/* ── In-app reflection editing (v0.6) ── */

const REFLECTION_HEADING = /^## Reflection\s*$/m;

function draftPath(filename) {
  const base = path.basename(filename);
  const full = path.join(DRAFTS_DIR, base);
  return base.endsWith('.md') && fs.existsSync(full) ? full : null;
}

// Split a draft into everything-above-the-reflection and the reflection
// text itself (with the scaffold's placeholder comment stripped).
function readDraft(filename) {
  const full = draftPath(filename);
  if (!full) return { error: `No such draft: ${path.basename(filename)}` };
  const content = fs.readFileSync(full, 'utf8');
  const m = content.match(REFLECTION_HEADING);
  if (!m) return { file: path.basename(full), head: content, reflection: '' };
  const head = content.slice(0, m.index);
  const reflection = content
    .slice(m.index + m[0].length)
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  return { file: path.basename(full), head: head.trimEnd(), reflection };
}

function saveReflection(filename, text) {
  const full = draftPath(filename);
  if (!full) return { saved: false, error: `No such draft: ${path.basename(filename)}` };
  const draft = readDraft(filename);
  const reflection = text.trim()
    ? text.trim()
    : '<!-- One honest paragraph: what tripped you up, or what clicked? -->';
  fs.writeFileSync(full, `${draft.head}\n\n## Reflection\n\n${reflection}\n`);
  return { saved: true };
}

module.exports = {
  listDrafts,
  listPublished,
  publishDraft,
  readDraft,
  saveReflection,
  titleOf,
  PUBLISHED_DIR,
};
