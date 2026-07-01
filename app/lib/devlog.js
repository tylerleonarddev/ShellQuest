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

  // Kata results carry the test call; artifact results carry a check
  // description. Flags never land in a devlog — a published post must
  // not leak an answer.
  const verifiedLines = results
    .map((r) => `- \`${r.call || r.detail}\`${r.expected !== undefined ? ` → \`${JSON.stringify(r.expected)}\`` : ''} ✓`)
    .join('\n');

  const solutionSection = userCode
    ? `## My solution

\`\`\`python
${userCode.trimEnd()}
\`\`\`
`
    : `## How I did it

<!-- Which commands got you there? Retrace the trail while it's fresh. -->
`;

  const body = `# ${exercise.title}

*${date} · +${xpAwarded} XP · \`${exercise.id}\`*

## The problem

${exercise.prompt}

${solutionSection}
## Verified against

${verifiedLines}

## Reflection

<!-- One honest paragraph: what tripped you up, or what clicked? -->

`;
  fs.writeFileSync(file, body);
  return file;
}

module.exports = { scaffoldDraft };
