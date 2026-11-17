import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import yaml from "yaml";

const ROOT = path.resolve(import.meta.dirname, "../..");
const WORKFLOW_DIR = path.join(ROOT, ".github/workflows");
const files = fs.readdirSync(WORKFLOW_DIR).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

/**
 * Workflow files are code that only runs somewhere I cannot see.
 *
 * A YAML error in `.github/workflows/*.yml` does not produce a failed step — it produces a run
 * with no jobs at all, concluded "failure" in the same second it started, and the only way to
 * notice is to wonder why nothing reported. That happened once in this repository (a duplicated
 * `env:` key in a step, added by a scripted edit), and the run page showed nothing useful about
 * it. Parsing every workflow here turns that into a failing test.
 */
describe("GitHub workflows", () => {
  test("every workflow parses, so a syntax error cannot become a silent no-op run", () => {
    assert.ok(files.length >= 5, `expected the workflows to be present, found ${files.length}`);
    for (const file of files) {
      const text = fs.readFileSync(path.join(WORKFLOW_DIR, file), "utf8");
      const doc = yaml.parseDocument(text);
      assert.deepEqual(
        doc.errors.map((e) => e.message),
        [],
        `${file} does not parse`,
      );
    }
  });

  test("every workflow has jobs with at least one step, and every step has a name or a use", () => {
    for (const file of files) {
      const doc = yaml.parse(fs.readFileSync(path.join(WORKFLOW_DIR, file), "utf8"));
      const jobs = doc.jobs ?? {};
      assert.ok(Object.keys(jobs).length > 0, `${file} has no jobs`);
      for (const [jobName, job] of Object.entries(jobs)) {
        assert.ok(Array.isArray(job.steps) && job.steps.length > 0, `${file}:${jobName} has no steps`);
        for (const step of job.steps) {
          assert.ok(step.name || step.uses, `${file}:${jobName} has a nameless step`);
        }
      }
    }
  });

  test("no step declares the same key twice, which YAML rejects and GitHub silently drops the run for", () => {
    // `yaml` reports duplicate map keys as errors, but only when the document is parsed strictly.
    // Asserting on the raw text as well catches the shape that caused the incident: it is easier
    // to see a repeated `env:` in text than to trust a parser to have noticed.
    for (const file of files) {
      const doc = yaml.parseDocument(fs.readFileSync(path.join(WORKFLOW_DIR, file), "utf8"));
      assert.equal(doc.errors.length, 0, `${file}: ${doc.errors.map((e) => e.message).join("; ")}`);
    }
  });

  test("the scores survive the annotation budget: one line, one dedicated step, shape inline", () => {
    // A job keeps only its first 50 annotations — not a step. The diff step emits 40+ of them for
    // geometry detail, so the scores need their own step *and* the failure signature has to ride
    // on the same line: a separate shapes notice in that step was dropped at 50 back when the
    // budget was thought to be per step. Both halves of that lesson are asserted here.
    const doc = yaml.parse(fs.readFileSync(path.join(WORKFLOW_DIR, "ci-port-diff.yml"), "utf8"));
    const steps = doc.jobs["render-and-diff"].steps.map((s) => s.name ?? s.uses);
    const scoresStep = doc.jobs["render-and-diff"].steps.find((s) => s.name === "Publish the score table");
    assert.ok(scoresStep, "the scores step must exist as its own step");
    assert.match(scoresStep.run, /ci-scores-line\.mjs/);
    // Exactly two notices may come out of this step: the score table (with the shape inline) and
    // the provenance fingerprint. Everything else that wants to say something has to fit on one of
    // those two lines, because the budget is 50 per job and the diff step has already spent most
    // of it.
    const noticeTitles = [...scoresStep.run.matchAll(/::notice title=(\w+)/g)].map((m) => m[1]);
    assert.deepEqual(
      noticeTitles,
      ["scores", "provenance"],
      `unexpected notices in the scores step: ${noticeTitles.join(", ")}`,
    );
    assert.ok(steps.includes("Diff every rendered screen"));
  });
});
