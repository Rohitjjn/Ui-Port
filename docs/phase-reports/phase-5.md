# Phase 5 — Port loop (screens, motion, assets, responsive)

## Done

- `skills/port-screen/` — per-screen procedure: stateless composable + fixtures, render, diff, fix one
  thing at a time, iteration cap, acceptance rules; `references/compose-fidelity-checklist.md` (the
  details that decide the last 1%) and `references/adaptive-layout.md` (compact/medium/expanded, and
  the two desktop cases).
- `skills/port-motion-and-assets/` — motion mapping table (framer-motion → Compose), assets, shadows,
  gradients, blend modes, plus `scripts/svg-to-compose.mjs` for icon/vector conversion.
- `agents/screen-builder.md` (builds one screen, UI files only) and `agents/diff-reviewer.md`
  (judges a diff, returns one next fix or an acceptance with categorised residuals).
- Imports map produced by the `mapper` agent using `references/library-mapping.md` with the project's
  own Compose versions.
- `docs/LIMITS.md` — every known conversion limit with a category, a fallback and how to log it.

## Key numbers

| Metric | Value |
| --- | --- |
| Screen iteration cap | 5 per screen per device (enforced by `state bump --limit`) |
| Residual categories | 9, whitelisted in `config/thresholds.json` |
| SVG converter coverage | path, circle, ellipse, rect, line, polyline, polygon, groups, fill/stroke, colours |
| Screens ported in this session | 0 — requires a Compose toolchain (D2) |

## Decisions made

- Screens are ported **stateless with fixtures first**; wiring comes only after the diff passes. This
  keeps screenshots independent of the network and makes the wiring step mechanical.
- Tablet/desktop are structural layouts, not scaled phones; the prototype's `lg` breakpoint is a
  navigation-mode change and is modelled as such.
- Motion is verified by device capture, appearance by frozen-frame diff. No claim of motion parity
  from a screenshot.

## Open risks / blockers

- **Blocker B3:** no JDK / Android SDK in this environment, so no Compose screen could be rendered
  here. The loop is specified, scripted and unit-tested at the diff level; the rendering side runs in
  CI (once B1 is resolved) or on a `LOCAL_FULL` machine.

## Next

Phase 6 (wiring), see `phase-6.md`.
