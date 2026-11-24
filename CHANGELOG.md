# Changelog

All notable changes to the ui-port plugin. Format: Keep a Changelog, versioning: SemVer.

## [0.1.0] — 2026-11-15

### Added

- Plugin manifest and marketplace, 11 skills, 4 agents, 4 commands.
- Hooks: engine-protect (PreToolUse), worklog-guard (Stop), syntax-check (PostToolUse),
  session-start (SessionStart) — all cross-platform Node with unit tests.
- Scripts: preflight, `geometry-compare` (named dp offsets between the web geometry dump and the
  Compose semantics dump), state/worklog/answers libraries, prototype scanner, app scanner,
  capture planner, Playwright capture, visual diff (pixelmatch + SSIM + geometry + heat map +
  noise floor), diff-all with baselines and regression detection, verify runner, SVG-to-Compose
  converter, ZIP packager, plugin validator, markdown linter, version resolver.
- Config: tools registry with pinned versions and a 14-day age policy, viewport table
  (phone/tablet/desktop with DPR), fidelity thresholds and loop caps.
- Templates: Roborazzi screenshot test + semantics dump, three GitHub Actions workflows,
  pinned tooling package.
- Docs: plan, research, tools research, architecture, known limits, test-bed report, build log,
  phase reports, cleanup procedure, and the verbatim build specification (`docs/MASTER-PROMPT.md`).

### Changed

- `package-zip.mjs` excludes `testbed/` by default: a plugin delivery must never carry the
  development fixture that is meant to be deleted (`--include-testbed` overrides).
- `unpack-prototype.mjs` hoists a single wrapping folder, so an archive packed as `my-app/...`
  yields a project root instead of an error.
- `uiport.mjs` accepts `--project` in any position, and `answers --apply` writes the decision gate
  into `state.json` (device targets, mode, delivery, per-feature policy, engine-edit approval).
- `lint-markdown.mjs` expands directories given on the command line, and supports a
  `<!-- lint-verbatim -->` marker for documents that must not be reflowed.

### Known limitations

- Visual comparison of a Compose render against a web reference requires a machine with a JDK, an
  Android SDK and a browser; the diff engine itself runs anywhere Node runs.
- Nothing runs against a real browser or a real Gradle build in this repository yet: capture exits 7
  without Playwright, and the Compose half needs a JDK/Android SDK. See `docs/PLAN.md` D1–D3.
- Blur, blend modes and CSS filters are approximated and logged as categorised residuals.
- Desktop support depends on the target project: a Compose Multiplatform project gets a real
  desktop target, an Android-only project gets the expanded-window layout with the limits explained.
