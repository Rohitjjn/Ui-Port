---
name: port-screen
description: Use to rebuild one prototype screen in Jetpack Compose with fidelity — stateless composable plus fixture data first, then screenshot, diff, fix, repeat within the iteration cap, and only then connect anything. Triggers on "port this screen", "build the Compose version of home", "make the Compose screen match the prototype", or as Step 3 of a ui-port run.
---

# Port a screen

One job: a Compose screen that matches its reference screenshot and geometry, driven by fake
fixtures, before any engine code is involved.

## Procedure per screen (one at a time, one device at a time)

0. **Know which slice you are in.** Read `.uiport/maps/run-plan.md` before touching the screen. If
   the screen is not in the slice currently being ported, stop — porting it "while you are here"
   is how a slice becomes a branch. Under `strangler`, the new composable goes into the flag's
   slot and the old one stays; under `slices` the old one is deleted in this same slice; under
   `batch` there is nothing to slot or delete yet. The tier that governs is the one
   `node ${CLAUDE_PLUGIN_ROOT}/scripts/uiport.mjs size assess` reports, not the one you assumed
   at the start.

1. **Read the reference, not the whole prototype.** Look at
   `.uiport/reference/<device>/<screen>/default.png`, its geometry JSON for exact numbers, and
   the prototype component source for that screen only. Copy numbers from the geometry dump:
   paddings, sizes, radii, font sizes. Do not eyeball and do not approximate "by feel".

2. **Build stateless.** Signature shape:

   ```kotlin
   @Composable
   fun HomeScreen(
       state: HomeUiState,
       onTrackClick: (String) -> Unit = {},
       onPlayAll: (String) -> Unit = {},
       modifier: Modifier = Modifier,
   )
   ```

   All data comes from a fixture that mirrors the prototype's mock data. No ViewModel, no
   repository, no `remember` for anything that belongs to state. This is what makes screenshots
   reproducible and makes the wiring step mechanical.

3. **Use the shared vocabulary.** Colours, type scale, spacing, radii and shapes come from the
   token translation produced by `plan-screens`. A hard-coded colour is a bug even if it matches
   today.

4. **Render and diff.** Run the Compose screenshot test for that screen/device, then
   `visual-diff`. Read the exit code. If `building`: find the *single largest* difference, fix
   it, re-run. Fixing three things at once makes the next diff unreadable.

5. **Respect the loop:**

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/uiport.mjs state bump <screen> --device <device> --limit 5
   ```

   Five iterations per screen per device. At the cap, apply the acceptance rules from
   `visual-diff` — never a sixth attempt, never a lowered floor.

6. **Then adaptations.** Once the default state matches, handle the other states the capture
   produced (overlay, focus, empty if reachable), and other device targets. Tablet and desktop
   are *not* stretched phone layouts: use window size classes and, where the prototype changes
   structure at `lg`, change structure.

7. **Record.** `state set-screen ... --status matched --score <pct>`, plus a worklog line with
   the number and what the residual differences are.

## Rules

- Never connect the engine while the screen is still `building`. Fixtures keep the diff
  meaningful; a live engine makes every screenshot depend on the network.
- Never copy a number from the screenshot by eye when the geometry dump has it.
- Never edit engine files. The hook will block it, correctly.
- One screen, one commit-sized change. If a shared component changes, re-diff every screen that
  uses it.
- Never delete the old composable before its diff and geometry gate pass. Under a flag, the
  old path is the rollback; under a slice, deleting it is the *last* step of the slice, never the
  first.

## References

- `references/compose-fidelity-checklist.md` — the details that decide the last 1%.
- `references/adaptive-layout.md` — compact/medium/expanded, and desktop.
- `../port-motion-and-assets/SKILL.md` — for everything that is not plain layout.
