# Fix-loop policy

## Caps

| Loop | Cap | Source |
| --- | --- | --- |
| Visual iterations per screen per device | 5 | `config/thresholds.json` → `visual.maxIterationsPerScreenPerDevice` |
| Fix attempts per distinct failure in verify | 6 | `config/thresholds.json` → `loops.maxFixAttemptsPerFailure` |
| Screens per run | 64 | `loops.maxScreensPerRun` (a guard against runaway plans) |

Hitting a cap is not a failure of the agent; it is the signal to stop and hand a decision to the
user. Write down what was tried, with the diff numbers, and what you would try next.

## Blame ordering

When several things fail at once, fix them in this order — cheaper and more likely to be causal:

1. **Harness** (wrong DPR, unfrozen animation, missing font, wrong fixture data) — this masquerades
   as a UI bug and costs iterations if misdiagnosed.
2. **Compile/lint** — nothing downstream is measurable until it builds.
3. **Appearance, one element at a time** — geometry report first: the largest box error is usually
   the visual error too.
4. **Wiring/behaviour** — after appearance is stable.
5. **Test assertions** — last, and only if the test is genuinely wrong.

## When to ask the user instead of continuing

- A screen is below the acceptance floor at the iteration cap.
- The only fix requires an engine edit that was refused.
- A prototype feature has no engine equivalent and the gate answer was `ask-user`.
- The build fails for a reason outside the port (missing SDK, license, secret) — that is
  environment, not code.
- The toolchain versions conflict (compose compiler vs Kotlin) and pinning one breaks the other.

## What "fixed" means

- The failing command was re-run and passed, with its output captured in the worklog.
- For appearance: the diff report shows the new number and the status change.
- For behaviour: a test asserts the behaviour, not the pixel.
- Never "fixed" = "I changed something and it looks plausible".
