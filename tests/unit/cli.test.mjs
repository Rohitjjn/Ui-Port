import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test, { describe } from "node:test";
import { tmpProject } from "../helpers/fixtures.mjs";
import { fakeScreen, save } from "../helpers/images.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CLI = path.join(ROOT, "scripts/uiport.mjs");
const NODE = process.execPath;

function cli(cwd, ...args) {
  try {
    return { code: 0, stdout: execFileSync(NODE, [CLI, ...args], { cwd, encoding: "utf8" }) };
  } catch (err) {
    return { code: err.status, stdout: String(err.stdout ?? ""), stderr: String(err.stderr ?? "") };
  }
}

describe("uiport CLI", () => {
  test("state init creates a state file and refuses to overwrite without --force", () => {
    const p = tmpProject();
    try {
      const first = cli(p.dir, "state", "init", "--case", "case-2-engine-only", "--devices", "phone,tablet");
      assert.equal(first.code, 0);
      const state = JSON.parse(p.read(".uiport/state.json"));
      assert.equal(state.projectCase, "case-2-engine-only");
      assert.deepEqual(state.deviceTargets, ["phone", "tablet"]);
      const second = cli(p.dir, "state", "init");
      assert.equal(second.code, 2);
      assert.match(second.stderr, /already exists/);
      assert.equal(cli(p.dir, "state", "init", "--force").code, 0);
    } finally {
      p.cleanup();
    }
  });

  test("state set-step validates the step name", () => {
    const p = tmpProject();
    try {
      cli(p.dir, "state", "init");
      const bad = cli(p.dir, "state", "set-step", "step-9", "done");
      assert.equal(bad.code, 2);
      assert.match(bad.stderr, /unknown step/);
      const good = cli(p.dir, "state", "set-step", "step-1-maps", "in-progress", "--note", "started");
      assert.equal(good.code, 0);
      assert.equal(JSON.parse(p.read(".uiport/state.json")).steps["step-1-maps"].status, "in-progress");
    } finally {
      p.cleanup();
    }
  });

  test("state set-screen records a score and reports the entry", () => {
    const p = tmpProject();
    try {
      cli(p.dir, "state", "init");
      const res = cli(p.dir, "state", "set-screen", "home", "--device", "phone", "--status", "matched", "--score", "99.4");
      assert.equal(res.code, 0);
      const out = JSON.parse(res.stdout);
      assert.equal(out.entry.devices.phone.score, 99.4);
    } finally {
      p.cleanup();
    }
  });

  test("state bump counts iterations and flags the cap", () => {
    const p = tmpProject();
    try {
      cli(p.dir, "state", "init");
      for (let i = 0; i < 4; i++) cli(p.dir, "state", "bump", "home", "--device", "phone");
      const fifth = JSON.parse(cli(p.dir, "state", "bump", "home", "--device", "phone").stdout);
      assert.equal(fifth.used, 5);
      assert.equal(fifth.capReached, true);
      // The sixth attempt is refused rather than silently recorded, and exits non-zero so a
      // scripted loop stops instead of burning CI minutes past the cap.
      const sixth = cli(p.dir, "state", "bump", "home", "--device", "phone");
      assert.equal(sixth.code, 7);
      assert.equal(JSON.parse(sixth.stdout).exhausted, true);
      // A harness fix is not a port iteration: it is logged and does not consume budget.
      const harness = JSON.parse(cli(p.dir, "state", "bump", "home", "--device", "phone", "--kind", "harness", "--reason", "capture viewport").stdout);
      assert.equal(harness.counted, false);
      assert.equal(harness.used, 5);
      const residuals = JSON.parse(cli(p.dir, "state", "residuals", "home", "--device", "phone", "--categories", "text-rendering,shadow-elevation").stdout);
      assert.deepEqual(residuals.categories, ["text-rendering", "shadow-elevation"]);
    } finally {
      p.cleanup();
    }
  });

  test("worklog ensure + append creates the six sections and records entries", () => {
    const p = tmpProject();
    try {
      cli(p.dir, "state", "init");
      const ensured = JSON.parse(cli(p.dir, "worklog", "ensure", "step-3-port").stdout);
      assert.equal(ensured.created, true);
      cli(p.dir, "worklog", "append", "step-3-port", "--heading", "Commands run", "--body", "npm run dev");
      const text = p.read(".uiport/worklog/step-3-port.md");
      for (const section of ["Objective", "What was done and why", "Context and decisions", "Commands run", "Results", "Files touched", "Problems and fixes"]) {
        assert.ok(text.includes(`## ${section}`), `missing section ${section}`);
      }
      assert.match(text, /npm run dev/);
    } finally {
      p.cleanup();
    }
  });

  test("changelog appends file entries", () => {
    const p = tmpProject();
    try {
      cli(p.dir, "state", "init");
      cli(p.dir, "changelog", "--step", "step-3-port", "--file", "app/src/Home.kt", "--note", "ported");
      const text = p.read(".uiport/worklog/CHANGELOG.md");
      assert.match(text, /app\/src\/Home\.kt/);
      assert.match(text, /ported/);
    } finally {
      p.cleanup();
    }
  });

  test("answers reports absence, validity and errors with the right exit codes", () => {
    const p = tmpProject();
    try {
      const none = JSON.parse(cli(p.dir, "answers").stdout);
      assert.equal(none.present, false);
      assert.equal(none.headless, false);

      p.write(".uiport/answers.json", JSON.stringify({ deviceTargets: [], executionMode: "NOPE" }));
      const bad = cli(p.dir, "answers");
      assert.equal(bad.code, 3);
      const parsed = JSON.parse(bad.stdout);
      assert.equal(parsed.ok, false);
      assert.ok(parsed.errors.length >= 3);

      p.write(
        ".uiport/answers.json",
        JSON.stringify({
          deviceTargets: ["phone"],
          executionMode: "HYBRID",
          extraFeatures: {},
          allowEngineEdits: false,
          delivery: ["zip"],
        }),
      );
      const good = cli(p.dir, "answers");
      assert.equal(good.code, 0);
      assert.equal(JSON.parse(good.stdout).ok, true);
    } finally {
      p.cleanup();
    }
  });

  test("status renders a table and survives a corrupt state", () => {
    const p = tmpProject();
    try {
      cli(p.dir, "state", "init");
      cli(p.dir, "state", "set-screen", "home", "--device", "phone", "--status", "building");
      const ok = cli(p.dir, "status");
      assert.equal(ok.code, 0);
      assert.match(ok.stdout, /ui-port status/);
      assert.match(ok.stdout, /home \| phone \| building/);
      p.write(".uiport/state.json", "not json");
      const recovered = cli(p.dir, "status");
      assert.equal(recovered.code, 0);
      assert.match(recovered.stdout, /warning/);
    } finally {
      p.cleanup();
    }
  });

  test("unknown commands exit 2 with a message", () => {
    const p = tmpProject();
    try {
      const res = cli(p.dir, "nonsense");
      assert.equal(res.code, 2);
      assert.match(res.stderr, /unknown command/);
    } finally {
      p.cleanup();
    }
  });

  test("--help lists every command group", () => {
    const p = tmpProject();
    try {
      const { stdout } = cli(p.dir, "--help");
      for (const cmd of ["preflight", "state", "worklog", "changelog", "answers", "verify", "status"]) {
        assert.ok(stdout.includes(cmd), `help is missing ${cmd}`);
      }
    } finally {
      p.cleanup();
    }
  });
});

