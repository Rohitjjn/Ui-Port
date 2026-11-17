---
name: verify-and-fix
description: Use to prove a port is finished — run the project's build, unit tests, lint, screenshot regression and a smoke test, then fix failures in a capped autonomous loop with return-to-step logic. Triggers on "verify the port", "does the app still build", "the tests fail after porting", "run the regression", or as Step 5 of a ui-port run.
---

# Verify and fix

One job: evidence. Build, tests, lint, screenshots, smoke — and a short, honest list of what
still fails and why.

## Procedure

1. **Full check, in this order** (cheapest first, so a typo does not cost a Gradle build):

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/uiport.mjs verify --project <projectRoot> \
       --devices phone,tablet --step assembleDebug
   ```

   Or by hand:
   ```
   ./gradlew ktlintCheck
   ./gradlew :<app>:assembleDebug
   ./gradlew test
   ./gradlew :<module>:recordRoborazziDebug        # screenshots
   node scripts/visual-diff.mjs ... (per screen)   # regression against stored scores
   ```

   When a screen differs and the pixel diff alone does not explain why, compare the geometry
   dumps directly — it names the element and the offset in dp:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/geometry-compare.mjs \
       --ref .uiport/reference/phone/home/default.geometry.json \
       --cand .uiport/output/phone/home/default.semantics.json \
       --md .uiport/output/phone/home/geometry.md
   ```

   Exit 0 when every matched node is within `thresholds.geometry.toleranceDp` and coverage is above
   the floor; exit 3 when an element moved or is missing.

2. **Regressions are automatic failures.** `scripts/uiport.mjs verify --regression` compares each
   screen's score with `.uiport/baseline.json`. A drop larger than `thresholds.visual.regression`
   fails, even if the screen is still above the acceptance floor — a port that silently gets
   worse is a bug.

3. **Fix loop.** One failure at a time, in this order of blame:

   | Failure | Go back to |
   | --- | --- |
   | appearance (diff, geometry) | `port-screen`, that screen only |
   | analysis (wrong library, wrong call, wrong data shape) | `map-prototype` / `plan-screens`, that part only |
   | compile error in ported UI | the screen file; check imports and Compose version |
   | compile error in wiring | `wire-engine` |
   | test failure that asserts engine behaviour | the wiring, not the test |
   | lint only | fix formatting; never disable a rule to pass |

   Cap: `thresholds.loops.maxFixAttemptsPerFailure` (6). At the cap, document the blocker with the
   log excerpt and continue with the rest.

4. **Smoke test.** Install the debug build on an emulator/device if available, walk the main
   journeys (launch, navigate every tab, play something, open the player, go back). Record what
   was exercised. If no device is available, say so — the screenshot tests are not a substitute
   for a launch test.

5. **Docs.** Update the project's own docs (README/changelog) with what the new UI is and how to
   run the screenshot tests. Then `finalize-delivery`.

## Rules

- Never report "passes" without the command and its output.
- Never delete a failing test to make the suite green. Fix it or mark it skipped with a reason and
  a worklog entry.
- Fix the skill, not just the output, when the *procedure* was what failed.
- Keep a copy of every failing log in `.uiport/worklog/logs/` (trimmed to the relevant lines).

## References

- `references/verification-matrix.md` — what each check proves and what it cannot.
- `references/fix-loop-policy.md` — caps, blame ordering, and when to ask the user.
