# ui-port

**Port a web UI prototype into Jetpack Compose — visually, faithfully, inside an existing Android app.**

`ui-port` is a Claude Code plugin. You give it a React/TSX prototype (the kind an AI tool generates so
you can preview a redesign in a browser) plus an Android project that has a real engine (playback,
networking, database, DI). The plugin captures the prototype in a real browser, maps the Android
project, rebuilds the prototype screen by screen in Compose, diffs every screen against the web
reference, iterates until it matches, wires the new UI to your existing engine, verifies, and
packages the result — leaving a full audit trail in `.uiport/`.

Status: **v0.1.0 — in development.** Phase-by-phase build log lives in `docs/phase-reports/`.

## Why

Web prototypes are cheap to reshape and look nothing like Compose once you start rebuilding them by
hand. `ui-port` makes the browser the source of truth: same viewport, same fonts, same fixture data,
frozen animations, then a measured pixel + SSIM + geometry diff against the Compose render. Nothing
ships unless it is above the documented acceptance floor or the residual difference is explained in
the report.

## Install (once released)

```
/plugin marketplace add Rohitjjn/Ui-Port
/plugin install ui-port@ui-port
```

## Use

```
/uiport-start            # preflight → maps → decision gate → port loop → wiring → verify
/uiport-resume           # continue from .uiport/state.json
/uiport-status           # progress table per screen per device
/uiport-package          # ZIP of the ported project (new UI + engine + worklog)
```

## Repository layout

```
.claude-plugin/    plugin.json + marketplace.json
commands/          uiport-start, uiport-resume, uiport-status, uiport-package
skills/            preflight, map-app, map-prototype, plan-screens, capture-reference,
                   port-screen, port-motion-and-assets, visual-diff, wire-engine,
                   verify-and-fix, finalize-delivery
agents/            mapper, screen-builder, diff-reviewer, wiring-engineer
hooks/             hooks.json + Node.js hook scripts (cross-platform)
scripts/           Node.js tooling (preflight, capture, diff, state, worklog, package)
config/            tools.json, viewports.json, thresholds.json
templates/         github-actions/, compose-screenshot-test/, playwright/
tests/             unit/, integration/, behavior/
docs/              PLAN.md, RESEARCH.md, TOOLS-RESEARCH.md, ARCHITECTURE.md, LIMITS.md, ...
testbed/           SimpMusic/ (GPL-3.0, unmodified upstream), prototype/ (the demo prototype)
```

`testbed/` exists only to develop and prove the plugin against a real app. It is deletable at any
time and no plugin code depends on it. See `testbed/SOURCES.md` and `docs/CLEANUP.md`.

## Fidelity contract (short version)

| Item | Default |
| --- | --- |
| Goal | 99.9% pixel match |
| Acceptance floor | 98.5% pixel match |
| Iterations per screen per device | 5 then "accepted with notes" or blocked |
| Geometry tolerance | 1 dp on text and key containers |
| Metrics | pixelmatch %, SSIM, heat map, geometry diff |

All thresholds live in `config/thresholds.json`; every run records the measured noise floor so
rendering noise is never reported as a layout bug. See `docs/LIMITS.md` for what the platform cannot
reproduce (blur, blend modes, CSS filters, font rasterization, ...).

## Security notes

- Plugin hooks and scripts run on your machine. `ui-port` hooks are fast, deterministic, fail-safe,
  and have unit tests.
- Nothing is installed without an explicit approval batch (Step 0). Every pin is recorded with the
  date it was resolved.
- Engine files are protected by default: edits to `engine-paths.json` globs are blocked until you
  approve them.
- No credentials are ever written to logs.

## License

MIT — see `LICENSE`. `testbed/SimpMusic/` is GPL-3.0 upstream code kept for testing only and is not
part of the plugin; no SimpMusic code is copied into plugin folders.
