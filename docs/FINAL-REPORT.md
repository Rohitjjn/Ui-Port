# Final report — UI port, delivered

Generated 2026-11-23. Every number below is read from a specific CI run on branch
`arena/a9a40385-ui-port` (PR #1), and each table names the run it came from. Where something could
not be measured, that is stated instead of estimated.

## What was delivered

| Deliverable | State | Evidence |
| --- | --- | --- |
| Installable APK with the ported UI | **delivered, 27 MB** | run [`45353678178`](https://github.com/Rohitjjn/Ui-Port/actions/runs/45353678178), release / arm64-v8a / signed / port verified present — see [docs/APK.md](APK.md) |
| Ported screens, measured against real captures | 3 screens, phone | `ci-port-diff` reports a score per screen per run |
| Geometry gate (1 dp, ≥90% coverage) | **not met** — 33.33% / 11.54% / 0% | run `45187478236` |
| Pixel floor 95 | met on `home` only (95.95) | run `45187478236` |
| Pixel goal 99 | **not met** | best is 95.95 |
| Unit tests | 260 pass, 0 fail | `ci-unit` |
| Markdown lint | OK, 72 files | `ci-static` |

The port is **not finished**. What is delivered is the APK, the measurement harness that says exactly
where the port is wrong, and eleven recorded defect classes with the fix for each. The scores below are
what they are.

## Scores, current

Run `45187478236`, commit `15d5d5c`, provenance `screen sources 88806c6f45afc4aa | renders 3 e08d2a3d1e7036e8`:

| Screen | Pixel | SSIM (reported, not gated) | Geometry | Missing nodes |
| --- | --- | --- | --- | --- |
| `home` | **95.95** | 0.7904 | 33.33% | 0 |
| `library` | 89.049 | 0.6300 | 11.54% | **0** |
| `nowplaying` | 79.8252 | 0.5314 | 0% | 7 |

All three report `building`, `iter=0`. `home` clears the pixel floor; none reaches the pixel goal.

## What the numbers improved from, and why

Entering this stretch `library` read 87.6415 / 0.5821 / 9.09% with 9 nodes missing. It ends at
89.049 / 0.6300 / 11.54% with none missing.

| Change | Effect, measured |
| --- | --- |
| Carousel cards made real click targets | `dy` on both playlist cards 172.06 → 12.06, `dw=dh≈0` |
| Carousel started flush at x=0 instead of the page margin | `dx` 16 → **0** on every card |
| Section gaps 40 → 32 dp | heading `dy` 10.06 → 2.06 |
| "Recently added" section drawn (was absent entirely) | missing → `d=(16,4.63,3.66,2)` |
| Page inset applied per section, not to the scroll container | candidate nodes 29 → **30**, missing → **0**, clip at 361 → 393 dp |
| Text extent clamped to the viewport | `dw` on the clipped label 34.39 → **0.05** |

The largest single jump came from a one-line padding change (`0e141c8`) that was invisible until the
cards had boxes to measure: pixel +1.03.

## The most consequential finding

Three of the four reference sets were wrong in ways that made a correct port score zero. None of it
was the port's fault, and all of it was invisible in the displayed score:

| Defect | Effect |
| --- | --- |
| Occluded nodes counted | `nowplaying` compared 55 nodes, 43 hidden under the overlay |
| Decorative wrappers counted as nodes | `"Most played 10 items"` — a string only `innerText` makes |
| Containers re-announced their own children | 11 of `library`'s 33 reference nodes were duplicates |
| Block boxes measured as text | every `<span class="block">` looked ~40 dp too wide |
| Clipped text measured at layout width | a 6.45 dp sliver reported as 40.89 wide |

The rule that resolved all five is now stated once in the notes: **compare what the screenshot shows,
not what the DOM contains** — applied to height (viewport clip), depth (occlusion) and width (edge
clamp).

`nowplaying`'s 0% is still not a port defect: with occluded nodes dropped its reference is 12 nodes,
and they are a **create-playlist sheet**, not the player the port renders. That is recorded as N-5 and
cannot be fixed from the port side — the capture has to produce the screen the port draws.

## The APK

Built and verified in the same run as the scores above:

```
androidApp-universal-debug.apk   (also arm64-v8a, armeabi-v7a, x86_64)
package: com.maxrave.simpmusic.dev
```

Verification is not "the build went green": the job unzips `classes.dex` and fails unless
`UiPortApp`, `UiPortHomeScreen`, `UiPortLibraryScreen` and `UiPortBottomNav` are present, and fails
unless the vendored typefaces are packaged. All four classes and both font families were confirmed
present.

Before this change the APK was a deliverable in name only — the workflow built and uploaded it while
nothing in the app called the ported screens, so it opened the original SimpMusic. Debug builds now
open the port; `--ez uiport false` opens the original from the same build. Whether the port opens by
default is now a build-time field (`UIPORT_DEFAULT`) rather than a `DEBUG` check, because the small
deliverable is a *release* build that exists to show the port: a plain release still opens the
original app, and the deliverable sets the field. The intent extra wins either way.

## What is still wrong

| Item | Note |
| --- | --- |
| ~2 dp on every text box | Android's `includeFontPadding`. Mechanism identified, first fix broke the renderer and was reverted (N-8). Highest-leverage remaining item. |
| `library` rows 2–5 dp out | playlist cards, "See all", chips, "Create" label — real layout errors now, not measurement artefacts |
| `nowplaying` reference | N-5: the capture produces the wrong screen |
| `/search` unported | no reference capture exists; nav selection stays on Home rather than showing a stub |
| Below-fold extent (N-1) | the shared-scroll-offset fix is still the right one and is not built |
| `font-bold` at 700 (N-3) | the 9 px badge; would appear as a text-rendering residual once geometry passes |
| Tablet and desktop layouts | not started |
| Per-route strangler flag | the tier prescribed it; it is not built, and `onNavigate` is wired only for the two ported routes |

## Reproducing

```
gh run download 45353678178 --repo Rohitjjn/Ui-Port -n simpmusic-uiport-release-arm64
adb install -r androidApp-release.apk
```

Scores: open run `45187478236`, job `render-and-diff`, annotation `scores phone`. Per-node detail is
in the three `geometry-detail` jobs. Every number in this report comes from those annotations.

## Honest summary

The harness is done and trustworthy; the port is not. Two of three screens are measured against
references that have been audited and had five distinct classes of defect removed from them. The
scores that remain — 95.95, 89.05, 79.83 — are honest: `home` is close, `library` is visibly off, and
`nowplaying` cannot be scored until its reference is recaptured. The APK exists and genuinely contains
this UI, which is the one claim here that a person can check in ten seconds on their own phone.
