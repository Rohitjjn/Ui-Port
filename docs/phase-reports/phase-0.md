# Phase 0 — Recon, research, baseline

## Done

- Prototype unpacked to `testbed/prototype` (archive untouched), dependencies installed, production
  build verified: single 732 kB `dist/index.html` in 10 s.
- SimpMusic + its `core` submodule cloned at pinned commits and committed as plain files in
  `testbed/SimpMusic` (25 MB / 1545 files after trimming store screenshots, fastlane and upstream CI;
  justification in `testbed/SOURCES.md`).
- `docs/testbed-report.md`: both sides measured with the plugin's own scanners.
- `docs/RESEARCH.md`: plugin/skill/agent/command/hook formats verified against Anthropic's published
  plugin source (the docs hosts were unreachable) — with the access table stated explicitly.
- `docs/TOOLS-RESEARCH.md`: every tool, its pin, how the pin was verified, and why the alternatives
  were rejected.
- `docs/PLAN.md`: decisions D1–D8 and risks R1–R7.
- Baseline build workflow written (`ci-e2e-simpmusic.yml`, `templates/github-actions/uiport-build.yml`).

## CLI runs

Workflow runs: **0** — Actions cannot be dispatched from this session (see below).

## Key numbers

| Metric | Value |
| --- | --- |
| Prototype source | 35 files, 4 952 lines, 23 screens, 4 stores, 5 libraries |
| SimpMusic | 1 160 Kotlin files, 34 screens, 35 ViewModels, 64 engine entry points, 27 modules |
| Toolchain | Gradle 9.8.1, AGP 9.5.0, Kotlin 2.4.21, CMP 1.12.2, compileSdk 37, JDK 21 |
| Test bed size committed | 25 MB |

## Decisions made

D1 Actions unreachable from here · D2 no JVM/SDK here · D3 no Playwright browser here ·
D6 commit test bed as trimmed plain files · D7 pins need 14 days of public availability.

## Open risks / blockers

- **Blocker B1:** zero CI evidence. `/actions/workflows` returns `total_count: 0` and
  `/actions/permissions` returns 403 although file writes succeed. The user must enable Actions or
  reconnect with a `workflow`-scoped token.
- **Risk R1:** AGP 9.5 / compileSdk 37 may exceed what the runner has; the first baseline run decides
  how much of Phase 8 is possible.

## Next

Phase 1 (skeleton) — done in the same session, see `phase-1.md`.
