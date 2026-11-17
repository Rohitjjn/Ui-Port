# Phase 9 — Hardening, docs, release

## Done

- Cross-platform hook matrix workflow (`ci-hooks-matrix.yml`): ubuntu/windows/macos, including a
  CRLF-input end-to-end probe that asserts the block exit code.
- Failure-mode coverage in the unit suite: missing tools (preflight classification), no network
  (`resolve-versions` lookup failure path, capture exit 7), corrupt `state.json` (quarantine +
  recovery), huge prototype (scanner file cap), unsupported libraries (`needs-user-input` entries),
  declined approval (`protectedPathsApproved: false` → block), protect-hook false positives
  (pure UI path, no config, outside-project path, read-only Bash).
- Docs: README (install, quick start, cases, device targets, execution modes, headless, limits,
  troubleshooting, security), ARCHITECTURE, LIMITS, plan, research, test-bed report, cleanup
  procedure, build log, phase reports 0–8.
- Packaging: `package-zip.mjs` with secret/build-output exclusion and a size guard; verified by
  inspecting a real archive.
- CHANGELOG with the 0.1.0 entry.

## Key numbers

| Metric | Value |
| --- | --- |
| Tests | 157 total (154 unit + 3 integration) |
| Docs | 61 markdown files linted |
| Workflows | 4 (static, unit 3-OS, hooks 3-OS, e2e test bed) |
| Deletable test bed | verified: with `testbed/` removed, the suite reports 142 pass / 12 skipped, 0 failures |

## Not done

- `v0.1.0` is **not tagged** and no release is published: the release is supposed to carry CI evidence
  (green static/unit/hooks/integration runs) and there are none yet (blocker B1).
- The cleanup procedure is documented and the "delete testbed" path is verified locally (tests skip,
  validator and linter stay green), but not verified on a branch in Actions for the same reason.

## Next

Enable Actions, run `ci-static`, `ci-unit`, `ci-hooks-matrix`, then `ci-e2e-simpmusic` (manual). Tag
`v0.1.0` and publish the plugin ZIP once those are green.
