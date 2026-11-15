# Master build prompt

This is the verbatim specification the `ui-port` plugin was built against, kept in the repository so
the delivered plugin can be checked against what was asked for. It is a historical document: where
this build departs from it, the departure is recorded in `docs/PLAN.md` (decisions) and in the phase
reports. Nothing in this file is an instruction to a later agent.

<!-- lint-verbatim --> The body below is the specification exactly as delivered, including its own
headings and long lines. Do not reflow it: a reformatted specification is no longer evidence of what
was asked for.

# ui-port: Master Build Prompt

You are an autonomous senior engineer working in agent mode with access to my GitHub repo `ui-port`. Your job is to build, test and ship a complete **Claude Code plugin** called `ui-port`, and to prove with real CI runs that it works. Read this whole prompt before doing anything. Work phase by phase. Do not skip phases.

---

## 1. Mission

Build a plugin that lets an AI coding agent take a **web-app UI prototype** (React/TSX, built with an AI tool or by hand) and re-create it **as faithfully as possible in Jetpack Compose** inside an existing Android project, then wire it to that project's existing logic ("core engine"), test it, and deliver the result.

Example: a user takes the open-source app SimpMusic, has a new UI designed as a React web app (because it can be previewed live in a browser), and wants that exact UI inside the real Android app.

The plugin is for global users. **Everything inside the plugin must be written in English** (skills, commands, agents, hook messages, prompts, README, docs, templates). Only the chat with me may use any language.

Fidelity goal: visual match as close to 100% as the platform allows (aim for 99.9% pixel similarity, with a measured and documented acceptance floor, see section 3.10). Differences caused by real platform limits are allowed but must be measured, explained and logged.

---

## 2. Current repo state and test bed

- Repo `ui-port` currently contains only `README.md` and one `.zip` at the root. The zip contains a React (TSX) prototype of a new UI for SimpMusic.
- Open-source test app to clone: https://github.com/maxrave-dev/SimpMusic
- Put the clone in its own folder `testbed/SimpMusic/` so I can delete it later. Put the unzipped prototype in `testbed/prototype/` (keep the original zip untouched). Plugin code must never depend on anything inside `testbed/`.
- Record the SimpMusic commit SHA and its license in `testbed/SOURCES.md`. Keep its LICENSE file. Check the license before copying anything, and never copy SimpMusic code into the plugin folders.
- Decide, and document, whether to commit the SimpMusic files as plain files (strip its nested `.git`) or clone it at CI time. Default: commit as plain files in `testbed/SimpMusic/` so CI is reproducible, and mention the repo size impact.

---

## 3. Product specification (what you are building)

### 3.1 Inputs and outputs
- Inputs: an Android project (may contain old UI + engine, or only the engine, or nothing) and a React prototype (any size, any libraries).
- Outputs inside the user's project: new Compose UI, wiring to the engine, tests, a `.uiport/` folder with maps, reports and worklogs, and (on request) a source ZIP and/or a pull request.

### 3.2 Device targets (new, mandatory question)
The prototype may contain layouts for phone, tablet and desktop. The plugin must ask the user which to build: **phone only, tablet only, desktop only, any combination, or all three**, and must support building all of them.
- Detect responsive behavior in the prototype (breakpoints, media queries, Tailwind `sm/md/lg/xl`, container queries, layout components that change per width). Report what it found per screen.
- Implement adaptive layouts with Compose window size classes (compact / medium / expanded) and a viewport table in `config/viewports.json` (default, configurable): phone 393x852, tablet 834x1194, desktop 1440x900, device pixel ratio 2 (desktop may use 1).
- Desktop: detect the project type. If the project has a Compose Desktop / Kotlin Multiplatform desktop target, build there. If it is Android-only, build the large-screen adaptive layout (expanded window class) and explain the limits to the user.
- Screenshot and diff work is done per device target.

### 3.3 Project cases (auto-detect, then confirm with the user)
- **Case 1, old UI + engine exists:** map both, adapt the new UI to the engine, wire everything.
- **Case 2, engine only, no UI:** map the engine, build the new UI, wire it, ask the user about prototype features that have no engine support.
- **Case 3, nothing exists (only the prototype):** map the prototype, infer a rough engine design, write it up in a design document, scaffold it, wire it.

