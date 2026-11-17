# Tool approval batch

One message, at the start, covering everything that will be installed. After that the agent
must not interrupt the run with install requests.

## Shape of the message

```
ui-port preflight

Environment
- OS: <os> · Node <v> · JDK <v> · Android SDK <present/missing> · Gradle wrapper <v>
- GitHub remote: <url or none> · gh authenticated: <yes/no> · free disk: <n> GB

Execution mode: <MODE>  (detected: <reason>)
Project case: <case>    (signals: <n> Kotlin files, <n> UI files, <n> ViewModels)

I will install (pinned, once):
| Tool | Version | Size | Why |
| playwright + chromium | 1.65.1 | ~150 MB | capture the prototype deterministically |
| pixelmatch / pngjs / ssim.js | 7.1.0 / 7.0.0 / 3.5.0 | <1 MB | pixel + SSIM diff |
| yaml | 2.9.1 | <1 MB | config and frontmatter validation |
| roborazzi (gradle) | 1.53.1 | ~5 MB | render Compose screens on the JVM |
| ktlint (gradle) | 1.7.1 | ~10 MB | fast per-file lint in a hook |

Security note: plugin hooks and scripts run on this machine. Nothing else is installed, and
`gh` is only used if you ask for a branch/PR.

Approve this once? (yes / no / choose a subset)
```

## Rules

- Versions come from `config/tools.json` only. If a tool is `needs-user-input` (Ponytail, REA,
  Compose Preview Screenshot Testing), name it separately and ask for a decision, not a version.
- A "subset" answer is honoured: record exactly what was approved, and if a later step needs a
  refused tool, stop and say which step needs it and why — never install it silently.
- On Windows the install command may differ (no `&&` chaining in cmd.exe). The scripts are
  Node, so prefer `node scripts/...` over shell pipelines everywhere.
- Never put tokens, keystrokes or paths to credentials in this message or in `tooling.md`.
