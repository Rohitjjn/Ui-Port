# Execution modes

The detector classifies the machine; the user may override. Whatever is chosen, the same
artifacts must be produced — only *where* the heavy work happens changes.

| Mode | Detected when | Runs locally | Runs in GitHub Actions |
| --- | --- | --- | --- |
| `LOCAL_FULL` | JDK >= 17, Android SDK, Gradle wrapper, Node all present | everything: capture, port, Gradle build, screenshot tests, diff | optional (CI for regression only) |
| `HYBRID` | no JDK or no Android SDK, but a GitHub remote and Node exist | mapping, code generation, capture + diff, static checks | Gradle build, Compose screenshot tests, instrumentation |
| `CI_ONLY` | heavy tooling missing **and** Node missing, GitHub remote present | nothing that needs a toolchain; the agent reads files and writes code | everything |
| `LIMITED` | heavy tooling missing and no GitHub remote | mapping, code generation, static analysis, diff of images the user supplies | nothing |

## What changes per mode

**LOCAL_FULL.** Straight through. Use the project's own Gradle wrapper. Keep the Gradle
daemon warm between screens; a cold `assembleDebug` on a large Compose app is minutes, not
seconds, so batch screenshot tests per module.

**HYBRID.** Two consequences the agent must not forget:

1. Compose screenshots are produced by CI. The port loop therefore works in *rounds*: port a
   screen locally, push a branch, wait for the screenshot workflow, download the artifact,
   diff locally, fix. Batch screens: never spend an Actions run on one screen when three are
   already written.
2. Capture of the web reference still happens locally (Node is present). If Playwright's
   browser download is blocked, capture moves to CI too, and the loop becomes fully remote.

**CI_ONLY.** The agent cannot run anything. It works as an author: reads the repo, writes
Compose code and workflow changes, and uses CI as its build/test/diff oracle. Every
verification is a workflow run; quote the run link in the worklog.

**LIMITED.** Tell the user plainly what is impossible here and give them the exact commands
to run on a machine with the toolchain (see `templates/github-actions/` for a ready
workflow). What still works: static mapping, code generation, prompt-level review, and the
diff engine over screenshots produced anywhere (it is pure Node).

## Failure modes to raise during preflight, not later

- No egress to `cdn.playwright.dev` → Chromium cannot be downloaded → capture is CI-only.
- Corporate proxy or TLS interception → `npm i` fails on peer deps → pin with `--no-audit`
  and report the proxy variables in `tooling.md`.
- Free disk below ~8 GB → Gradle + SDK + screenshots will not fit; say so before starting.
- Android SDK present but no platform matching `compileSdk` → the first build will try to
  download it; on a metered connection that is the user's call.