describe("diff-all", () => {
  function project() {
    const p = tmpProject();
    const ref = path.join(p.dir, ".uiport/reference/phone/home");
    const out = path.join(p.dir, ".uiport/output/phone/home");
    save(ref, "default.png", fakeScreen());
    save(out, "default.png", fakeScreen());
    p.json(".uiport/reference/phone/home/default.geometry.json", [{ text: "Buy", role: "button", x: 8, y: 100, w: 24, h: 12 }]);
    p.json(".uiport/output/phone/home/default.semantics.json", [{ text: "Buy", role: "button", x: 8, y: 100, w: 24, h: 12 }]);
    // Acceptance needs a declared residual; the port loop writes it into state.json, and the
    // gate reads it from there rather than assuming a perfect pair needs no explanation.
    p.json(".uiport/state.json", {
      iterationCounts: { "home::phone": 2 },
      residuals: { "home::phone": { categories: ["font-rasterization"] } },
    });
    return p;
  }

  test("identical renders produce a matched summary", () => {
    const p = project();
    try {
      const res = execFileSync(
        NODE,
        [path.join(ROOT, "scripts/diff-all.mjs"), "--device", "phone", "--reference", ".uiport/reference", "--candidate", ".uiport/output", "--out", ".uiport/output"],
        { cwd: p.dir, encoding: "utf8" },
      );
      assert.match(res, /matched 1/);
      const summary = JSON.parse(p.read(".uiport/output/summary.json"));
      assert.equal(summary.counts.matched, 1);
      assert.equal(summary.results[0].pixelMatchPct, 100);
      assert.equal(summary.results[0].accepted, true);
      assert.equal(summary.results[0].iterations, 2);
    } finally {
      p.cleanup();
    }
  });

  test("a worse render is reported as building, and as a regression against the baseline", () => {
    const p = project();
    try {
      p.json(".uiport/baseline.json", { schemaVersion: 1, scores: { "home::phone": 100 } });
      save(path.join(p.dir, ".uiport/output/phone/home"), "default.png", fakeScreen({ shift: 5 }));
      const res = (() => {
        try {
          return {
            code: 0,
            stdout: execFileSync(
              NODE,
              [path.join(ROOT, "scripts/diff-all.mjs"), "--device", "phone", "--reference", ".uiport/reference", "--candidate", ".uiport/output", "--out", ".uiport/output"],
              { cwd: p.dir, encoding: "utf8" },
            ),
          };
        } catch (err) {
          return { code: err.status, stdout: String(err.stdout ?? "") };
        }
      })();
      assert.equal(res.code, 6);
      assert.match(res.stdout, /Regressions/);
    } finally {
      p.cleanup();
    }
  });

  test("a missing candidate is reported, not crashed on", () => {
    const p = tmpProject();
    try {
      save(path.join(p.dir, ".uiport/reference/phone/home"), "default.png", fakeScreen());
      const res = (() => {
        try {
          return {
            code: 0,
            stdout: execFileSync(
              NODE,
              [path.join(ROOT, "scripts/diff-all.mjs"), "--device", "phone", "--reference", ".uiport/reference", "--candidate", ".uiport/output", "--out", ".uiport/output"],
              { cwd: p.dir, encoding: "utf8" },
            ),
          };
        } catch (err) {
          return { code: err.status, stdout: String(err.stdout ?? "") };
        }
      })();
      assert.equal(res.code, 6);
      assert.match(res.stdout, /missing 1/);
    } finally {
      p.cleanup();
    }
  });

  test("no reference directory is a clear usage error", () => {
    const p = tmpProject();
    try {
      let code = 0;
      try {
        execFileSync(NODE, [path.join(ROOT, "scripts/diff-all.mjs"), "--device", "tablet"], { cwd: p.dir, encoding: "utf8" });
      } catch (err) {
        code = err.status;
      }
      assert.equal(code, 1);
    } finally {
      p.cleanup();
    }
  });

  test("--calibrate reports the noise floor and its determinism", () => {
    const p = tmpProject();
    try {
      save(path.join(p.dir, ".uiport/reference/phone/home"), "default.png", fakeScreen());
      save(path.join(p.dir, ".uiport/reference-run2/phone/home"), "default.png", fakeScreen());
      const out = execFileSync(
        NODE,
        [
          path.join(ROOT, "scripts/diff-all.mjs"),
          "--calibrate",
          "--device",
          "phone",
          "--reference",
          ".uiport/reference",
          "--candidate",
          ".uiport/reference-run2",
          "--out",
          ".uiport/noise-floor",
        ],
        { cwd: p.dir, encoding: "utf8" },
      );
      const parsed = JSON.parse(out);
      assert.equal(parsed.deterministic, true);
      assert.ok(fs.existsSync(path.join(p.dir, ".uiport/noise-floor/noise-floor.json")));
    } finally {
      p.cleanup();
    }
  });
});

