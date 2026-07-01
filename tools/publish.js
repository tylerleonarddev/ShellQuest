#!/usr/bin/env node
'use strict';
// CLI publish: npm run publish <draft-file.md>  (or a unique fragment)
const path = require('path');
const { listDrafts, publishDraft } = require(path.resolve(__dirname, '../app/lib/publish'));

const arg = process.argv[2];
if (!arg) {
  const drafts = listDrafts();
  console.log(drafts.length ? 'Drafts:' : 'No drafts.');
  for (const d of drafts) console.log(`  ${d.file}  — ${d.title}`);
  console.log('\nusage: npm run publish <draft-file.md>');
  process.exit(drafts.length ? 1 : 0);
}

const matches = listDrafts().filter((d) => d.file.includes(arg));
if (matches.length !== 1) {
  console.error(matches.length ? `Ambiguous: ${matches.map((m) => m.file).join(', ')}` : `No draft matching "${arg}"`);
  process.exit(1);
}

publishDraft(matches[0].file).then((res) => {
  if (!res.published) {
    console.error(res.error);
    process.exit(1);
  }
  const pushMsg = res.push.pushed
    ? 'pushed ✓ it is public'
    : `push failed — ${res.push.reason} (committed locally; retry with git push)`;
  console.log(`published: ${res.file} · ${res.commit.committed ? 'committed' : `commit failed: ${res.commit.error}`} · ${pushMsg}`);
});
