# Phase D — the port loop, driven by the geometry gate

Generated 2026-11-17. Every number here is read from a CI run of
`.github/workflows/ci-port-diff.yml` on branch `arena/a9a40385-ui-port` (PR #1). The run id is
given next to each table, and the provenance line of that run is quoted with it, because a score
without the commit and the render hash it came from is a number nobody can re-derive.

## What D asked for

Port the screens in one batch, slice or strangler order — the tier section C measured (LARGE,
strangler) — and drive each iteration from measured differences rather than from what looks close.

## 1. The measurement was not measuring

Entering D, all three screens read `geom=0`. That number was true and useless: it said nothing was
within tolerance, and left two very different causes indistinguishable — a systematic text-metrics
offset (N-2's hypothesis) and a layout in the wrong place. Ten rows of `dx/dy` cannot separate them
either, and the full data lives in an artifact this environment cannot download.

So the first work in D was on the measuring instrument, not on the port:

| Instrument | Problem it removed |
| --- | --- |
| Failure signature (`summariseDeltas`) | `0%` could not distinguish one common offset from scattered individual errors; the signature names which, with the nearest and furthest miss in dp and one real `ref`/`cand` box pair |
| Phantom pairings | a reference label with no counterpart was matched to any node sharing a *role*, producing a confident row about an unrelated element and hiding the fact that the label never rendered |
| Canonical dedupe | the DOM emits one label twice (`<p>` and `<span>` for the same count); both were counted, so one missing label read as two |
| Missing-row ordering | rows sorted by delta buried "this section never rendered" under eighteen 2 dp near-misses |
| Occlusion | a full-frame overlay leaves the page beneath it in the DOM, so `nowplaying`'s reference counted 43 nodes hidden by the player — a reference nothing could satisfy |
| Coverage visibility | a screen with no rows and a screen that passed looked identical in an annotation list; the header now states canonical counts and row count |
| Drift reporting | a 0.09 pp loss sat under the 0.15 regression line and was therefore invisible |

Each of those was found by a number not adding up, and each has a unit test.

## 2. Two port fixes, both named by the gate

### 2.1 The nav bar was 72 dp with the link's padding applied twice

The per-node table reported all three nav labels at `34.5x6` against a reference `64x65.94`. The
arithmetic:

```
NavLink = py-2 (8) + pill (32) + gap (2) + label (16) + py-2 (8) = 66 dp
reference: link measures 64x65.94, bottom edge y=851.94 in an 852 frame
```

The port had `height(72.dp)` **and** `padding(vertical = 8.dp)` on the Row **and**
`padding(vertical = 8.dp)` on the Column: the link's own `py-2` applied twice, in a bar 6 dp taller
than the reference. That left 56 dp for a Column needing 66, and Compose clipped the label to
exactly the 6 dp measured — on all three items, which is why it looked systematic.

After the fix: label boxes **6 dp → 16 dp** (the full line height, unclipped).

**Cost, stated plainly:** this corrected bar height cost `home` 0.0906 pp (96.0406 → 95.95) and
gained `library` 0.0454 pp (87.5961 → 87.6415). Both sat under the 0.15 regression line, so nothing
reported them until the runs were compared by hand — which is why `diff-all` now reports every
downward move separately from regressions.

### 2.2 The nav link had no semantics node at all

The label was the right size but still compared as `34.5x16` at y=828 against the reference's
`64x65.94` at y=786.06. The gap is not layout: the DOM's labelled node for a nav item is the whole
`<a>`, while an unmerged Compose tree emits a node only when it carries text or a testId — and a
Column holding a pill and a label carries neither. So the reference had one 64×65.94 node and the
port had a text run.

`selectable(selected, role = Role.Tab, onClick)` gives the link a node with a role, which is what
the DOM has and what a navigation target should be regardless.

## 3. Where the port stands

Run `45107952954`, commit `e0b2bbc`. (`library` entered D at 87.6415 / 0.5821 / 9.09%.):

| Screen | Pixel | SSIM (not gated) | Geometry coverage | Iter | Entering D |
| --- | --- | --- | --- | --- | --- |
| `home` | 95.95 | 0.7904 | **33.33%** | 0 | geom 0% |
| `library` | 89.0727 | 0.6307 | **11.54%** | 0 | geom 0% |
| `nowplaying` | 79.8252 | 0.5314 | 0% | 0 | geom 0% |

None of the three is accepted, and all three are still `building`. `home` clears the pixel floor and
fails geometry; `library` and `nowplaying` fail both. What changed is that every failure now has a
named cause and a next step:

- **`home`** — 3 of 10 canonical nodes match. Remaining rows: the hero heading is 20 dp narrow
  (`209x20.3` vs `189x20`), the login banner's text 12.23 dp narrow, "Log in" 19.77 dp narrow, the
  weather strip 139 dp narrow, and one paragraph (`"Recorded over one winter in a deconsecrated
  chapel…"`) is absent. These are width errors on wrapped text, i.e. the same class of problem:
  Compose's line breaking produces a different box than Chromium's for the same font and size.
- **`library`** — 44 reference nodes against 28 candidate. The missing ones are section headers
  whose labels are `"Most played 10 items"`, `"Downloaded 4 items"`: in the DOM the count is part of
  the heading's text, in the port it is a separate node. Content exists; the canonical comparison
  sees it as absent.
- **`nowplaying`** — the reference is not the player. With occluded nodes dropped it is 12 nodes,
  and they are a create-playlist sheet ("Create", rows at y≈483–594), not `UiPortNowPlayingScreen`.
  This is N-5, and it means the screen's 0% has been measuring the wrong screen.

## 4. What the tier said, and whether it held

Section C measured `LARGE` and prescribed a strangler with a per-route flag. The flag is not yet in
place, and D has been a single-screen loop instead — deliberately: there is no point gating a
half-ported route behind a flag, and the per-screen work is what the gate is making possible. The
tier's other consequence did hold and mattered: at two screens' worth of near-misses and one
screen's worth of missing content, a single batch would have produced one unreviewable change and
no way to say which of the two nav fixes had helped.

An honest gap: the flag plumbing and the slice order are described in
`.uiport/maps/run-plan.md`'s template but not built, and `onNavigate` on the bottom nav is still a
no-op. That is the next step, not something D completed.

## 5. Still open

| Note | Effect |
| --- | --- |
| N-1 below-fold scroll extent | `library`'s 44-vs-28 split is partly content below 852 dp; the shared-scroll-offset option is still the right fix |
| N-3 `font-bold` at 700 | the 9 px badge; would show up as a `text-rendering` residual once geometry passes |
| N-5 `nowplaying`'s reference | blocks any meaningful score for that screen |
| Text width on wrapped headings | the dominant remaining class of error on `home`, not yet investigated as such |
