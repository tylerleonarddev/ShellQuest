'use strict';
const fs = require('fs');
const path = require('path');
const { DRAFTS_DIR } = require('./paths');
const { localDateString } = require('./progress');

// Scaffold a ~70%-pre-filled devlog draft. Drafts are gitignored; only
// posts moved to devlogs/published/ go public.
function scaffoldDraft(exercise, userCode, results, xpAwarded) {
  fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  const date = localDateString();
  const file = path.join(DRAFTS_DIR, `${date}-${exercise.id}.md`);

  const testLines = results
    .map((r) => `- \`${r.call}\` → \`${JSON.stringify(r.expected)}\` ✓`)
    .join('\n');

  const body = `# ${exercise.title}

*${date} · +${xpAwarded} XP · \`${exercise.id}\`*

## The problem

${exercise.prompt}

## My solution

\`\`\`python
${userCode.trimEnd()}
\`\`\`

## Verified against

${testLines}

## Reflection

<!-- One honest paragraph: what tripped you up, or what clicked? -->

`;
  fs.writeFileSync(file, body);
  return file;
}

module.exports = { scaffoldDraft };
