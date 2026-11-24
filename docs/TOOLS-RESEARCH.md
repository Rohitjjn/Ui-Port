# Tools research

Every tool the plugin may install, why it is that one, and what was actually verified. The registry
itself is `config/tools.json`; this file records the reasoning and the checks.

## Fixed tools (installed once, after one approval)

| Tool | Pin | Verified how | Why this one |
| --- | --- | --- | --- |
| Playwright + Chromium | 1.64.1 | `registry.npmjs.org` metadata: published 2026-10-14, 31 days old at pinning time | the only practical way to run a React prototype headlessly with deterministic viewport/DPR, fonts, reduced motion and network control |
| pixelmatch | 7.1.0 | registry: published 2025-02-21 | anti-aliasing aware; the industry default for screenshot regression |
| pngjs | 7.0.0 | registry: published 2023-02-20 | pure JS PNG IO, so no native build on any OS |
| ssim.js | 3.5.0 | registry: published 2020-10-12 | stable, dependency-free SSIM; complements pixel match |
| yaml | 2.8.1 | registry: published 2025-08-05 | workflow/frontmatter validation in tests |
| Roborazzi | 1.53.1 | Maven (not reachable from this machine: verified by the consuming Gradle build) | JVM Compose screenshots with the project's own Compose version |
| ktlint | 1.7.1 | Maven (same caveat) | fast single-file lint for the PostToolUse hook |
| detekt | 1.23.8 | Maven (same caveat) | deeper static analysis for the verify step, never in a hook |

Age policy: a pin must have been public for at least 14 days (recorded in `config/tools.json`
`policy.minAgeDays`). Playwright was moved from 1.65.1 (1 day old) to 1.64.1 (31 days old) to obey
it — the registry lookup is what caught that.

## Deliberately on demand

| Tool | Status | Why not fixed |
| --- | --- | --- |
| Ponytail (`github.com/DietrichGebert/ponytail`) | `needs-user-input` | a token-saving code simplifier. For a pixel-fidelity port it is the wrong trade: simplifying diffed UI code erases the details the diff measures. Offered for engine-side work and reviews only, and the recommendation is recorded at the decision gate. |
| "REA / Reverse Engineer Anything" | `needs-user-input`, **`source: null`** | the repository could not be verified from an official source at 2026-11-15. The plugin therefore asks the user for the link instead of inventing a URL — a fake source would be worse than a missing one. |
| Compose Preview Screenshot Testing | `needs-user-input` | alpha and AGP-version-coupled; the test bed is already ahead of its published plugin |
| Valkyrie / SVG-to-Compose IDE plugin | `needs-user-input` | an Android Studio plugin, not a CLI. The plugin ships its own converter (`scripts/svg-to-compose.mjs`) for the SVG subset prototypes actually use, and points at the IDE plugin when the user has Studio. |

## Image diff stack choice

Two candidates were considered and one rejected:

1. **pixelmatch + pngjs + ssim.js** (chosen): pure JS, no compilation, identical numbers on Linux,
   macOS and Windows, runs in a hook, in CI and on a laptop with nothing installed.
2. **sharp / node-canvas based stacks**: faster on huge images, but native binaries that break on
   Windows, in Alpine images and in restricted sandboxes. A fidelity tool whose *measurement* is
   platform-dependent is not a fidelity tool.

The tradeoff accepted: PNGs above ~4 megapixels are slower in pure JS. Screenshots are capped by the
viewport table (1440×900 @1 is the largest), so this does not bite in practice.

## Compose screenshot tool choice

Roborazzi is the default (see `PLAN.md` D4 and `docs/RESEARCH.md` for the comparison table). The
short version: JVM-only rendering with the project's real Compose version and explicit density
config beats an emulator on determinism, and beats layoutlib on version coupling. Blur is the
documented gap.

## Sources of truth used at run time

- npm: `https://registry.npmjs.org/<package>` (full metadata, so publish dates are available).
- Maven: the Gradle build that consumes the artefact; the plugin never invents a Maven version.
- Everything else: if it cannot be resolved, the tool is marked `needs-user-input` and the plugin
  asks.
