# The build loop

This repo ships with a **closed loop**: an agent that keeps working until the
build is actually green, and a gate that it cannot talk its way past.

## Why a gate at all

The failure mode of an autonomous coding agent isn't laziness — it's *false
completeness*. Left to judge its own work, a model will happily call a
half-built repo finished: components that return `null`, a `TODO` where the
logic should be, an import that doesn't resolve. You come back in the morning to
something that looks done and doesn't run.

The fix is that the maker and the checker are different things. Here the checker
is a script.

## What closes the loop

First install the hook — one command, once:

```bash
npm run setup:loop
```

That writes `.claude/settings.json`, which registers a `Stop` hook. Claude Code
fires it **every time the agent tries to end its turn**:

```json
{ "hooks": { "Stop": [{ "matcher": "", "hooks": [
  { "type": "command", "command": "node loop/gate.mjs", "timeout": 900 }
]}]}}
```

`loop/gate.mjs` runs four stages, cheapest first:

| # | Stage | Command | Catches |
| - | ----- | ------- | ------- |
| 1 | Unit tests | `vitest run` | wrong money maths |
| 2 | Typecheck | `tsc --noEmit` | half-written types, broken imports |
| 3 | Build | `next build` | a repo that won't actually start |
| 4 | Stub scan | in-script | `TODO`, `FIXME`, "not implemented" |

Green → exit 0, the agent is allowed to stop.
Red → the gate prints `{"decision":"block", …}` and exits **2**, which refuses
the stop and hands the agent the failing output to work from.

The verdict costs **zero tokens** — it comes from real commands with real exit
codes, not from a model's opinion.

## The ceiling

`MAX_BLOCKS = 150` in `loop/gate.mjs`. After 150 consecutive refusals the gate stops
blocking, lets the agent stop, and tells you which stage is still red. A gate
without a ceiling is how a loop spins all night on one impossible test.

The counter resets to zero the moment the gate goes green.

## Running the loop

```bash
claude
> /goal "Work through docs/BACKLOG.md. Do not stop until npm run gate -- --check is green."
```

`/goal` keeps the agent going across turns; the Stop hook decides what "done"
means. Use a strong model for the work — the gate is free, so there's no reason
to economise on the part that writes the code.

## Checking the gate by hand

```bash
npm run gate -- --check      # run all four stages, report, don't block
node loop/gate.mjs --reset   # clear the turn counter after a ceiling stop
```

## Proving it actually works

Don't trust a banner — break something and watch:

```bash
# 1. break the maths
sed -i 's/amount });/amount: amount - 1 });/' src/lib/balance/simplify.ts
node loop/gate.mjs; echo "exit: $?"     # exit 2, blocked at "unit tests"

# 2. leave a stub behind
echo '// TODO: finish this' >> src/lib/utils.ts
node loop/gate.mjs; echo "exit: $?"     # exit 2, blocked at "stub scan"

# 3. put it back
git checkout src/lib/balance/simplify.ts src/lib/utils.ts
node loop/gate.mjs; echo "exit: $?"     # exit 0, counter resets
```

All three were run against this repo before it was handed over.

## One rule

**Never let the agent verify its own "done."** If you add a feature that the
four stages can't check, add a test for it — don't relax the gate. And if you
ever find yourself deleting a test to get green, the loop has stopped being
useful and has started lying to you.
