# Phase 7 — Verify, fix loop, finalize

## Done

- `skills/verify-and-fix/` — cheapest-first check order, regressions as failures, blame ordering,
  caps, when to ask the user. `references/verification-matrix.md` (what each check proves),
  `references/fix-loop-policy.md`.
- `skills/finalize-delivery/` + `references/final-report-template.md`; `scripts/package-zip.mjs`
  (excludes build output/caches/IDE/secrets, includes the worklog, refuses oversized archives,
  `--dry-run`, `--include-output`).
- `scripts/verify.mjs` records every check with command, exit code and duration into
  `.uiport/worklog/logs/verify.json` + `verify.log` — evidence, not adjectives.
- `scripts/diff-all.mjs` maintains `.uiport/baseline.json` and fails on regressions beyond tolerance.
- Workflow templates: `templates/github-actions/uiport-build.yml`, `uiport-screenshots.yml`,
  `uiport-capture.yml`, `uiport-tooling-package.json`.

## Key numbers

| Metric | Value |
| --- | --- |
| Packaging tests | 4 (contents, `--include-output`, size refusal, dry run) — ZIP inspected with `unzip -Z1` |
| CLI tests | 19 (state, worklog, changelog, answers, status, help, diff-all, packaging) |
| Workflow templates | 3 + a pinned tooling package.json |
| Regression tolerance | 0.15 percentage points (configurable) |

## Decisions made

- Regressions fail the build even when the screen is above the acceptance floor: silent degradation is
  a bug even if the number is still "passing".
- The ZIP refuses to grow past 200 MB instead of quietly including `build/`.

## Open risks / blockers

- The workflow templates are syntax-checked but have never executed (B1). Their first real run is the
  moment to fix runner-specific surprises (SDK licences, disk, cache keys).

## Next

Phase 8 (end-to-end) — blocked on B1/B2/B3; documented rather than faked.
