---
name: map-prototype
description: Use when analysing the React/TSX web prototype: its routes and screens, components, state stores, data shapes, libraries, fonts, design tokens, responsive breakpoints, animations and assets. Triggers on "map the prototype", "what screens does the prototype have", "which libraries will need Compose equivalents", or as the second half of Step 1 of a ui-port run. Outputs .uiport/maps/prototype-map.md plus a machine-readable prototype-map.json.
---

# Map the prototype

One job: turn the prototype into a compact, trustworthy inventory. Everything the port needs
to know, nothing the agent should have to read file by file.

## Procedure

1. If the prototype is still an archive, unpack it first (never modify the original):

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/unpack-prototype.mjs <archive.zip> --out .uiport/prototype
   ```

2. Run the scanner:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/scan-prototype.mjs <prototypeRoot> \
     --json .uiport/maps/prototype-map.json \
     --md   .uiport/maps/prototype-map.md
   ```

   If it reports zero screens, the root is wrong or the prototype uses a router the scanner
   does not know. Fix that before anything else — a port with no screen list cannot be tracked.

3. Read the map. Verify, in the prototype's own source, the few facts the scanner cannot know:

   - **Navigation shape.** Hash router, history router, or a state machine? It decides how a
     Compose navigation graph is generated.
   - **Fixture data.** Where does the mock data live? That same data becomes the Compose
     fixture so screenshots are comparable.
   - **Which states are reachable** without app-specific clicks (empty/loading/error). The
     capture step refuses to fake them; plan for the ones that exist.

4. Build the imports map. For every library in the map's Libraries section, resolve the
   current stable Compose/Android equivalent and check it against the app's Kotlin/Compose
   versions from `app-map.md`. Write `.uiport/maps/imports-map.md` with one row per library:
   library, how it is used, Compose alternative, pinned version, risk, fallback.

   Use `references/library-mapping.md` as the starting table, then verify each version against
   the project's own catalog. Never write a version you have not resolved.

5. Write the prototype worklog entry and mark the mapping step's prototype half done.

## Rules

- The scanner is the source of truth for counts. If a number looks wrong, fix the scanner.
- Do not paste large source files into context; the map has the facts, the files have the
  details when you need one specific value.
- Screens named in `prototype-map.json` are the unit of porting and of status tracking. If two
  routes share one React component, they are still two screens.

## References

- `references/library-mapping.md` — the library-to-Compose table with risks and fallbacks.
- `references/prototype-signals.md` — how each signal is detected and what it implies for the
  port (breakpoints, motion, assets, tokens).