### 3.4 Execution modes (environment check)
Preflight detects the environment and classifies it:
- `LOCAL_FULL`: user's own computer with Android SDK/JDK/Node available. Run everything locally.
- `CI_ONLY`: no heavy tooling locally, but a GitHub repo is connected. Run builds, screenshots and tests in GitHub Actions; light work stays local.
- `HYBRID`: light work locally, heavy work in Actions.
- `LIMITED`: no heavy tooling and no GitHub. Explain the limits clearly, do what is possible (mapping, code generation, static checks) and give the user exact steps to finish elsewhere.
The user can override the detected mode. Ship ready-to-use workflow templates in `templates/github-actions/`.

### 3.5 Workflow (this is the core of the plugin)

**Step 0, Preflight (silent detection plus one approval batch)**
- Detect OS, Node, JDK, Android SDK, Gradle wrapper, git, `gh`, GitHub connection, available disk.
- Detect project case and device-target hints.
- Build a tool install plan from the tools registry (3.9). Show it, get approval once, then install and pin versions.

**Step 1, Maps**
- Map the user's current app: screens, navigation, UI-to-engine calls, state flow, DI, data models, which files are UI and which are engine. Output `.uiport/maps/app-map.md`.
- Map the prototype the same way: screens, routes, components, state, handlers, data shapes, assets, fonts, animations, responsive rules. Output `.uiport/maps/prototype-map.md`.
- Produce `.uiport/maps/wiring-plan.md`: for every prototype screen/control, which engine call or state it must use, what is missing, and what is extra.

**Decision Gate (one batch of questions, asked only after Step 1)**
1. Device targets (phone / tablet / desktop / combination / all).
2. Where heavy tasks run (confirm detected execution mode).
3. Use the Ponytail plugin to save tokens? (Recommend: not for UI conversion, because it can simplify away pixel details; fine for engine work and reviews.)
4. For every prototype feature that the engine does not support: **build it in the engine** or **remove it from the UI** (per feature).
5. Permission to edit engine files (default: no; see hooks).
6. Delivery options (ZIP, branch/PR, both).

