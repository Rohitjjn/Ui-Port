import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function tmpProject(prefix = "uiport-test-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    dir,
    file(...parts) {
      const p = path.join(dir, ...parts);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      return p;
    },
    write(rel, content) {
      const p = path.join(dir, rel);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, content);
      return p;
    },
    json(rel, value) {
      return this.write(rel, JSON.stringify(value, null, 2));
    },
    read(rel) {
      return fs.readFileSync(path.join(dir, rel), "utf8");
    },
    exists(rel) {
      return fs.existsSync(path.join(dir, rel));
    },
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** A realistic environment snapshot: everything installed, GitHub connected. */
export function snapshot(overrides = {}) {
  return {
    os: { platform: "linux", release: "6.0", arch: "x64" },
    node: { present: true, version: "22.22.3" },
    jdk: { present: true, version: "21.0.5", major: 21 },
    androidSdk: { present: true, path: "/opt/android-sdk" },
    gradleWrapper: { present: true, path: "gradlew" },
    gradleCli: { present: false, version: null },
    git: { present: true, version: "2.39.5" },
    gh: { present: true, authenticated: true },
    gitHubRemote: { present: true, url: "git@github.com:me/app.git", host: "github.com", owner: "me", repo: "app" },
    diskFreeGb: 40,
    isCI: false,
    ...overrides,
  };
}

export const validAnswers = {
  deviceTargets: ["phone"],
  executionMode: "HYBRID",
  ponytail: false,
  extraFeatures: { "canvas-video": "remove-from-ui", "sleep-timer": "build-in-engine" },
  allowEngineEdits: false,
  delivery: ["zip"],
};
