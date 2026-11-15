---
name: capture-reference
description: Use to capture the web prototype deterministically for pixel comparison — every chosen screen, every reachable state, at each chosen device viewport, with frozen animations, no network, fixed fonts and a DOM geometry dump. Triggers on "capture the prototype", "take reference screenshots", "why are the screenshots different every time", or as Step 2A of a ui-port run.
---

# Capture the reference

One job: produce screenshots that are the same every time they run, plus the geometry data
the diff step needs.

## Procedure

1. Serve the prototype as a production build, not a dev server:

   ```
   cd <prototypeRoot> && npm ci && npm run build && npx vite preview --port 4173 --host 0.0.0.0
   ```

   A dev server injects HMR clients, re-opens sockets and sometimes re-renders mid-screenshot.
   If the prototype is single-file (`vite-plugin-singlefile`), serving `dist/` with any static
   server is enough.

2. Build the capture spec from the map, the chosen devices and the states the prototype can
   actually show:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/plan-capture.mjs <prototypeRoot> \
     --devices phone,tablet,desktop --states default,overlay \
     --out .uiport/capture-spec.json
   ```

3. Capture:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/capture-reference.mjs \
     --base-url http://localhost:4173 --spec .uiport/capture-spec.json \
     --out .uiport/reference
   ```

   Exit code 7 means Playwright or its browser is unavailable: re-plan for CI (see
   `skills/preflight/references/execution-modes.md`) instead of trying to work around it.

4. Measure the noise floor immediately, before any port work:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/capture-reference.mjs ... --out .uiport/reference/run2
   node ${CLAUDE_PLUGIN_ROOT}/scripts/visual-diff.mjs --calibrate \
     .uiport/reference/phone/home/default.png .uiport/reference/run2/phone/home/default.png
   ```

   Record the number in `.uiport/state.json` (`noiseFloor`) and in the worklog. A web-vs-web
   score below 99.5% means the capture is not deterministic yet — fix that first.

5. Skim a few screenshots yourself. A blank page, a spinner, or a font fallback caught here
   saves a whole port iteration later.

## Rules

- Never capture through a dev server, never with the network available, never mid-animation.
- States the prototype cannot reach are recorded as `state-not-reproducible`, never faked with
  injected DOM. A faked state produces a reference the Compose side can never match.
- One viewport per configured device target with the configured DPR. A capture at the wrong
  DPR cannot be compared with anything.
- Keep the spec in `.uiport/capture-spec.json` so a later re-capture draws the same screens.

## References

- `references/deterministic-capture.md` — every source of non-determinism and how it is removed.
- `references/geometry-dump.md` — what the DOM geometry dump contains and how Compose matches it.
