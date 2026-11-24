#!/usr/bin/env node
/**
 * Turn a TAP test report into GitHub Actions annotations.
 *
 * Why this exists: the runner's own logs are served from an Azure blob host that some
 * environments cannot reach, so "look at the logs" is not always possible. Annotations
 * travel through the GitHub API, which is reachable from anywhere the REST API is.
 *
 *   node --test --test-reporter=tap "tests/unit/*.test.mjs" > unit.tap || true
 *   node scripts/ci-annotate-tap.mjs unit.tap
 *
 * Emits one `::error::` per failing test with its message, and a `::notice::` summary.
 * Exit code 1 when any test failed, so the workflow step still fails the job.
 */
import fs from "node:fs";
import process from "node:process";

const file = process.argv[2];
if (!file) {
  process.stderr.write("usage: ci-annotate-tap.mjs <report.tap>\n");
  process.exit(2);
}
if (!fs.existsSync(file)) {
  process.stderr.write(`ci-annotate-tap: ${file} does not exist\n`);
  process.exit(2);
}

const lines = fs.readFileSync(file, "utf8").split("\n");
const failures = [];
let current = null;

for (const line of lines) {
  const notOk = line.match(/^not ok \d+ - (.*)$/);
  if (notOk) {
    current = { name: notOk[1], detail: [] };
    failures.push(current);
    continue;
  }
  if (/^ok \d+ - /.test(line)) {
    current = null;
    continue;
  }
  if (!current) continue;
  // YAML diagnostic block: pull the messages a human needs.
  const msg = line.match(/^\s*(error|code|failureType|stack): (.+)$/);
  if (msg) current.detail.push(`${msg[1]}: ${msg[2]}`);
  const cont = line.match(/^\s{4,}(\S.*)$/);
  if (cont && current.detail.length && /^\s+['"`.0-9{}()[\]]|^\s{4,}\S/.test(line)) {
    current.detail.push(cont[1]);
  }
}

const MAX_LINES = 12;
for (const f of failures) {
  const body = f.detail.slice(0, MAX_LINES).join(" | ").replace(/%/g, "%25").replace(/\r?\n/g, " ");
  process.stdout.write(`::error title=${f.name.replace(/[%,]/g, " ")}::${body || "no diagnostic block"}\n`);
}

const passed = (fs.readFileSync(file, "utf8").match(/^ok \d+ - /gm) ?? []).length;
process.stdout.write(`::notice::${passed} passed, ${failures.length} failed\n`);

if (failures.length) {
  process.stderr.write(`\n${failures.length} failing test(s):\n`);
  for (const f of failures) process.stderr.write(`  - ${f.name}\n`);
  process.exit(1);
}
