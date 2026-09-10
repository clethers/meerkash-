#!/usr/bin/env node
/**
 * Install the closed-loop Stop hook.
 *
 * Claude Code reads hooks from .claude/settings.json, which some tooling is not
 * allowed to write into directly — so the template lives in loop/ and this
 * script puts it where Claude Code will find it.
 *
 *   npm run setup:loop
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(ROOT, '.claude', 'settings.json');
const source = join(ROOT, 'loop', 'settings.json');

mkdirSync(join(ROOT, '.claude'), { recursive: true });

if (existsSync(target)) {
  const current = readFileSync(target, 'utf8');
  if (current.includes('loop/gate.mjs')) {
    console.log('Stop hook already installed — nothing to do.');
    process.exit(0);
  }
  console.error(
    'A .claude/settings.json already exists and does not reference loop/gate.mjs.\n' +
      'Merge this "Stop" hook into it by hand so nothing you have there is lost:\n\n' +
      readFileSync(source, 'utf8'),
  );
  process.exit(1);
}

copyFileSync(source, target);
console.log('Stop hook installed at .claude/settings.json.');
console.log('Verify it with:  npm run gate -- --check');
