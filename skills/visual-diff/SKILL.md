---
name: visual-diff
description: Use to compare a Compose render against the web reference and decide whether a screen is done — pixel match percentage, SSIM, geometry coverage, heat map, noise-floor calibration, and the accepted-with-notes versus blocked decision. Triggers on "diff the screenshot", "how close is it", "is this screen done", "the score dropped", or as the measuring half of every port iteration.
---

# Visual diff

One job: produce a number you can trust and a verdict that follows the documented contract.

## Procedure

1. Compare one screen/device:

   ```
   node ${CLAUDE_PLUGIN_ROOT}/scripts/visual-diff.mjs \
     --reference .uiport/reference/phone/home/default.png \
     --candidate .uiport/output/phone/home/default.png \
     --ref-geometry .uiport/reference/phone/home/default.geometry.json \
     --cand-geometry .uiport/output/phone/home/default.semantics.json \
     --screen home --device phone --iterations 2 \
     --out .uiport/output/phone/home \
     --heat .uiport/output/phone/home/home.heat.png
   ```

2. Read the exit code first — it is the contract:

   | Code | Meaning | Next |
   | --- | --- | --- |
   | 0 | matched | record and move on |
   | 3 | accepted-with-notes | needs categorised residuals in the worklog |
   | 5 | building | iterate (increment the counter, fix, re-render) |
   | 6 | blocked | stop and ask the user |

3. Look at the three images in this order: `.diff.png` (where pixels differ), `.heat.png`
   (how strongly), then the two side-by-side. A number without a look is how a wrong fix gets
   committed.

4. Turn every remaining difference into a category from `docs/LIMITS.md`
   (`font-rasterization`, `text-rendering`, `shadow-elevation`, `blur-unsupported`,
   `blend-mode-unsupported`, `filter-unsupported`, `subpixel-layout`, `scrollbar`,
   `platform-chrome`) or fix it. An unexplained difference is never "accepted with notes".

5. Update state: `state set-screen <screen> --device <device> --status <status> --score <pct>`
   and one line per iteration in the worklog.

## Rules

- Same viewport, same DPR, same fonts, same fixture data, frozen animations, bars masked.
  If any of these is off, the comparison is invalid — fix the harness, not the UI.
- Never lower the acceptance floor to make a screen pass. The floor is in
  `config/thresholds.json` for the whole run; a screen that cannot reach it is blocked and
  explained.
- The iteration cap is 5 per screen per device. At the cap: accepted-with-notes if above the
  floor and fully explained, otherwise blocked with the diff images attached.
- Re-run the noise-floor calibration if captures suddenly start disagreeing; renderer
  noise masquerading as a regression wastes iterations.

## References

- `references/metrics.md` — what pixel match, SSIM and geometry each catch, and what they miss.
- `references/residual-categories.md` — how to recognise each category from a diff image.
