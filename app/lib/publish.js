'use strict';
const fs = require('fs');
const path = require('path');
const { DRAFTS_DIR } = require('./paths');
const { commitPaths } = require('./git');

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
// published/ is what puts it into git history — one step, one commit.
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
  return { published: true, file: base, commit };
}

module.exports = { listDrafts, listPublished, publishDraft, titleOf, PUBLISHED_DIR };
