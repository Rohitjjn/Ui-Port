# Cleanup: removing the test bed

`testbed/` exists only to develop and prove the plugin. No plugin code depends on it. Removing it
takes three minutes and does not change how the plugin works.

## What to delete

| Path | Why it can go |
| --- | --- |
| `testbed/SimpMusic/` | unmodified GPL-3.0 upstream copy, used as a target project for end-to-end runs |
| `testbed/prototype/` | the demo React prototype (an archive copy stays at the repository root if you want it) |
| `testbed/expected/` | any generated maps kept as references |
| `.github/workflows/ci-e2e-simpmusic.yml` | the only workflow that references `testbed/` |
| `docs/testbed-report.md` | describes the test bed; keep it as history if you like, it breaks no links |

## What must stay

- `scripts/`, `skills/`, `agents/`, `commands/`, `hooks/`, `config/`, `templates/`, `tests/unit/` — the
  plugin.
- `docs/PHASE-REPORTS`, `docs/PLAN.md`, `docs/LIMITS.md` — they reference the test bed in prose only.
- `simpmusic-react-web-reconstruction.zip` at the root — delete it too if you want; nothing reads it.

## Procedure

```bash
git checkout -b chore/remove-testbed            # a throwaway branch, never force-push
git rm -r --cached testbed >/dev/null && rm -rf testbed
git rm .github/workflows/ci-e2e-simpmusic.yml
git rm -r docs/testbed-report.md 2>/dev/null || true
git commit -m "chore: remove the SimpMusic/prototype test bed"
git push -u origin chore/remove-testbed
```

Then verify nothing broke:

```bash
npm ci
node --test "tests/unit/*.test.mjs"       # 154 tests; the scanners' real-tree assertions are skipped
node scripts/validate-plugin.mjs
node scripts/lint-markdown.mjs
```

## What breaks, and the fix

Two unit tests assert facts against the real trees (`tests/unit/scanners.test.mjs`): the prototype
screen inventory and the SimpMusic split. After deleting `testbed/` they cannot run. They skip
themselves when the folders are absent — check that the suite reports *skipped*, not *failed*, and
keep the synthetic-fixture tests, which cover the same code paths on generated projects.

If you prefer a hard cut, delete those two `describe` blocks. Do not delete the synthetic tests: they
are what protect the scanners from regressions.

## Storage note

The test bed accounts for ~25 MB of committed files (1 545 files) and one manual-only workflow. It is
the single largest thing in this repository and the only GPL-3.0 content.
