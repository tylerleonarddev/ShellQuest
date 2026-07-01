'use strict';
const path = require('path');

// app/lib -> repo root. Everything (content, progress, devlogs) is resolved
// from here so the app works no matter where it's launched from.
const REPO_ROOT = path.resolve(__dirname, '..', '..');

module.exports = {
  REPO_ROOT,
  CONTENT_DIR: path.join(REPO_ROOT, 'content'),
  PROGRESS_DIR: path.join(REPO_ROOT, 'progress'),
  PROFILE_FILE: path.join(REPO_ROOT, 'progress', 'profile.json'),
  COMPLETIONS_FILE: path.join(REPO_ROOT, 'progress', 'completions.json'),
  DRAFTS_DIR: path.join(REPO_ROOT, 'devlogs', 'drafts'),
};
