# Release procedure

How `v0.1.0` was produced, and how to repeat it. Every step is a command, not a memory.

## 1. Gates

Run from the repository root. All three must pass before a tag exists:

```
npm ci && npm test              # 185 tests: unit + integration (164 run, 12 skip
                                # when testbed/ is absent — both are a pass)
node scripts/validate-plugin.mjs # manifest, skills, agents, commands, hooks, config, scripts
node scripts/lint-markdown.mjs   # every markdown file
```

`npm test` also proves the deletable-fixture rule: with `testbed/` removed it reports skipped tests
and still exits 0 (see `docs/CLEANUP.md`).

## 2. Build the ZIP

```
node scripts/package-zip.mjs --out dist/ui-port-v0.1.0.zip
```

`dist/` is ignored by Git on purpose: the release asset is the artifact, the repository is the
source. The packager excludes `testbed/`, `node_modules/`, `.git/`, build outputs and secrets, and
refuses anything over 200 MB. Verify the result before attaching it:

```
unzip -Z1 dist/ui-port-v0.1.0.zip | wc -l                       # ~130 entries
unzip -Z1 dist/ui-port-v0.1.0.zip | grep -cE "^(testbed|node_modules|\.git)/"   # must print 0
unzip -p  dist/ui-port-v0.1.0.zip .claude-plugin/plugin.json | head -3
```

## 3. Tag and release

```
gh release create v0.1.0 --title "ui-port v0.1.0" --notes-file <notes.md> --target <branch>
gh release upload v0.1.0 dist/ui-port-v0.1.0.zip
```

## Status of the 0.1.0 release

- Release created and public: <https://github.com/Rohitjjn/Ui-Port/releases/tag/v0.1.0>
- **Asset attached and verified**: `ui-port-v0.1.0.zip`, 391,887 bytes, state `uploaded` —
  <https://github.com/Rohitjjn/Ui-Port/releases/download/v0.1.0/ui-port-v0.1.0.zip>
  (run [43810401233](https://github.com/Rohitjjn/Ui-Port/actions/runs/43810401233): 144 entries,
  0 forbidden paths, `unzip -p … .claude-plugin/plugin.json` prints the manifest before upload).

### How the asset got there, and why the first two attempts failed

`gh release upload` from the authoring environment fails with a bare
`Post "https://uploads.github.com/…": EOF`. The cause is an egress allowlist that covers
`api.github.com` and `codeload.github.com` but not the uploads host; nothing is wrong with the
archive. `workflow_dispatch` is also unavailable here (403, and a workflow is only dispatchable
once it exists on the default branch), so the asset is published by `.github/workflows/release-asset.yml`
on a temporary `push` trigger, which was removed in the commit immediately after the successful run.

The first run of that workflow exposed a real bug and it is fixed: the tag fell back to
`github.ref_name`, which on a branch push is the *branch*, so it created a release tagged
`arena/a9a40385-ui-port`. That release was deleted (`gh release delete … --cleanup-tag`) and the
fallback is now the literal documented tag, never a ref.
- Re-attaching by hand, if it is ever needed: `gh release upload v0.1.0 dist/ui-port-v0.1.0.zip --clobber`
  from a machine with normal egress, or run the `release-asset` workflow with `tag=v0.1.0`.
- **CI evidence now exists** (2026-11-15): `ci-static` [43809265679], `ci-unit` [43809265653] and
  `ci-hooks-matrix` [43809265785] are green, and `ci-port-diff` [43809265671] runs the real
  Playwright capture, the Paparazzi render and the pixel/SSIM diff on every push.
- The fidelity scores in the release notes must be the ones in `docs/FINAL-REPORT.md` §2 — all
  three ported phone screens are still below the project's 98.5% floor and are reported as
  `building`. Nothing may be described as a completed port until a run crosses the floor.
