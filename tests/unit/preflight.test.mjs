import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { snapshot, tmpProject } from "../helpers/fixtures.mjs";
import {
  classifyEnvironment,
  detectProjectCase,
  findAndroidSdk,
  parseJavaMajor,
  renderPreflightReport,
  toolPlan,
} from "../../scripts/lib/preflight.mjs";

describe("execution mode classification", () => {
  test("LOCAL_FULL when JDK, SDK, Gradle and Node are present", () => {
    const r = classifyEnvironment(snapshot());
    assert.equal(r.mode, "LOCAL_FULL");
    assert.deepEqual(r.reasons, []);
    assert.equal(r.capabilities.canBuildLocally, true);
  });

  test("HYBRID when heavy tooling is missing but GitHub is connected and Node exists", () => {
    const r = classifyEnvironment(snapshot({ jdk: { present: false, major: null }, androidSdk: { present: false } }));
    assert.equal(r.mode, "HYBRID");
    assert.match(r.reasons.join(" "), /no JDK/);
    assert.match(r.reasons.join(" "), /no Android SDK/);
    assert.equal(r.capabilities.canCaptureLocally, true);
    assert.equal(r.capabilities.hasGitHubActions, true);
  });

  test("CI_ONLY when Node is missing too", () => {
    const r = classifyEnvironment(
      snapshot({ node: { present: false }, jdk: { present: false, major: null }, androidSdk: { present: false } }),
    );
    assert.equal(r.mode, "CI_ONLY");
    assert.equal(r.capabilities.canRunPlaywrightLocally, false);
  });

  test("LIMITED when nothing heavy and no GitHub remote", () => {
    const r = classifyEnvironment(
      snapshot({
        node: { present: false },
        jdk: { present: false, major: null },
        androidSdk: { present: false },
        gitHubRemote: { present: false, host: null },
      }),
    );
    assert.equal(r.mode, "LIMITED");
    assert.equal(r.capabilities.hasGitHubActions, false);
  });

  test("an old JDK (11) does not count as heavy tooling", () => {
    const r = classifyEnvironment(snapshot({ jdk: { present: true, major: 11, version: "11.0.2" } }));
    assert.notEqual(r.mode, "LOCAL_FULL");
    assert.match(r.reasons.join(" "), /JDK >= 17/);
  });

  test("a non-GitHub remote does not count as Actions available", () => {
    const r = classifyEnvironment(
      snapshot({
        jdk: { present: false, major: null },
        androidSdk: { present: false },
        gitHubRemote: { present: true, host: "gitlab.com" },
      }),
    );
    assert.equal(r.mode, "LIMITED");
  });

  test("java version parsing handles the 1.8 form", () => {
    assert.equal(parseJavaMajor("1.8.0_402"), 8);
    assert.equal(parseJavaMajor("21.0.5"), 21);
    assert.equal(parseJavaMajor("garbage"), null);
  });
});

describe("tool plan", () => {
  test("LOCAL_FULL installs the capture + diff + screenshot stack", () => {
    const ids = toolPlan("LOCAL_FULL", snapshot()).map((p) => p.id);
    assert.deepEqual(ids, ["playwright", "pixelmatch", "pngjs", "ssim-js", "yaml", "roborazzi", "ktlint"]);
  });

  test("LIMITED installs nothing that cannot run", () => {
    const ids = toolPlan("LIMITED", snapshot()).map((p) => p.id);
    assert.deepEqual(ids, ["ktlint"]);
  });

  test("CI_ONLY still plans the screenshot tool, marked for CI", () => {
    const plan = toolPlan("CI_ONLY", snapshot());
    const roborazzi = plan.find((p) => p.id === "roborazzi");
    assert.match(roborazzi.why, /GitHub Actions/);
  });
});

describe("project case detection", () => {
  test("case 1: engine plus an existing Compose UI", () => {
    const p = tmpProject();
    try {
      for (let i = 0; i < 25; i++) p.write(`app/src/main/java/lib/data/Foo${i}.kt`, "class Foo");
      for (let i = 0; i < 8; i++) p.write(`app/src/main/java/lib/ui/screen/Screen${i}.kt`, "@Composable fun S() {}");
      p.write("app/src/main/java/lib/ui/HomeViewModel.kt", "class HomeViewModel");
      const r = detectProjectCase(p.dir);
      assert.equal(r.projectCase, "case-1-old-ui-plus-engine");
    } finally {
      p.cleanup();
    }
  });

  test("case 2: engine only, no UI", () => {
    const p = tmpProject();
    try {
      for (let i = 0; i < 30; i++) p.write(`core/data/Repo${i}.kt`, "class Repo");
      p.write("core/di/Modules.kt", "val module = module {}");
      const r = detectProjectCase(p.dir);
      assert.equal(r.projectCase, "case-2-engine-only");
      assert.equal(r.hasOldUi, false);
    } finally {
      p.cleanup();
    }
  });

  test("case 3: empty project", () => {
    const p = tmpProject();
    try {
      p.write("README.md", "# empty");
      assert.equal(detectProjectCase(p.dir).projectCase, "case-3-nothing");
    } finally {
      p.cleanup();
    }
  });

  test("node_modules and testbed are ignored when detecting", () => {
    const p = tmpProject();
    try {
      for (let i = 0; i < 40; i++) p.write(`node_modules/pkg/File${i}.kt`, "x");
      for (let i = 0; i < 40; i++) p.write(`testbed/Big/ui/Screen${i}.kt`, "x");
      assert.equal(detectProjectCase(p.dir).projectCase, "case-3-nothing");
    } finally {
      p.cleanup();
    }
  });
});

describe("android sdk discovery", () => {
  test("finds the SDK from ANDROID_HOME", () => {
    const p = tmpProject();
    try {
      const sdk = p.file("sdk", "platforms", "android-37");
      const r = findAndroidSdk({ env: { ANDROID_HOME: p.file("sdk") }, projectRoot: p.dir });
      assert.equal(r.present, true);
      assert.ok(sdk);
    } finally {
      p.cleanup();
    }
  });

  test("reports missing when nothing is configured", () => {
    const p = tmpProject();
    try {
      const r = findAndroidSdk({ env: {}, projectRoot: p.dir });
      assert.equal(r.present, false);
    } finally {
      p.cleanup();
    }
  });
});

test("report renders the mode and detected case", () => {
  const snap = snapshot();
  const report = renderPreflightReport(snap, classifyEnvironment(snap), {
    projectCase: "case-2-engine-only",
    signals: { kotlinFiles: 30, composeUiFiles: 0, viewModelFiles: 3, diFiles: 1, dataFiles: 9 },
  });
  assert.match(report, /Execution mode: `LOCAL_FULL`/);
  assert.match(report, /case-2-engine-only/);
});
