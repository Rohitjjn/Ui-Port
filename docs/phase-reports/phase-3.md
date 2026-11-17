# Phase 3 — Mapping

## Done

- `scripts/lib/scan-prototype.mjs` + `scan-prototype.mjs`: routes/screens, components, imports,
  libraries classified by kind, zustand stores (keys + actions), Tailwind breakpoints, media queries,
  dark-mode mechanism, motion inventory, assets, fonts, design tokens (light + dark), TS data shapes,
  inferred states, warnings.
- `scripts/lib/scan-app.mjs` + `scan-app.mjs`: modules, Gradle catalog versions, screens, composables
  (with state/ViewModel usage), navigation destinations, ViewModels + public StateFlows + deps, DI
  modules, data models, engine entry points, UI/engine split, protected glob suggestions.
- `skills/map-app/`, `skills/map-prototype/` with references (engine split, app-map schema, library
  mapping table, prototype signals).
- Real maps generated for both sides (see `docs/testbed-report.md`).

## Key numbers

| Metric | Prototype | SimpMusic |
| --- | --- | --- |
| Files scanned | 35 | 1 160 Kotlin |
| Screens | 23 | 34 |
| State holders | 4 stores | 35 ViewModels |
| Libraries / engine entry points | 5 | 64 |
| Scan time | 0.2 s | 0.4 s |

## Decisions made

- Regex scanners, no TypeScript/Kotlin compiler: fast, dependency-free, and exact counts asserted in
  tests against the real trees.
- No per-file LLM reading: the map is data, and the model queries it.
- Engine globs are per-directory only when the directory is 100% engine code (D8). This was a real
  bug fix, caught by a test.

## Open risks / blockers

- The scanner heuristic can misfile a file in an unusual project layout. Mitigated by requiring the
  user to review `engine-paths.json` once, and by `map-app`'s explicit review step.

## Next

Phase 4 (capture + diff), see `phase-4.md`.
