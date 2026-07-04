'use strict';
// AI-native help: ONE Socratic hint aimed at the learner's actual code and
// the specific test they failed. The entire design constraint (see
// BUILD-SPEC-ai-help.md): it never reveals the solution. The guardrails
// are layered — a strict system prompt, then checkHint(), a MECHANICAL
// post-generation filter (same verify-don't-trust discipline as the help
// example leak rule), then the renderer gates the button behind the
// authored help tiers. One regenerate on a rejected hint, then the caller
// falls back to the authored nudge.
//
// Local-first: Ollama on 127.0.0.1 (free, private). If Ollama is
// unreachable and ANTHROPIC_API_KEY is set, falls back to the Anthropic
// API. Never throws — always resolves {hint} or {hint: null, reason}.

const OLLAMA_URL = process.env.SQ_AI_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.SQ_AI_MODEL || 'qwen2.5-coder:3b';
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const TIMEOUT_MS = 60_000; // first call pays the model load into RAM

const SYSTEM_PROMPT =
  'You are a Socratic tutor for a programming beginner. You will be shown ' +
  'a task, the learner\'s code, and the test they failed. Respond with ONE ' +
  'hint of one or two short sentences that points at the gap in their ' +
  'thinking. You must NOT write any code. You must NOT use code keywords ' +
  'or symbols (no def, no return, no equals signs, no backticks). You must ' +
  'NOT state the correct answer or the specific fix. Ask a question or ' +
  'make an observation that helps them find it themselves. If they are ' +
  'close, tell them what to look at, not what to change it to.';

// Mechanical filter — deliberately strict (the spec lists def/return/=/
// fences explicitly). A false rejection costs one regenerate and at worst
// falls back to the authored nudge, so err hard toward rejecting.
function checkHint(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, why: 'empty' };
  const t = text.trim();
  if (t.length > 320) return { ok: false, why: 'too long for a nudge' };
  if (/```/.test(t)) return { ok: false, why: 'a code block' };
  if (/=/.test(t)) return { ok: false, why: 'an equals sign' };
  if (/\b(def|return|lambda|import|print|elif)\b/i.test(t)) {
    return { ok: false, why: 'a code keyword' };
  }
  if (/\n\s{4,}\S/.test(t)) return { ok: false, why: 'an indented code body' };
  if (/>>>/.test(t)) return { ok: false, why: 'a REPL transcript' };
  return { ok: true };
}

function buildUserMessage({ prompt, code, failure, aiContext }) {
  const lines = [
    `The task the learner was given: ${prompt}`,
    '',
    'The learner\'s current code:',
    code,
    '',
  ];
  if (failure) {
    const got = failure.error !== undefined
      ? `it raised: ${failure.error}`
      : `it returned: ${JSON.stringify(failure.actual)}`;
    lines.push(
      `The failing test: ${failure.call} should give ${JSON.stringify(failure.expected)}, but ${got}.`
    );
  }
  if (aiContext) lines.push(`Author's note about the common trap here: ${aiContext}`);
  lines.push('', 'Give the one Socratic hint now.');
  return lines.join('\n');
}

async function fetchWithTimeout(url, options) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function askOllama(userMsg, corrective) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMsg },
  ];
  if (corrective) messages.push({ role: 'user', content: corrective });
  const res = await fetchWithTimeout(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      options: { temperature: 0.4, num_predict: 96 },
    }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const data = await res.json();
  return (data.message && data.message.content) || '';
}

async function askAnthropic(userMsg, corrective) {
  const content = corrective ? `${userMsg}\n\n${corrective}` : userMsg;
  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 120,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}`);
  const data = await res.json();
  return (data.content && data.content[0] && data.content[0].text) || '';
}

// The one entry point. Tries the local model, regenerates once on a
// filtered hint, falls back to the Anthropic API only if the local model
// is unreachable AND a key is present.
async function generateHint(input) {
  let ask = askOllama;
  let source = 'local';
  try {
    await fetchWithTimeout(`${OLLAMA_URL}/api/version`, { method: 'GET' });
  } catch {
    if (!process.env.ANTHROPIC_API_KEY) {
      return { hint: null, reason: 'offline', source: null };
    }
    ask = askAnthropic;
    source = 'api';
  }

  const userMsg = buildUserMessage(input);
  try {
    let text = await ask(userMsg);
    let check = checkHint(text);
    if (!check.ok) {
      const corrective =
        `Your previous reply was rejected because it contained ${check.why}. ` +
        'Reply again: one or two plain-English sentences, no code, no symbols, ' +
        'no keywords — only a question or observation.';
      text = await ask(userMsg, corrective);
      check = checkHint(text);
    }
    if (!check.ok) return { hint: null, reason: 'unsafe', source };
    return { hint: text.trim(), reason: null, source };
  } catch (err) {
    return { hint: null, reason: `error: ${err.message}`, source };
  }
}

module.exports = { generateHint, checkHint, buildUserMessage, SYSTEM_PROMPT };
