# Architecture

## Shape

```
Claude Code  ──  commands/ (4)      user-facing entry points
                   │
                   ├── skills/ (11)  procedures, loaded when relevant
                   ├── agents/ (4)   isolated jobs with a read/write budget
                   └── hooks/ (4)    guard rails: protect, worklog, syntax, resume

scripts/  ──  the deterministic engine: scanners, capture, diff, state, packaging
config/   ──  the numbers: tools, viewports, thresholds
templates/──  what gets copied into a user project (screenshots, workflows)
```

The split matters: **skills decide, scripts measure**. Anything that produces a number (a score, a
count, a verdict) is computed by a script and unit-tested; anything that needs judgement (which
Component maps to which composable, whether a residual is acceptable) is a procedure in a skill.

## The engine

| Script | Input | Output | Tested |
| --- | --- | --- | --- |
| `scan-prototype.mjs` | prototype folder | routes, screens, components, stores, libraries, tokens, fonts, motion, assets, data shapes | yes, against the real test-bed prototype |
| `scan-app.mjs` | Android/KMP project | modules, toolchain versions, screens, ViewModels + exposed StateFlows, DI, engine entry points, UI/engine split, protected globs | yes, against the real SimpMusic tree |
| `plan-capture.mjs` | scan + devices + states | `.uiport/capture-spec.json` | yes |
| `capture-reference.mjs` | spec + running prototype | PNGs + DOM geometry dumps | planning/paths tested; needs a browser to execute |
| `visual-diff.mjs` | two PNGs (+geometry) | score JSON, markdown report, diff PNG, heat map, exit code | yes |
| `diff-all.mjs` | reference dir + candidate dir | per-screen reports, `summary.md/json`, regression list, baseline update | yes |
| `verify.mjs` | project | evidence JSON + log of every check | partially (delegation, packaging verified) |
| `package-zip.mjs` | project | ZIP with worklog, no build output, no secrets | yes |
| `svg-to-compose.mjs` | SVG | `ImageVector` Kotlin | yes |
| `uiport.mjs` | – | CLI over state, worklog, answers, preflight, verify | yes |

All of them share `scripts/lib/` (fs, state, worklog, preflight, answers, diff). No script reads
global state, writes outside its declared outputs, or needs a network except `resolve-versions.mjs`.

## State, resume and the worklog

`.uiport/state.json` (schema v1) is the only mutable source of truth: case, mode, device targets,
step statuses, per-screen per-device status + score + iteration count, noise floor, approval flag,
timestamps. Writes are atomic (tmp + rename), unknown keys are preserved, older schemas are migrated,
a corrupt file is quarantined rather than fatal. `/uiport-resume` reads it and continues at the first
incomplete step.

`.uiport/worklog/` keeps one file per step with six fixed sections, plus `CHANGELOG.md` listing every
file touched. The Stop hook enforces it exactly once per step, so the log cannot be skipped and the
agent cannot be trapped.

## Guard rails

```
PreToolUse  ── engine-protect ── edit or destructive command on a protected glob? block unless approved
PostToolUse ── syntax-check  ── brackets/quotes/CRLF hint in the edited file (never blocks)
Stop        ── worklog-guard ── step in progress but worklog stale? block once
SessionStart── session-start ── state.json exists? announce resume + next step
```

Every hook: pure decision function in `hooks/lib/`, thin wrapper, 10 s timeout, exit 0 on any
internal error. The decision functions are unit-tested (approve/block/approved/directory/mixed
paths, garbage stdin, one-shot Stop).

## Fidelity contract, as implemented

1. Both sides render the same viewport and DPR from `config/viewports.json`.
2. Both sides use the same fixture data and the same bundled font files.
3. Capture freezes animations, pins time and seeds randomness; the Compose side is rendered from a
   static state (no animation running at screenshot time).
4. Three metrics: pixel match, SSIM, geometry coverage. A screen is `matched` only when pixels and
   geometry both pass.
5. The noise floor is measured before porting; if the same side cannot reproduce itself, thresholds
   are adjusted and said so.
6. 5 iterations per screen per device, then `accepted-with-notes` (above floor + every residual
   categorised) or `blocked` (ask the user). Never a lowered floor.

## Why the numbers live in config

`config/thresholds.json` and `config/viewports.json` are read by scripts, by tests and by the report
renderer. A threshold hard-coded in a procedure would drift from the one used in CI; one file means
one answer to "what does done mean".
