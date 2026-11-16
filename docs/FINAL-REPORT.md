# ui-port — final report

Written against the specification in `docs/MASTER-PROMPT.md`. **Every fidelity number below is
copied from a CI run on branch `arena/a9a40385-ui-port` (PR #1)** and the run id is given next to
it. Anything that could not be measured is listed as a gap, not as a pass.

## 1. What is complete, and how it was proven

| Deliverable | State | Proof |
| --- | --- | --- |
| Plugin: 11 skills, 4 commands, 4 agents, 4 hooks | done | `node scripts/validate-plugin.mjs` → `OK — manifest, 11 skills, 4 agents, 4 commands, hooks, config and 20 referenced scripts` |
| Scripts (21) + tests | done | `npm ci && npm test` → **185 tests, 185 pass, 0 fail** |
| `config/` (pinned tools, viewports, thresholds) | done | enforced by `resolve-versions.mjs` |
| Docs (26 files incl. 6 phase reports and the build log) | done | `node scripts/lint-markdown.mjs` → `OK — 66 file(s)` |
| Static checks in CI | **green** | `ci-static` run [43809265679](https://github.com/Rohitjjn/Ui-Port/actions/runs/43809265679) |
| Unit tests in CI | **green** | `ci-unit` run [43809265653](https://github.com/Rohitjjn/Ui-Port/actions/runs/43809265653) |
| Hook matrix ubuntu/windows/macos in CI | **green** | `ci-hooks-matrix` run [43809265785](https://github.com/Rohitjjn/Ui-Port/actions/runs/43809265785) |
| `assembleDebug` of `testbed/SimpMusic` (baseline) | **green** | `ci-e2e-simpmusic` run [43683891163](https://github.com/Rohitjjn/Ui-Port/actions/runs/43683891163); APK artifact `simpmusic-debug-apk`, 299,225,803 B |
| Reference capture (Playwright, phone) + noise floor | **done** | `ci-capture-reference` run [43809265711](https://github.com/Rohitjjn/Ui-Port/actions/runs/43809265711); 0% same-side noise, effective floor 98.5%, all four phone screens 100% / SSIM 1.0 |
| Compose screenshot render + diff, in CI | **running, both screens below floor** | `ci-port-diff` run [43809265671](https://github.com/Rohitjjn/Ui-Port/actions/runs/43809265671) |
| Tablet and desktop layouts (B.5) | **not started** | — |
| Engine wiring (B.6) | **not started** | — |
| Debug APK as a downloadable artifact for the *ported* UI (B.7) | **not built** | — |
| Delivery ZIP attached to release `v0.1.0` | ZIP built, **not attached** | §6 |

## 2. Fidelity scores — per screen, per device

Only `phone` has been captured and ported. The numbers are the *current* CI state, plus the best
state this phase reached where that differs.

| Screen | Device | Pixel match | SSIM | Geometry | Status | Run |
| --- | --- | --- | --- | --- | --- | --- |
| `home` | phone 393x852 | **94.858%** | 0.738 | not measured | `building` (below 98.5% floor) | [43809265671](https://github.com/Rohitjjn/Ui-Port/actions/runs/43809265671) |
| `home` (best seen) | phone 393x852 | **94.958%** | 0.742 | not measured | `building` | [43795122804](https://github.com/Rohitjjn/Ui-Port/actions/runs/43795122804) |
| `library` | phone 393x852 | **86.916%** | see run | not measured | `building` | [43809265671](https://github.com/Rohitjjn/Ui-Port/actions/runs/43809265671) |
| `nowplaying` | phone 393x852 | not scored | — | — | reference present, candidate missing | [43809265671](https://github.com/Rohitjjn/Ui-Port/actions/runs/43809265671) |
| tablet | — | — | — | — | not captured | — |
| desktop | — | — | — | — | not captured | — |

Reading the table honestly:

- **No screen has reached the project's own 98.5% acceptance floor.** All three are `building`.
  `home` is 3.6 points short, `library` 11.6 points short, and `nowplaying` is not comparable yet
  because the reference for it is the full-player overlay captured on the home route (the port
  renders it, the reference file exists, but the pair has not been scored in a run where both
  sides were produced with the same content — the queued track differs between capture and
  fixture, see §5).
- **Geometry is not measured at all** (`-` in every report). The reference side writes
  `default.geometry.json`; the Compose side still has no `default.semantics.json`, so
  `diff-all.mjs` has nothing to compare and reports `null` instead of guessing. The candidate's
  own boxes *are* published as CI annotations and are what every correction in this phase was
  based on.
- The full iteration-by-iteration record for `home` (10 runs) is in
  `docs/phase-reports/phase-b4-phone-screens.md`.

## 3. What the numbers prove, and what they do not

Proven:

1. The loop is real. Playwright captures at 393x852 with a per-element geometry dump, Paparazzi
   renders the same viewport at 1 px per dp, `diff-all.mjs` produces pixel/SSIM/heat-map, and CI
   fails the build when a screen is below the floor. Ten iterations of `home` moved from **80.12%**
   to **94.96%** with every step attributed to a measured cause.
2. Three measured layout facts that no amount of reading the web source would have produced:
   the reference is the whole shell (fixed bottom nav + signed-out banner); the prototype's
   webfonts never load during capture because the capture blocks non-same-origin requests, so the
   reference is the browser's fallback stacks; and Paparazzi 2.0.0-alpha05.1 clamps a snapshot to
   1000 px on its long edge, so both sides must be compared at 1x.
3. The library screen's grid now matches the capture exactly where it was checked: title at
   y=36 (163x40 in the reference, one 40px line), chip row at y=108, first `.paper` tile at
   y=176 as 175x70, second column at x=203.

Not proven:

- That any screen is a faithful port. Below the floor is below the floor.
- That the residual is small. `home`'s remaining difference is concentrated in three bands
  (y=200–280 banner, y=640–700 card actions, y=780–850 nav) plus the cover artwork's vector
  shapes; `library`'s is concentrated at y=35–90 (header/kicker) and y=200–280 (tile row).

## 4. Known limits

16 documented conversion limits in `docs/LIMITS.md`, each with a fallback and the fidelity it
costs. The one this phase measured and had to reverse an implementation over is §5 (fonts):
bundling the real webfonts made the score *worse* (89.26% vs 94.96%) because the reference was
captured with fallback stacks. Both the measurement and the two ways out are recorded there.

## 5. Open items, in priority order

1. **`nowplaying` has no honest score.** The capture reaches the player by clicking the mini
   player on the home route, which queues the shelf's first track; the fixture renders `t1`. Until
   the same track is on both sides, a diff would measure different content, so it is reported as
   unscored rather than as a number.
2. **Geometry coverage.** Emit `default.semantics.json` from the screenshot test so the 1 dp /
   90% coverage criteria can be evaluated. The layout probes are the interim substitute.
3. **Font decision** (owner: capture config). Either allow same-origin fonts in
   `capture-reference.mjs` and switch `UiPortFonts` to the bundled families, or delete the bundled
   files. Both are two-line changes; the evidence for each is in `docs/LIMITS.md`.
4. **Iteration budget.** The plan allows 5 iterations per screen per device. `home` used 10 and
   `library` 6. Both stopped at a documented state, not at a passing state.
5. B.5 tablet + desktop, B.6 engine wiring, B.7 APK artifact and delivery ZIP.

## 6. Release

`v0.1.0` exists with source and notes but **no artifacts**: the environment could not upload
from here. The exact command is in `docs/RELEASE.md`:

```bash
gh release upload v0.1.0 dist/ui-port-v0.1.0.zip --clobber
```

The ZIP (132 entries, 0.66 MB) is built by `node scripts/package-zip.mjs`, which verifies that
`testbed/` build outputs are excluded, and the cleanup procedure that proves the plugin works
without the test bed is `docs/CLEANUP.md`.
