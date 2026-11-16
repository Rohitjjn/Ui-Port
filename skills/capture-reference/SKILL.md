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

3. **Vendor the fonts first.** This is not optional and it is not a "nice to have" — it is the
   single largest source of meaningless diffs:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/vendor-fonts.mjs           # res/font -> prototype + app
   node ${CLAUDE_PLUGIN_ROOT}/scripts/vendor-fonts.mjs --check   # fails if any mirror drifted
   ```

   `config/fonts.json` is the manifest: it names the families, the weights, the files and the
   licences. The capture serves those files **from disk** (it never lets the page reach a CDN),
   waits for `document.fonts.ready`, then asserts inside the page that every expected family and
   weight is `loaded` and that nothing else was rendered. A missing or unloaded face is a hard
   failure (`status: font-check-failed`, exit code 8) — never a warning, because a reference
   photographed in a fallback font is a reference the app cannot match, and the difference is
   invisible unless you look for it.

   The same files must be in the Compose app (`composeResources/font`, loaded by
   `UiPortFonts`). `--check` is what keeps the two in step.

4. Capture:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/capture-reference.mjs \
     --base-url http://localhost:4173 --spec .uiport/capture-spec.json \
     --out .uiport/reference
   ```

   Exit code 7 means Playwright or its browser is unavailable: re-plan for CI (see
   `skills/preflight/references/execution-modes.md`) instead of trying to work around it.
   Exit code 8 means the vendored fonts did not load: fix the manifest or the CSS, do not
   screenshot anyway.

5. Measure the noise floor immediately, before any port work:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/capture-reference.mjs ... --out .uiport/reference/run2
   node ${CLAUDE_PLUGIN_ROOT}/scripts/visual-diff.mjs --calibrate \
     .uiport/reference/phone/home/default.png .uiport/reference/run2/phone/home/default.png
   ```

   Record the number in `.uiport/state.json` (`noiseFloor`) and in the worklog. A web-vs-web
   score below 99.5% means the capture is not deterministic yet — fix that first.

6. Skim a few screenshots yourself. A blank page, a spinner, or a font fallback caught here
   saves a whole port iteration later.

## Rules

- Never capture through a dev server, never with the network available, never mid-animation.
- States the prototype cannot reach are recorded as `state-not-reproducible`, never faked with
  injected DOM. A faked state produces a reference the Compose side can never match.
- One viewport per configured device target with the configured DPR. A capture at the wrong
  DPR cannot be compared with anything.
- Keep the spec in `.uiport/capture-spec.json` so a later re-capture draws the same screens.
- Never capture with a page that fell back to a system font. The check is automatic; do not
  "just take the screenshot" when it fails, and do not silence it for one screen.
- If the prototype legitimately uses a display face that is not vendored, add it to
  `config/fonts.json` with its licence. The capture reports unvendored families by name.

## References

- `references/deterministic-capture.md` — every source of non-determinism and how it is removed.
- `references/geometry-dump.md` — what the DOM geometry dump contains and how Compose matches it.
