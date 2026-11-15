# Deterministic capture — every source of variance and how it is removed

| Source | Symptom | Removed by |
| --- | --- | --- |
| Dev server / HMR | layout shifts between shots, extra overlay | production build + static preview |
| Animations | same screen differs every run | `reducedMotion: "reduce"`, CSS freeze (duration 0), Playwright `animations: "disabled"` |
| Caret blink | a black line appears in inputs | `caret: "hide"` + `caret-color: transparent` |
| Web fonts loading late | text reflows after screenshot | `await document.fonts.ready` + no network so a CDN font fails fast and deterministically — bundle the fonts instead |
| Network | random images, spinners, analytics beacons | request routing aborts everything except the app origin and data/blob URLs |
| Clock / date | greeting changes, timers differ | `Date` frozen via init script; `Date.now()` pinned |
| `Math.random()` | different generated artwork | seeded PRNG injected before app code |
| Scroll position | a list starts half-scrolled | route change resets scroll (the shell script scrolls `main` to 0 on navigation); verify per screen |
| Scrollbars | 15px layout shift, platform-specific look | CSS `scrollbar-width: none` and `::-webkit-scrollbar{display:none}` |
| Text hinting / LCD subpixel | fuzzy text edges | Chromium flags `--font-render-hinting=none --disable-lcd-text` |
| Zoom / DPR | everything scaled | `deviceScaleFactor` from `config/viewports.json`, never the default |
| Locale / timezone | date and number formats | `locale` and `timezoneId` from config |
| Responsive timing | breakpoint applied after first paint | wait for a stable `scrollHeight` + node count signature |

## The stability check

`capture-reference.mjs` waits until the signature `${scrollHeight}:${nodeCount}` stops changing
for 250 ms, then adds another 250 ms of quiet time. That is enough for a settled layout without
waiting seconds per shot.

## What is *not* deterministic and must be masked instead

- Live clocks and countdowns the app renders itself (mask the region, per screen).
- Randomised ids rendered as visible text.
- Video/canvas content.
- Anything the app fetches at runtime (it cannot, with the network off — but a bundled mock with
  an internal `setTimeout` can still land mid-transition: wait for the state, then shoot).

Masks are declared per screen in the capture spec, never globally, and both sides of the diff
receive the same mask so the score stays honest.
