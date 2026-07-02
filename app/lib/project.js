'use strict';
// Project Tracks (v0.8): passing a build step assembles the learner's
// verified solution into a real tool under projects/<name>/. The path
// isolation here is the safety guarantee — assembly can NEVER write
// outside the project's own folder, so a weird solution can at worst
// break the tool, never ShellQuest itself. Do not weaken it.
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { REPO_ROOT } = require('./paths');
const { TIMEOUT_MS } = require('./verify-python');

const PROJECTS_ROOT = path.join(REPO_ROOT, 'projects');

// Resolve a project-relative file and PROVE it lives inside
// projects/<name>/ — rejects traversal, absolute paths, symlink tricks
// at the parent level, and files outside the named project.
function resolveProjectFile(project) {
  if (!project || !project.name || !project.file) {
    return { error: 'malformed project block' };
  }
  if (!/^[a-z0-9-]+$/.test(project.name)) {
    return { error: `invalid project name: ${project.name}` };
  }
  const projectDir = path.join(PROJECTS_ROOT, project.name);
  let target = path.resolve(REPO_ROOT, project.file);
  // Resolve symlinks in every existing path component — a committed
  // symlink inside projects/ must not be able to point the write
  // elsewhere. (The lexical check alone can be defeated by one.)
  try {
    const dir = fs.existsSync(path.dirname(target))
      ? fs.realpathSync(path.dirname(target))
      : path.dirname(target);
    target = path.join(dir, path.basename(target));
    if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
      return { error: `assembly refused: ${project.file} is a symlink` };
    }
  } catch (err) {
    return { error: `assembly refused: ${err.message}` };
  }
  const realProjectDir = fs.existsSync(projectDir) ? fs.realpathSync(projectDir) : projectDir;
  const rel = path.relative(realProjectDir, target);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    return { error: `assembly refused: ${project.file} is outside projects/${project.name}/` };
  }
  return { file: target };
}

function markerRegex(fn) {
  // The exact marker format is load-bearing (v0.9 asserts against it).
  return new RegExp(
    `(# --- BEGIN ${fn} ---\\n)[\\s\\S]*?(# --- END ${fn} ---)`,
    'm'
  );
}

// Write the learner's verified solution between the function's markers.
function assembleStep(exercise, solutionCode) {
  const project = exercise.project;
  if (!project || !project.function) return { assembled: false };
  // The function name is interpolated into a RegExp — constrain it to a
  // plain Python identifier (the linter enforces the same rule).
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(project.function)) {
    return { assembled: false, error: `invalid project function name: ${project.function}` };
  }

  const resolved = resolveProjectFile(project);
  if (resolved.error) return { assembled: false, error: resolved.error };
  if (!fs.existsSync(resolved.file)) {
    return { assembled: false, error: `project file missing: ${project.file}` };
  }

  const source = fs.readFileSync(resolved.file, 'utf8');
  const re = markerRegex(project.function);
  if (!re.test(source)) {
    return { assembled: false, error: `markers for ${project.function} not found in ${project.file}` };
  }

  const block = solutionCode.trimEnd() + '\n';
  // Function replacer, NOT a replacement string: learner code containing
  // `$'`, `$&`, or `$1` (e.g. the regex r'ERROR$' + a quote) would be
  // interpreted by String.replace and corrupt the assembled file.
  fs.writeFileSync(resolved.file, source.replace(re, (_m, begin, end) => `${begin}${block}${end}`));

  // v0.9 amendment: the curriculum repo commits ONLY stubs. The learner's
  // assembled copy stays local — skip-worktree makes git blind to it, so
  // completed solutions can never ride into a public commit. (Finished
  // tools graduate to their own repo instead.)
  let gitHidden = true;
  try {
    require('child_process').execFileSync(
      'git',
      ['update-index', '--skip-worktree', '--', project.file],
      { cwd: REPO_ROOT }
    );
  } catch {
    // Not fatal, but be honest about the consequence: the assembled file
    // is now visible to git, and the stubs-only lint checks HEAD — so a
    // careless add+commit+push WOULD leak before CI flags it. Surface it.
    gitHidden = false;
  }
  return { assembled: true, file: project.file, function: project.function, gitHidden };
}

// The capstone runner: execute the assembled tool, pass when every
// expected string appears in its output. Failure shows the real output.
function runProject(exercise) {
  const v = exercise.verification;
  return new Promise((resolve) => {
    // Own process group + group kill, so a hung tool's subprocesses die
    // with it (same policy as the python harness).
    const child = execFile(
      'bash',
      ['-c', v.command],
      { cwd: REPO_ROOT, timeout: TIMEOUT_MS, killSignal: 'SIGKILL', detached: true },
      (err, stdout, stderr) => {
        if (err && err.killed) {
          try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ }
          return resolve({
            passed: false,
            error: `Timed out after ${TIMEOUT_MS / 1000}s — is the tool stuck in a loop?`,
          });
        }
        const output = `${stdout || ''}${stderr ? `\n${stderr}` : ''}`.trim();
        const results = (v.expect_contains || []).map((s) => ({
          call: `output contains "${s}"`,
          passed: (stdout || '').includes(s),
          error: (stdout || '').includes(s) ? undefined : 'missing from the tool output',
        }));
        const passed = results.length > 0 && results.every((r) => r.passed);
        resolve({ passed, results, output: passed ? undefined : output });
      }
    );
  });
}

module.exports = { assembleStep, runProject, resolveProjectFile, PROJECTS_ROOT };
