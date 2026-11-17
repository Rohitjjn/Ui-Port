# Research

Everything the plugin's formats rely on, with the source it was verified against. Access date:
2026-11-15. Where the environment could not reach a documentation host, the fact was verified
against a **working reference implementation** instead, and that is stated explicitly.

## Access notes (be honest about this)

| Host | Reachable | Consequence |
| --- | --- | --- |
| `github.com`, `codeload.github.com`, `api.github.com` | yes | upstream code and reference plugins can be read |
| `registry.npmjs.org` | yes | npm pins resolved for real |
| `docs.anthropic.com`, `developer.android.com`, `repo1.maven.org` | **no** | official docs pages and Maven metadata could not be fetched from this machine |

Because the documentation hosts were unreachable, the plugin/skill/agent/command/hook formats were
verified against Anthropic's own published plugin source (cloned and read, not remembered):

- `anthropics/claude-code` → `.claude-plugin/marketplace.json` (marketplace entry shape,
  `git-subdir` source, `renames`).
- `anthropics/claude-plugins-official` → `plugins/plugin-dev/.claude-plugin/plugin.json` (minimal
  manifest: name, description, version, author), `plugins/hookify/hooks/hooks.json` (the
  `{ "description", "hooks": { <Event>: [ { "matcher"?, "hooks": [ { "type": "command",
  "command", "timeout" } ] } ] } }` wrapper), and `plugins/plugin-dev/skills/*/SKILL.md`
  (frontmatter: `name`, `description`, optional `version`).
- `anthropics/claude-plugins-official` → `plugins/plugin-dev/agents/*.md` (frontmatter: `name`,
  `description` with `<example>` blocks) and `plugins/plugin-dev/commands/*.md`
  (frontmatter: `description`, `argument-hint`, `allowed-tools`).

The four things this repo therefore relies on, all observed in that source:

1. Plugin manifest lives at `.claude-plugin/plugin.json`; `name` + `description` + `version` are the
   minimum, author/license/homepage are additive.
2. Marketplace is a separate file at `.claude-plugin/marketplace.json` with `name`, `owner`,
   `plugins[]` (each with `name`, `description`, `source`, `category`).
3. Hooks live in `hooks/hooks.json` using the wrapper shape, addressed through
   `${CLAUDE_PLUGIN_ROOT}`, with a per-hook `timeout` in seconds.
4. Skills are `skills/<name>/SKILL.md` with `name` + `description` frontmatter, where the
   description is what decides triggering; supporting material goes to `references/` and is read on
   demand.

## Hook events used

| Event | Matcher | Used for | Exit contract |
| --- | --- | --- | --- |
| `SessionStart` | – | print a "resume available" hint from `.uiport/state.json` | exit 0, JSON on stdout with `hookSpecificOutput.additionalContext` |
| `PreToolUse` | `Write|Edit|MultiEdit|NotebookEdit|Bash` | block engine-file edits until approved | exit 2 + `{"decision":"block","reason":...}` blocks; exit 0 approves |
| `PostToolUse` | `Write|Edit|MultiEdit` | fast syntax sanity on edited Kotlin/TS | exit 0, optional `additionalContext` |
| `Stop` | – | block stopping once when the step worklog is stale | exit 0 + `{"decision":"block","reason":...}` |

Design rules applied to all four (they come from the documented failure modes): never run a build in
a hook, bound every hook with a timeout (10 s), and fail **open** — an internal error approves the
tool call rather than bricking the session. The Stop guard fires at most once per step per session
via a marker file in the OS temp directory, so it cannot loop.

## Playwright

Used as a library (`playwright` 1.64.1, Chromium), not as a test runner. The determinism levers the
capture script relies on — `newContext({ viewport, deviceScaleFactor, locale, timezoneId,
colorScheme, reducedMotion })`, `context.route()` for the network, `page.screenshot({ animations:
"disabled", caret: "hide" })`, `document.fonts.ready` — are all long-standing public API. The
browser binary itself is a ~150 MB download from `cdn.playwright.dev`, which this environment cannot
reach (decision D3 in `PLAN.md`).

## Compose screenshot testing options

| Option | How it renders | Fits this test bed? | Verdict |
| --- | --- | --- | --- |
| **Roborazzi** | Robolectric + the project's real Compose runtime, on the JVM | yes — `composeApp` already has `jvmTest`, and the app targets Compose 1.12 | **default**: no emulator, real Compose, `@Config(qualifiers)` for exact dp/density |
| **Paparazzi** | layoutlib, on the JVM | possible, but layoutlib is coupled to the AGP major | documented fallback for Android-only projects |
| **Compose Preview Screenshot Testing** (AGP plugin) | preview tooling | not yet: plugin is alpha and version-locked to AGP | optional, `needs-user-input` until it matches the project's AGP |
| Emulator + `screengrab` | real device image | most faithful (blur works), but slow and flaky | not the default; used only for motion review |

The deciding factor for a *pixel* comparison is determinism and density control, which the JVM tools
give directly. Blur is the known gap: `Modifier.blur` may not render under Roborazzi, which is
recorded in `docs/LIMITS.md` as `blur-unsupported` rather than treated as a defect.

## Diff maths

- **pixelmatch 7.1.0** — anti-aliasing-aware per-pixel comparison with a colour-distance threshold.
- **ssim.js 3.5.0** — structural similarity (11×11 windows), used as a second signal because pixel
  match over-weights large flat areas.
- **pngjs 7.0.0** — decode/encode in pure JS, so no native module is needed on any OS.
- Geometry comparison is ours (`scripts/lib/diff.mjs`): match by test id, then normalised text, then
  role, and require every box to be within 1 dp.

## What was deliberately not used

- No native image library (`sharp`, `opencv4nodejs`): they break on Windows and in sandboxes, and
  would make the "same number everywhere" claim false.
- No TypeScript compiler for the prototype scan: a parser would be more accurate but adds a heavy
  dependency and slows every run; the scanner's regex passes are unit-tested against the real
  prototype with exact expected counts.
- No LLM-based visual judging: the contract is numeric.
