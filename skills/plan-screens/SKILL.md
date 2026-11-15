---
name: plan-screens
description: Use after both maps exist and before any Compose screen is written. Produces the wiring plan (prototype screen/control → engine call, missing, extra), the Kotlin file/package structure as stubs, and the motion-and-assets inventory. Triggers on "plan the port", "screens-plan", "which engine call does this button need", or as Step 2 of a ui-port run.
---

# Plan the screens

One job: turn two maps into a work plan good enough that the port loop never has to stop and
think about structure.

## Procedure

1. **Screens and packages.** From `prototype-map.json` screens and `app-map.json` structure,
   decide for each screen:
   - target package (follow the project's existing layout, never invent a parallel tree);
   - the stateless composable name (`HomeScreen`), its state-holder input type, and the
     event callbacks it will need;
   - reusable components shared by more than one screen (extract on the second use, not the
     first).

   Write `.uiport/maps/screens-plan.md` with one row per screen and a short component list.
   Create empty stub files only when the user's delivery asks for it; otherwise the plan is
   text.

2. **Wiring plan.** For every interactive control in the prototype (from `handlers`, buttons,
   inputs, sliders, toggles), name the engine call or state that will back it:

   | Prototype control | Prototype behaviour | Engine equivalent | Status | Action |
   | --- | --- | --- | --- | --- |

   `Status` is one of `exists`, `missing`, `extra`. `missing` means the engine cannot do it;
   `extra` means the engine can, but the prototype shows nothing. Missing items become the
   decision-gate question list (build in engine vs remove from UI). Extra items are noted for
   the user; never silently add UI the prototype does not have.

3. **Motion and assets.** Write `.uiport/maps/motion-and-assets.md`: every animation,
   transition, gesture, vector, icon, gradient, shadow, blur, font and image, with a proposed
   conversion and a risk category from `docs/LIMITS.md`.

4. **Token translation.** Turn the prototype's CSS custom properties into a concrete palette
   table (light and dark) with Compose types. This is the single most reused artifact of the
   port; get it reviewed once and every screen inherits it.

5. Record the plan in the worklog and mark Step 2 done.

## Rules

- Never start porting a screen whose wiring row for its primary action is `missing` and
  undecided. Ask at the gate, once, for all of them.
- The package must already exist in the project's convention. If the project puts screens in
  `ui/screen/<feature>/`, do that; do not introduce `features/`.
- Keep the plan short enough to read: a screen that needs more than one screen of text is
  under-designed.

## References

- `references/wiring-plan-template.md` — the exact table shape and how to fill each column.
- `references/screens-plan-template.md` — package/stub structure and naming rules.
