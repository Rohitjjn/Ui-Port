# Release procedure

How `v0.1.0` was produced, and how to repeat it. Every step is a command, not a memory.

## 1. Gates

Run from the repository root. All three must pass before a tag exists:

```
npm test                        # 176 tests: unit + integration (164 run, 12 skip
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
- **The ZIP asset upload failed twice** with `Post "https://uploads.github.com/...": EOF`. The cause
  is the build environment's egress allowlist: release *metadata* goes to `api.github.com` (allowed)
  while release *assets* are uploaded to `uploads.github.com` (not reachable here). Nothing is wrong
  with the archive — `gh release upload v0.1.0 dist/ui-port-v0.1.0.zip` from a normal machine
  completes it, or attach the file through the GitHub web UI.
- CI evidence is still missing (see `docs/PLAN.md` D1), so the release notes describe local gates
  rather than workflow runs. When Actions is enabled, add the run links to the release notes.