describe("package-zip", () => {
  test("packages source and worklog, excludes build output and secrets", () => {
    const p = tmpProject();
    try {
      p.write("app/src/main/java/Home.kt", "fun Home() {}\n");
      p.write("app/build/tmp/generated.kt", "junk");
      p.write(".uiport/worklog/step-0-preflight.md", "# Step 0\n");
      p.write(".uiport/output/phone/home/report.md", "diff");
      p.write("local.properties", "sdk.dir=/secret\n");
      p.write("release.jks", "binary");
      const zip = path.join(p.dir, "delivery.zip");
      const res = execFileSync(NODE, [path.join(ROOT, "scripts/package-zip.mjs"), "--project", p.dir, "--out", zip], { encoding: "utf8" });
      assert.match(res, /wrote/);
      const listing = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).split("\n").filter(Boolean);
      assert.ok(listing.includes("app/src/main/java/Home.kt"));
      assert.ok(listing.includes(".uiport/worklog/step-0-preflight.md"), "worklog must be included");
      assert.ok(!listing.some((f) => f.startsWith("app/build/")), "build output must be excluded");
      assert.ok(!listing.some((f) => f.startsWith(".uiport/output/")), "output images excluded by default");
      assert.ok(!listing.includes("local.properties"), "secrets must be excluded");
      assert.ok(!listing.some((f) => f.endsWith(".jks")), "keystores must be excluded");
    } finally {
      p.cleanup();
    }
  });

  test("--include-output keeps the diff images", () => {
    const p = tmpProject();
    try {
      p.write("a.kt", "x");
      p.write(".uiport/worklog/step-1-maps.md", "# Step 1\n");
      p.write(".uiport/output/phone/home/report.md", "diff");
      const zip = path.join(p.dir, "with-output.zip");
      execFileSync(NODE, [path.join(ROOT, "scripts/package-zip.mjs"), "--project", p.dir, "--out", zip, "--include-output"], { encoding: "utf8" });
      const listing = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" });
      assert.match(listing, /\.uiport\/output\/phone\/home\/report\.md/);
    } finally {
      p.cleanup();
    }
  });

  test("refuses to package a suspiciously large tree", () => {
    const p = tmpProject();
    try {
      p.write("big.bin", Buffer.alloc(2 * 1024 * 1024));
      let code = 0;
      try {
        execFileSync(NODE, [path.join(ROOT, "scripts/package-zip.mjs"), "--project", p.dir, "--out", path.join(p.dir, "x.zip"), "--max-mb", "1"], {
          encoding: "utf8",
        });
      } catch (err) {
        code = err.status;
      }
      assert.equal(code, 3);
    } finally {
      p.cleanup();
    }
  });

  test("--dry-run lists files without writing an archive", () => {
    const p = tmpProject();
    try {
      p.write("a.kt", "x");
      const out = path.join(p.dir, "none.zip");
      const res = execFileSync(NODE, [path.join(ROOT, "scripts/package-zip.mjs"), "--project", p.dir, "--out", out, "--dry-run"], { encoding: "utf8" });
      assert.match(res, /a\.kt/);
      assert.ok(!fs.existsSync(out));
    } finally {
      p.cleanup();
    }
  });
});