**Step 2, Analysis and preparation**
- A. Run the prototype locally. With Playwright, visit every screen and every meaningful state (empty, loading, error, modal, hover/focus where relevant) at each chosen viewport. Save screenshots and a DOM geometry dump (element text, role, bounding box, key computed styles) to `.uiport/reference/<device>/<screen>/`. Freeze animations for the capture. Write notes where needed.
- B. Read the prototype source. For every imported library, find the closest Compose/Android equivalent **using the latest stable versions** (resolve from Maven Central / Google Maven / official docs at run time, check compatibility with the project's AGP/Gradle/Kotlin/Compose versions). Output `.uiport/imports-map.md` with: library, usage, Compose alternative, version, risk, fallback.
- C. Split the UI into screens and reusable components and create the Kotlin package/file structure (empty stubs plus a plan) in `.uiport/screens-plan.md`.
- D. Inventory everything that is not plain layout: animations, transitions, gestures, vector/SVG art, icons, shapes, gradients, shadows, blur/glass effects, fonts, images. Output `.uiport/motion-and-assets.md` so they can be converted separately and then embedded.
- On-demand tools may be installed later when needed (with user approval).

**Step 3, Port loop**
- Build one screen at a time, per device target. Write **stateless composables driven by fake fixture data first**, so appearance can be matched before the engine is involved.
- After each screen: render a Compose screenshot, run the diff against the reference, read the diff report, fix, repeat. Cap the loop (see 3.10).
- After screens match, convert animations, transitions, vector art, shapes and effects and embed them. Re-run diffs.
- Handle extra features exactly as the user decided at the gate (remove from UI, or add to the engine through the wiring-engineer agent with tests).

**Step 4, Wiring**
- Replace fixture data with the real engine, following `wiring-plan.md`: ViewModels/state holders, navigation, events, lifecycle, threading. Engine files are protected (3.8).

**Step 5, Verify and fix**
- Run the project's build, unit tests, lint, screenshot regression tests and a smoke test. Fix problems in an autonomous loop. If the failure is in appearance, return to Step 3 for that screen only; if it is in analysis, return to Step 2 for that part only.
- When everything passes, update the project's docs, write the final report, and package the delivery.

**Worklog (mandatory for every step)**
Inside the user's project keep `.uiport/worklog/`. One markdown file per step: `step-0-preflight.md` ... `step-5-verify.md`. Each contains: what the agent did and why, the context and decisions, commands run, results, changelog of files touched, problems and fixes. Also keep `.uiport/worklog/CHANGELOG.md`.

**Final delivery**
On request: ZIP of the full project (new UI + old engine) **including** the `.uiport/worklog/` folder, built by a script that excludes build outputs and caches. If changes were made through GitHub, give the branch and PR links.

### 3.6 Artifacts layout in the user's project
```
.uiport/
  state.json
  answers.json            (optional, headless mode)
  tooling.md              (pinned tool versions and why)
  engine-paths.json       (protected engine globs)
  maps/ app-map.md  prototype-map.md  wiring-plan.md
  imports-map.md  screens-plan.md  motion-and-assets.md
  reference/<device>/<screen>/   (web screenshots + geometry JSON)
  output/<device>/<screen>/      (compose screenshots + diff images + reports)
  worklog/ step-0..step-5 .md  CHANGELOG.md
```

### 3.7 `state.json` (resume support)
Define and document a versioned schema: plugin version, case, execution mode, device targets, chosen options, current step, per-screen status per device (pending / building / matched / accepted-with-notes / blocked), iteration counts, last scores, protected-path approval flag, timestamps. `/uiport-resume` must continue from it without redoing finished work.

### 3.8 Hooks (cross-platform, written in Node.js, no bash-only scripts)
Use `${CLAUDE_PLUGIN_ROOT}` for paths. Verify event names and behavior in the official docs before writing them. Required hooks:
- **Engine protect (PreToolUse):** block edits or destructive commands touching paths in `engine-paths.json` unless `state.json` has an approval flag. The block message must tell the agent how to ask the user.
- **Worklog guard (Stop):** if a step is in progress and its worklog file was not updated, block stopping once with a clear instruction.
- **Light syntax check (PostToolUse):** only fast checks on edited Kotlin/TS files (formatting/lint). Never run a full Gradle build in a hook.
- **State sanity (SessionStart):** if `.uiport/state.json` exists, print a short "resume available" hint.
Hooks must be fast, fail safe (never brick the session), and have unit tests.

### 3.9 Tools registry (`config/tools.json`)
Each entry: id, purpose, type (npm / maven / github-plugin / cli), source URL, pinned version, install command, `requiresApproval`, `phase`.
- **Fixed (installed at Step 0 after one approval):** Playwright with Chromium, an image diff stack (e.g. pixelmatch + ssim.js + pngjs, or an equivalent you justify), a Compose screenshot-testing tool (choose and justify among Paparazzi, Roborazzi, or Google's Compose Preview Screenshot Testing, based on compatibility with the target project and effect support such as blur), Gradle wrapper usage, ktlint/detekt, an SVG-to-ImageVector conversion approach.
- **On demand (only when needed or when the user asks):** Ponytail (https://github.com/DietrichGebert/ponytail), REA / "Reverse Engineer Anything" (find the real repo; if you cannot verify it, set `url: null`, `status: needs-user-input` and make the plugin ask the user for the link), plus any other tool the task requires.
- Never invent URLs or versions. Resolve the latest **stable** versions from official sources at build time, record the date, and prefer versions that have been public for at least two weeks. Never auto-install anything without approval. Warn users that plugin hooks and scripts run on their machine.

### 3.10 Visual fidelity contract
- Same viewport, same device pixel ratio / density, same fixture data, same bundled fonts (download the web fonts and add them to the Android project), no network, animations frozen at a defined time, system bars excluded or masked, dynamic regions masked.
- Metrics: pixel-match percentage (with anti-aliasing tolerance), SSIM, and a heat-map image. Also compare **geometry**: DOM element bounding boxes versus Compose semantics-node bounds (tolerance about 1dp) for text and key containers.
- First **measure the noise floor**: web-vs-web re-render and Compose-vs-Compose re-render, so real differences are separated from rendering noise. Store it in config.
- Targets (all configurable): goal 99.9%, acceptance floor default 98.5%, **max 5 iterations per screen per device**. After the cap, a screen can be "accepted with notes" only if it is above the floor and every residual difference is explained by a category (font rasterization, shadow, blur, sub-pixel layout, unsupported effect). Otherwise mark it blocked and ask the user.

### 3.11 Known conversion limits (ship as `skills/.../references/known-limits.md`)
Cover at least: CSS `backdrop-filter` and glass effects, `mix-blend-mode`, CSS filters, blur (platform/API dependent, and may not render in JVM screenshot tools), box-shadow versus elevation differences, font metrics and line-height differences, text rendering, CSS grid edge cases, scroll physics, sticky/fixed positioning, 100vh and safe areas, `framer-motion`/GSAP/CSS animation mapping to Compose animation APIs, Lottie, chart libraries, icon libraries to `ImageVector`, images/SVG, dark mode, RTL. For each: what to do, what loss to expect, how to log it.

### 3.12 Headless mode
If `.uiport/answers.json` exists (or an env flag is set), the plugin must take decision-gate answers from it instead of asking. This is needed for CI tests.

---

## 4. Target repository layout

```
ui-port/
  .claude-plugin/plugin.json
  .claude-plugin/marketplace.json
  commands/            uiport-start.md  uiport-resume.md  uiport-status.md  uiport-package.md
  skills/              preflight  map-app  map-prototype  plan-screens  capture-reference
                       port-screen  port-motion-and-assets  visual-diff  wire-engine
                       verify-and-fix  finalize-delivery  (each with SKILL.md + references/)
  agents/              mapper  screen-builder  diff-reviewer  wiring-engineer
  hooks/hooks.json
  scripts/             (Node.js: capture, diff, state, worklog, geometry-compare, package-zip, preflight)
  config/              tools.json  viewports.json  thresholds.json
  templates/           github-actions/  compose-screenshot-test/  playwright/
  tests/               unit/  integration/  behavior/
  docs/                PLAN.md  RESEARCH.md  TOOLS-RESEARCH.md  testbed-report.md
                       build-log/  phase-reports/  ARCHITECTURE.md  LIMITS.md
  testbed/             SimpMusic/  prototype/  answers/  SOURCES.md   (deletable at any time)
  .github/workflows/   ci-static.yml  ci-unit.yml  ci-e2e-simpmusic.yml  ci-hooks-matrix.yml
  README.md  LICENSE  CHANGELOG.md
```
Skill rules: precise `description` frontmatter so skills trigger correctly, a short `SKILL.md` body, heavy details in `references/` loaded on demand, one job per skill. Verify the exact plugin, skill, agent, command and hook formats in the official Claude Code documentation first and record the links in `docs/RESEARCH.md`. License the plugin as MIT unless I say otherwise.

---

## 5. Build phases

Work on branches named `phase-N-short-name`, open one pull request per phase, merge to `main` only when CI for that phase is green, and never force-push. After each phase write `docs/phase-reports/phase-N.md` (what was built, CI run links, test results, open risks, decisions) and give me a short summary. Ask me a question only if you are truly blocked; otherwise decide, document the decision, and continue.

### Phase 0: Recon, research, baseline (no plugin code yet)
- Read the README. Unzip the prototype into `testbed/prototype/`. Inspect its stack (package.json, libraries, screens, breakpoints, fonts, animation libraries, assets, state handling). Write `docs/testbed-report.md`.
- Clone SimpMusic into `testbed/SimpMusic/` as described in section 2. Report: modules, whether it has Desktop/KMP targets, where UI ends and engine begins, DI, navigation, state management, Gradle/AGP/Kotlin/Compose versions, build requirements (secrets, keys, large downloads), repo size.
- Research the official docs (Claude Code plugins, skills, hooks, subagents, marketplace; Playwright; the Compose screenshot-testing options) and write `docs/RESEARCH.md`. Research Ponytail and REA into `docs/TOOLS-RESEARCH.md`.
- Create a baseline workflow that builds SimpMusic (`assembleDebug`) in GitHub Actions with Gradle caching. **The baseline build must be green before any UI work.** If it cannot build, diagnose and fix the workflow or report the blocker with evidence.
- Write `docs/PLAN.md`: your refined plan, risks, and decisions.
- Exit: baseline build green in Actions, research docs and plan committed.

### Phase 1: Skeleton and foundations
- Create the plugin skeleton, manifest, marketplace file, commands (stubs with real logic outlines), `state.json` schema and a tiny state library, worklog helper, thresholds/viewport config, and `ci-static.yml`.
- Static checks: JSON schema validity, frontmatter validation for every skill/agent/command, link/path checks, Markdown lint, hook script lint. If the Claude Code CLI offers a plugin validation command, run it in CI.
- Exit: static CI green, plugin manifest verified against official docs.

### Phase 2: Preflight, decision gate, tools registry
- Build the preflight skill and script (environment classification, case detection, tool install plan), the tools registry with pinning logic, the approval flow, and the decision gate (including the device-target question).
- Implement headless mode (`answers.json`).
- Unit tests: environment classification with mocked environments, registry validation, answers parsing, resume logic.
- Exit: unit CI green, behavior of all four execution modes demonstrated by tests.

### Phase 3: Mapping
- Build `map-app`, `map-prototype`, `plan-screens` (and the `mapper` agent): reusable procedures, output templates, and helper scripts (for example a TSX import/route/component scanner and a Kotlin module/screen scanner) so mapping is accurate and does not depend on the model reading every file.
- Keep maps compact. Large projects must be handled with a per-screen/per-module chunking strategy to avoid context overflow.
- Test on `testbed/`: generate real maps for SimpMusic and the prototype, and review their quality yourself. Commit them under `testbed/expected/` as references.
- Exit: maps for both sides generated in CI and sanity-checked by script (every prototype screen appears in the map, every engine entry point is referenced).

### Phase 4: Capture and diff engine
- Build `capture-reference` (Playwright multi-viewport crawler with deterministic mode: frozen animations, fixed fonts, no network, geometry dump, state-triggering helpers) and `visual-diff` (pixel, SSIM, heat-map, geometry compare, noise-floor calibration, JSON + markdown reports).
- Provide Compose screenshot-test templates for the chosen tool(s), with matching viewport/density configuration.
- Unit tests with synthetic images: identical = 100%, small shift detected, color change detected, masked regions ignored, noise floor logic.
- Exit: capture and diff verified in CI on the testbed prototype (web side) and on at least one real Compose screen (render, diff, report).

### Phase 5: Port loop (screens, motion, assets, responsive)
- Build `port-screen`, `port-motion-and-assets`, the `screen-builder` and `diff-reviewer` agents, the imports-mapping reference (with latest versions resolved at run time), and `known-limits.md`.
- The loop: stateless composable plus fixtures, screenshot, diff, fix, repeat, with the iteration cap and "accepted with notes" logic. Include adaptive layout guidance per device target.
- Test on the testbed: port at least the home screen and two more different screens (for example a list screen and a player/detail screen) for phone, and at least one screen for tablet and desktop targets, until they meet the contract. Record scores.
- Exit: those screens pass in CI with recorded scores and logged residual differences.

### Phase 6: Engine wiring and feature gaps
- Build `wire-engine` and the `wiring-engineer` agent, the engine-protect hook, and the extra-feature flows (remove from UI versus build in engine, per user decision; headless answers cover this in tests).
- Test: wire the ported screens to SimpMusic's real engine, verify the app builds, and add tests that prove the main flows (for example playback controls, navigation, search) call the engine. Include one test where a prototype feature has no engine support and both decision paths are exercised.
- Verify the protect hook blocks an unapproved engine edit and allows an approved one.
- Exit: build green, wiring tests green, hook tests green.

### Phase 7: Verify, fix loop, finalize
- Build `verify-and-fix` (build, tests, lint, screenshot regression, smoke test, autonomous fix loop with caps, return-to-step logic) and `finalize-delivery` (docs update, final report, ZIP script including the worklog folder, PR creation, links).
- Ship workflow templates for users in `templates/github-actions/` (build, screenshot tests, Playwright capture) and test them.
- Exit: packaged ZIP produced in CI, opens correctly, contains new UI + engine + `.uiport/worklog/`, excludes build outputs.

### Phase 8: Full end-to-end on the test bed
- Run the whole plugin procedure (Steps 0 to 5) on `testbed/SimpMusic` with the prototype, in headless mode, as the real integration test. You are the plugin's runtime here: follow each skill exactly as written. Wherever the skill text is unclear, wrong or too long for the task, fix the skill, not just the output, and re-run.
- Cover all device targets requested in `testbed/answers/` (at minimum: phone-only run, and a run with all three).
- Cover Case 2 and Case 3. If SimpMusic cannot be split cheaply, create a very small synthetic fixture project under `testbed/fixtures/` (engine only; and empty) and validate those cases with it, plus a behavior walkthrough. Document the choice.
- Optional but recommended: a manually triggered workflow that runs the plugin inside Claude Code in CI (needs a secret; document the setup, do not hard-code anything).
- Fix loop in CI: diagnose from logs, fix, re-run. Max 6 attempts per distinct failure; after that document the blocker, workaround and evidence, and continue.
- Exit: end-to-end run green or, where impossible, every remaining failure documented with logs and a clear reason.

### Phase 9: Hardening, docs, release
- Cross-platform hook tests (ubuntu, windows, macos matrix) in `ci-hooks-matrix.yml`: path handling, line endings, quoting, permissions.
- Failure-mode tests: missing tools, no network, corrupt `state.json`, huge prototype, prototype with unsupported libraries, user declines approval, protect hook false positives.
- Write the README (install, quick start, the three cases, device targets, execution modes, headless mode, known limits, troubleshooting, security notes), `ARCHITECTURE.md`, `LIMITS.md`, and a per-skill reference index.
- Tag `v0.1.0`, create a release with the plugin ZIP, and write cleanup instructions: exactly how to delete `testbed/` and its workflows (`ci-e2e-simpmusic.yml`) without breaking anything. Verify by actually doing it on a throwaway branch and confirming CI stays green.
- Exit: release published, cleanup procedure verified.

---

## 6. Testing strategy

1. **Static:** schema, frontmatter, links, lint (every push).
2. **Unit:** diff math, state, preflight logic, registry, answers parsing, hook decisions (every push).
3. **Hooks matrix:** ubuntu/windows/macos.
4. **Integration on the testbed:** real Playwright capture, real Compose screenshots, real Gradle builds and tests in Actions.
5. **Behavior walkthroughs:** for each case and execution mode, check that the agent procedure respects the rules: engine protected, worklog updated, questions asked only at the gate, iteration caps respected, resume works.
6. **Regression:** store score baselines per screen so a later change that lowers fidelity fails CI.

Always report numbers (scores, run times, pass/fail counts) with links to the CI runs. Never say "works" or "passes" without evidence. Be careful with Actions minutes: cache Gradle and npm, fail fast, run the heavy end-to-end workflow only on demand or on `main`.

---

## 7. Bug-risk checklist (design against these from the start)

- Plugin fails to load: bad manifest, invalid frontmatter, wrong paths.
- Hooks: OS differences, quoting/paths, slow hooks, infinite re-triggering, false blocks, crashes that break the session.
- Agent behavior: skipped steps, endless loops, editing protected files, asking questions at the wrong time, forgetting state after context compaction.
- Context overflow from large maps or large prototypes.
- Fake mismatches: different viewport/density, different fonts, mid-animation captures, dynamic data, system bars.
- Version conflicts between AGP, Gradle, Kotlin, Compose compiler, screenshot tool.
- Effects not rendered by JVM screenshot tools (blur, some shaders), producing wrong diffs.
- Wiring: UI compiles but crashes at runtime, wrong thread or lifecycle, lost state on rotation, broken back navigation.
- CI: Android SDK licenses, Gradle cache misses, runner disk space, timeouts, secrets required by the test app.
- Licensing and security: copied third-party code, unpinned or unreviewed tool installs, secrets in logs.

---

## 8. Final deliverables

1. The plugin in `main`, tagged `v0.1.0`, with README and docs.
2. CI evidence: green runs for static, unit, hooks matrix, and the end-to-end run (or documented blockers).
3. `docs/phase-reports/` for all phases and `docs/build-log/`.
4. A ZIP of the plugin (without `testbed/`).
5. Verified cleanup procedure for `testbed/`.
6. A final report to me: what is complete, measured fidelity scores per screen and device, known limits, remaining risks, and recommended next steps.

## 9. Report format after each phase

```
Phase N: <name>
Done: ...
CI runs: <links> (pass/fail)
Key numbers: ...
Decisions made: ...
Open risks / blockers: ...
Next: ...
```

Start with Phase 0 now.
