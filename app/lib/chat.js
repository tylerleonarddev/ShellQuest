'use strict';
// The study-companion chat: a local-LLM conversation GROUNDED in the
// learner's actual progress data. Same local-first stance as ai-hint.js
// (Ollama on 127.0.0.1, SQ_AI_MODEL/SQ_AI_URL overrides), different job:
// recaps, planning, encouragement — "what did I do yesterday", "what's
// due tomorrow", "recap this week".
//
// Grounding rule: the model is handed a STUDY SNAPSHOT built from the
// progress files and instructed to answer from it alone. It explains
// concepts the learner has already completed; it never writes solution
// code for unsolved exercises (same no-spoiler floor as the hint system).

const path = require('path');
const { PROGRESS_DIR } = require('./paths');
const { readJson } = require('./store');

const OLLAMA_URL = process.env.SQ_AI_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.SQ_AI_MODEL || 'qwen2.5-coder:3b';

const SYSTEM_PROMPT =
  'You are the ShellQuest study companion — a warm, concise coach inside ' +
  'a learn-to-code app. You are given a STUDY SNAPSHOT of the learner\'s ' +
  'real progress data. Ground every factual claim in that snapshot; if it ' +
  'does not contain the answer, say so plainly instead of guessing. You ' +
  'may explain concepts behind exercises the learner has ALREADY completed. ' +
  'You must never write solution code for exercises that are not completed ' +
  'yet — redirect to the in-app hints instead. Keep answers short: a few ' +
  'sentences, or a short list when listing. Be encouraging without being ' +
  'saccharine; celebrate streaks and finished work concretely.';

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// One compact, human-readable snapshot. Titles come from the loaded
// content so the model talks like the app ("Copy that"), not in ids.
function buildSnapshot(exercises) {
  const titleOf = new Map(exercises.map((e) => [e.id, e.title]));
  const t = (id) => titleOf.get(id) || id;

  const profile = readJson(path.join(PROGRESS_DIR, 'profile.json'), {});
  const daily = readJson(path.join(PROGRESS_DIR, 'daily.json'), {});
  const completions = readJson(path.join(PROGRESS_DIR, 'completions.json'), { completions: [] }).completions;
  const reviews = readJson(path.join(PROGRESS_DIR, 'reviews.json'), { cards: {} });
  const weekly = readJson(path.join(PROGRESS_DIR, 'weekly.json'), {});
  const aiHelp = readJson(path.join(PROGRESS_DIR, 'ai-help.json'), { days: {} });

  const today = daysAgoStr(0);
  const lines = [`Today's date: ${today}`, ''];

  lines.push(`Profile: level ${profile.level}, ${profile.xp} XP total, streak ${profile.streak_days} day(s), last cleared ${profile.last_cleared_date || 'never'}.`);

  if (daily.date === today) {
    const done = daily.completed || [];
    const queue = daily.queue || [];
    lines.push(`Today's queue (${done.length}/${queue.length} done): ` +
      queue.map((id) => `${t(id)} [${(daily.kinds || {})[id] || '?'}${done.includes(id) ? ', DONE' : ''}]`).join('; '));
  } else {
    lines.push('Today\'s queue: not generated yet (open the app dashboard).');
  }

  // Recent history, bucketed by day — the raw material for recaps.
  const byDay = new Map();
  for (const c of completions) {
    const day = (c.passed_at || '').slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(`${t(c.exercise_id)} (+${c.xp_awarded} XP)`);
  }
  lines.push('', 'Completion history (most recent 14 days with activity):');
  const days = [...byDay.keys()].sort().reverse().slice(0, 14);
  for (const day of days) {
    const label = day === today ? `${day} (today)` : day === daysAgoStr(1) ? `${day} (yesterday)` : day;
    lines.push(`  ${label}: ${byDay.get(day).join(', ')}`);
  }

  // What's coming due — the forward-looking half of "what should I do".
  const due = Object.entries(reviews.cards || {})
    .map(([id, card]) => ({ id, due: (card.due || '').slice(0, 10) }))
    .filter((c) => c.due)
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 12);
  if (due.length) {
    lines.push('', 'Upcoming reviews (spaced repetition):');
    for (const c of due) lines.push(`  ${c.due}: ${t(c.id)}`);
  }

  if (weekly.goals) {
    lines.push('', `Weekly goals: ${JSON.stringify(weekly.goals)} progress: ${JSON.stringify(weekly.progress || {})}`);
  }

  const aiToday = (aiHelp.days || {})[today];
  if (aiToday) {
    lines.push('', `AI hints used today: ${Object.entries(aiToday).map(([id, n]) => `${t(id)} ×${n}`).join(', ')} (those come back sooner in review).`);
  }

  const total = exercises.filter((e) => e.track !== 'onboarding').length;
  const doneCount = new Set(completions.map((c) => c.exercise_id)).size;
  lines.push('', `Overall: ${doneCount}/${total} exercises completed.`);

  return lines.join('\n');
}

// Stream a chat completion. `messages` is the renderer's running
// [{role, content}] history (user/assistant only — system+snapshot are
// prepended here, fresh every call, so the data is never stale).
// onChunk(text) fires per token-ish piece; resolves with the full text.
async function streamChat(exercises, messages, onChunk, signal) {
  const snapshot = buildSnapshot(exercises);
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: true,
      options: { temperature: 0.6, num_predict: 400 },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: `STUDY SNAPSHOT\n${snapshot}` },
        ...messages.slice(-12),
      ],
    }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let obj;
      try { obj = JSON.parse(line); } catch { continue; }
      const piece = obj.message && obj.message.content;
      if (piece) {
        full += piece;
        onChunk(piece);
      }
      if (obj.done) return full;
    }
  }
  return full;
}

module.exports = { streamChat, buildSnapshot, SYSTEM_PROMPT, OLLAMA_URL };