describe("ci-scores-line", () => {
  test("the score line carries the failure diagnosis inline: how close, what is over, and one box", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-shapes-"));
    try {
      const file = path.join(dir, "summary.json");
      fs.writeFileSync(
        file,
        JSON.stringify({
          device: "phone",
          results: [
            {
              screen: "home",
              status: "building",
              pixelMatchPct: 96.0406,
              geometryCoveragePct: 0,
              gates: { pixel: { pass: true }, geometry: { pass: false } },
              geometryShape: {
                signature: "scattered",
                nearest: 3.2,
                furthest: 41.5,
                over: { dx: 4, dy: 9, dw: 12, dh: 7 },
                closest: [{ text: "COLLECTION", ref: [16, 16, 82, 16], cand: [16, 16, 79, 15], d: [0, 0, 3, 1] }],
              },
            },
            { screen: "library", status: "building", pixelMatchPct: 87.5, geometryCoveragePct: 100, gates: { pixel: { pass: false } }, geometryShape: null },
          ],
        }),
      );
      const line = execFileSync(process.execPath, [path.join(ROOT, "scripts/ci-scores-line.mjs"), file], { encoding: "utf8" }).trim();
      // The annotation budget is per job, so this one line is the only place these numbers can live.
      assert.equal(line.split("\n").length, 1, "a multi-line annotation is truncated after its first line");
      assert.match(line, /home building .* shape=scattered\(near3\.2\/41\.5, dx4 dy9 dw12 dh7, "COLLECTION" ref\[16,16 82x16\] cand\[16,16 79x15\]\)/);
      assert.doesNotMatch(line, /library .*shape=/, "a screen that passed geometry reports no signature");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("one line, every screen, both gates, so a CI annotation cannot lose the result", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uiport-scores-"));
    try {
      const file = path.join(dir, "summary.json");
      fs.writeFileSync(
        file,
        JSON.stringify({
          device: "phone",
          results: [
            { screen: "home", status: "matched", pixelMatchPct: 99.2, ssim: 0.98, geometryCoveragePct: 97.4, iterations: 2, residualCategories: ["font-rasterization"], gates: { pixel: { pass: true }, geometry: { pass: true } } },
            { screen: "library", status: "building", pixelMatchPct: 87.5, ssim: 0.57, geometryCoveragePct: 0, iterations: 1, gates: { pixel: { pass: false }, geometry: { pass: false } } },
          ],
        }),
      );
      const out = execFileSync(process.execPath, [path.join(ROOT, "scripts/ci-scores-line.mjs"), file], { encoding: "utf8" }).trim();
      assert.equal(out.split("\n").length, 1, "a multi-line annotation is truncated after its first line");
      assert.match(out, /^phone: home matched pixel=99\.2/);
      assert.match(out, /library building pixel=87\.5/);
      assert.match(out, /geom=0 iter=1 resid=none \[pixel=fail,geometry=fail\]/);
      assert.match(out, /resid=font-rasterization/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("size assess", () => {
  test("measures the real test bed, writes the numbers, and reports the tier that governs", () => {
    const p = tmpProject();
    try {
      const res = cli(p.dir, "size", "assess", path.join(ROOT, "testbed/prototype"), "--app", path.join(ROOT, "testbed/SimpMusic"));
      assert.equal(res.code, 0);
      assert.match(res.stdout, /Verdict: `LARGE`/);
      assert.match(res.stdout, /Governing tier: `LARGE`/);
      const saved = JSON.parse(p.read(".uiport/size-assessment.json"));
      assert.equal(saved.assessment.tier, "LARGE");
      assert.equal(saved.governing.tier, "LARGE");
      assert.equal(saved.governing.overridden, false);
      assert.equal(saved.subjects[0].metrics.screens, 23);
    } finally {
      p.cleanup();
    }
  });

  test("a recorded override changes the strategy and shows the disagreement, not just the verdict", () => {
    const p = tmpProject();
    try {
      p.json(".uiport/answers.json", {
        deviceTargets: ["phone"],
        executionMode: "HYBRID",
        extraFeatures: {},
        allowEngineEdits: false,
        delivery: ["zip"],
        sizeOverride: { tier: "MEDIUM", reason: "every route already has a runtime flag" },
      });
      const res = cli(p.dir, "size", "assess", path.join(ROOT, "testbed/prototype"), "--app", path.join(ROOT, "testbed/SimpMusic"));
      assert.equal(res.code, 0);
      assert.match(res.stdout, /Override applies:\*\* the run is `MEDIUM` \(strategy `slices`\), not the computed `LARGE`/);
      assert.match(res.stdout, /Reason given: every route already has a runtime flag/);
      assert.match(res.stdout, /Computed reason: exceeds the MEDIUM budget in 4 dimensions/);
    } finally {
      p.cleanup();
    }
  });

  test("no path is a usage error, and an unclassifiable path exits 4", () => {
    const p = tmpProject();
    try {
      assert.equal(cli(p.dir, "size", "assess").code, 2);
      const bad = cli(p.dir, "size", "assess", p.dir);
      assert.equal(bad.code, 4);
      assert.match(bad.stderr, /neither a prototype/);
    } finally {
      p.cleanup();
    }
  });
});
