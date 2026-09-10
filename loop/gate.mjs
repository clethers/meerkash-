#!/usr/bin/env node
/**
 * Meerkash closed-loop gate.
 *
 * Claude Code fires this on the `Stop` event — every single time the agent
 * tries to end its turn. If any stage is red the gate exits with code 2, which
 * REFUSES the stop and throws the agent back in to keep working. The agent
 * never gets to grade its own homework: the verdict here comes from real
 * commands with real exit codes, and costs zero tokens.
 *
 * Stages, cheapest first (fail fast):
 *   1. vitest        the balance engine must be provably correct
 *   2. tsc --noEmit  no half-written types, no broken imports
 *   3. next build    the app must actually compile — `npm run dev` depends on it
 *   4. stub scan     no TODO / FIXME / "not implemented" / empty handlers
 *
 * A hard ceiling (MAX_BLOCKS) stops the loop from spinning forever: after that
 * many consecutive refusals the gate gives up, lets the agent stop, and tells
 * the human exactly what is still red.
 *
 *   node loop/gate.mjs          run as the Stop hook
 *   node loop/gate.mjs --check  run the same stages by hand, no blocking
 *   node loop/gate.mjs --reset  clear the turn counter
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const STATE = join(ROOT, 'loop', '.gate-state.json');

/** Turn ceiling. Raise it deliberately; do not remove it. */
const MAX_BLOCKS = 150;

/** Skip the slow `next build` stage until the fast stages are green. */
const STAGES = [
  { name: 'unit tests (balance engine)', cmd: 'npx vitest run --reporter=dot' },
  { name: 'typecheck', cmd: 'npx tsc --noEmit' },
  { name: 'production build', cmd: 'npx next build' },
];

const STUB_PATTERNS = [
  /\bTODO\b/,
  /\bFIXME\b/,
  /\bXXX\b/,
  /not implemented/i,
  /implement (this|me) later/i,
  /placeholder for/i,
  /coming soon/i,
  /<<<<<<< /,
];

const SCAN_DIRS = ['src', 'tests', 'supabase'];
const SCAN_EXT = new Set(['.ts', '.tsx', '.sql', '.mjs']);

function readState() {
  if (!existsSync(STATE)) return { blocks: 0 };
  try {
    return JSON.parse(readFileSync(STATE, 'utf8'));
  } catch {
    return { blocks: 0 };
  }
}

function writeState(state) {
  writeFileSync(STATE, JSON.stringify(state, null, 2));
}

function run(cmd) {
  try {
    const stdout = execSync(cmd, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8', timeout: 600_000 });
    return { ok: true, output: stdout };
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}` || String(error.message ?? error);
    return { ok: false, output };
  }
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCAN_EXT.has(full.slice(full.lastIndexOf('.')))) out.push(full);
  }
  return out;
}

function scanForStubs() {
  const hits = [];
  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (line.includes('gate:allow')) return;
        for (const pattern of STUB_PATTERNS) {
          if (pattern.test(line)) {
            hits.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim().slice(0, 100)}`);
            return;
          }
        }
      });
    }
  }
  return hits;
}

function tail(text, lines = 40) {
  return text.trim().split('\n').slice(-lines).join('\n');
}

function evaluate() {
  for (const stage of STAGES) {
    const result = run(stage.cmd);
    if (!result.ok) {
      return { green: false, stage: stage.name, detail: tail(result.output) };
    }
  }
  const stubs = scanForStubs();
  if (stubs.length > 0) {
    return {
      green: false,
      stage: 'stub scan',
      detail: `Unfinished markers found in ${stubs.length} place(s):\n${stubs.slice(0, 25).join('\n')}`,
    };
  }
  return { green: true };
}

const mode = process.argv[2];

if (mode === '--reset') {
  writeState({ blocks: 0 });
  console.log('Gate counter reset.');
  process.exit(0);
}

const verdict = evaluate();

if (mode === '--check') {
  if (verdict.green) {
    console.log('GATE GREEN — tests, types, build and stub scan all pass.');
    process.exit(0);
  }
  console.error(`GATE RED at: ${verdict.stage}\n\n${verdict.detail}`);
  process.exit(1);
}

// --- Stop-hook mode -------------------------------------------------------
const state = readState();

if (verdict.green) {
  writeState({ blocks: 0, lastResult: 'green', at: new Date().toISOString() });
  process.exit(0);
}

state.blocks = (state.blocks ?? 0) + 1;
state.lastResult = 'red';
state.lastStage = verdict.stage;
state.at = new Date().toISOString();
writeState(state);

if (state.blocks >= MAX_BLOCKS) {
  console.error(
    `Gate ceiling reached (${MAX_BLOCKS} turns) and "${verdict.stage}" is still red. ` +
      `Stopping so a human can look. Run \`npm run gate -- --check\` to see why, ` +
      `then \`node loop/gate.mjs --reset\` before resuming.`,
  );
  process.exit(0); // allow the stop — the ceiling, not the agent, decided
}

console.log(
  JSON.stringify({
    decision: 'block',
    reason:
      `The build gate is RED at stage: ${verdict.stage}. ` +
      `You are not done. Fix the cause and keep going — do not stub, skip, or delete tests to get green. ` +
      `Turn ${state.blocks} of ${MAX_BLOCKS}.\n\n${verdict.detail}`,
  }),
);
process.exit(2);
