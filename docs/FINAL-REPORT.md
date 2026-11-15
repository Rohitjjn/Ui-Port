# ui-port — final report

Written against the specification in `docs/MASTER-PROMPT.md`. Every number below comes from a
command run in this repository; anything that could not be measured is listed as a gap, not as a
pass.

## 1. What is complete

| Deliverable | State |
| --- | --- |
| Plugin (11 skills, 4 commands, 4 agents, 4 hooks) | done, validated by `scripts/validate-plugin.mjs` |
| Scripts (16) | done; 176 tests cover logic, CLIs and an end-to-end synthetic run |
| `config/` (tools with pinned verified versions, viewports, thresholds) | done, 14-day age policy enforced by `resolve-versions.mjs` |
| Templates (Roborazzi screenshot test + semantics dump, Playwright spec, 3 workflows) | done |
| Docs (14 files + phase reports 0–9 + build log) | done, linted |
| Release `v0.1.0` | published (source + notes); ZIP asset could not be uploaded from here |
| Cleanup procedure | written; verified again at release time: `testbed/` moved away → 164 pass / 12 skipped / 0 fail |

## 2. Measured numbers

- Tests: **176 pass / 0 fail**, 32 files, ~11 s (`npm test`).
- Deletable test bed: with `testbed/` moved away, **164 pass / 12 skipped / 0 fail**.
- Plugin validation: `OK — manifest, 11 skills, 4 agents, 4 commands, hooks, config and 15 referenced scripts`.
- Markdown lint: `OK — 64 file(s)`.
- Scanners against the real fixture: prototype **23 screens / 35 files / 5 core libraries / 4 stores**;
  SimpMusic **1160 Kotlin files (349 UI / 666 engine / 145 shared), 34 screens, 35 ViewModels,
  64 engine entry points, 27 modules, 249 protected globs**.
- Capture plan for the fixture: **66 units / 102 screenshots** across phone, tablet, desktop.
- Fidelity contract: pixel goal **99.9%**, acceptance floor **98.5%**, SSIM floor 0.995 / goal 0.999,
  geometry **1.0 dp** with ≥90% node coverage, max **5** iterations per screen per device.

## 3. Fidelity scores per screen and device

**None.** Not one real screenshot pair exists yet: the environment has no browser download and no
JDK/Android SDK, and Actions cannot be dispatched from here. Reporting numbers here would be
invention. `docs/PLAN.md` (D1–D3) and `docs/phase-reports/phase-8.md` give the exact first-run
sequence to produce them.

## 4. Known limits

16 documented conversion limits in `docs/LIMITS.md`, each with a fallback, the fidelity it costs and
the log format: blur, blend modes, CSS filters, shadows vs elevation, font rasterisation, text
rendering, subpixel layout, platform chrome, scrollbars, and six more. Masked regions are filled in
both images with one solid colour, and the configured mask is never allowed above the measured noise
floor minus one point.

## 5. Remaining risks

R1 new AGP/Gradle/SDK versions on a runner · R2 cold Gradle cache on a KMP project · R3 web fonts
unreachable during capture · R4 JVM screenshot tools not rendering blur/blend · R5 corrupt
`state.json` (mitigated and tested) · R6 hook false positives (fail-open by design, tested) ·
R7 Actions minutes.

## 6. Recommended next steps

1. Enable Actions on the repository, run `ci-static`, `ci-unit`, `ci-hooks-matrix`.
2. Run `ci-e2e-simpmusic.yml` manually to get the first baseline `assembleDebug` and a real
   Playwright capture; then produce the first three real diffs (home, library, now-playing, phone).
3. Attach `dist/ui-port-v0.1.0.zip` to the release (`docs/RELEASE.md`).
4. Only then claim fidelity numbers — per screen, per device, from `report.json`.
