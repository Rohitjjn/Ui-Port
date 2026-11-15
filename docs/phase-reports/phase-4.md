# Phase 4 — Capture and diff engine

## Done

- `scripts/lib/diff.mjs`: pixel diff (pixelmatch), SSIM, geometry comparison with 1dp tolerance,
  symmetric masks, heat map, noise-floor calibration and threshold adjustment, acceptance decision
  (`matched` / `accepted-with-notes` / `building` / `blocked`) with the documented exit codes.
- `scripts/visual-diff.mjs` (single pair + `--calibrate`), `scripts/diff-all.mjs` (whole device, summary,
  regressions against `.uiport/baseline.json`, noise-floor mode).
- `scripts/lib/capture-spec.mjs`, `plan-capture.mjs`, `capture-reference.mjs`: deterministic
  Playwright capture (frozen animations, pinned clock, seeded random, network off, fonts awaited,
  caret hidden, scrollbars hidden) + DOM geometry dump; refuses to fake unreachable states.
- `templates/compose-screenshot-test/` (Roborazzi + semantics dump in the same coordinate space).
- `skills/capture-reference/`, `skills/visual-diff/` with references (determinism, geometry, metrics,
  residual categories).

## Key numbers

| Metric | Value |
| --- | --- |
| Diff unit tests | 29, all passing |
| Synthetic images exercised | identical, 3px shift, colour change, AA tolerance, masked region, broken geometry |
| Exit-code contract | 0 matched · 3 accepted-with-notes · 5 building · 6 blocked |
| Capture units planned for the test bed | 66 across 3 devices × 23 screens, 102 screenshots |

## Decisions made

- pngjs/pixelmatch/ssim.js (pure JS) over native image stacks, so the number is identical on every OS.
- Masks are applied to **both** images with the same fill: a masked region can neither hide a
  regression nor create one.
- States the prototype cannot reach are recorded `state-not-reproducible`, never faked.

## Open risks / blockers

- **Blocker B2:** Chromium cannot be downloaded in this environment (only GitHub + npm are reachable),
  so the web capture could not be executed here. `capture-reference.mjs` exits 7 and re-plans to CI.
  Everything either side of it (planning, diffing, noise floor, packaging) is executed and tested.
- Blur/`backdrop-filter` will not render under JVM screenshot tools: documented as a categorised
  residual, not a failure.

## Next

Phase 5 (port loop), see `phase-5.md`.
