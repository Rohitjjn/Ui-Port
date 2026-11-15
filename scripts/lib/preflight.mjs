/**
 * Environment detection and classification.
 *
 * Pure functions over an "environment snapshot" object so every classification
 * branch is unit-testable without touching the real machine. `probeEnvironment()`
 * is the only impure part and is injected in tests.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const EXECUTION_MODES = ["LOCAL_FULL", "CI_ONLY", "HYBRID", "LIMITED"];

export const TOOL_REQUIREMENTS = {
  localFull: ["jdk", "androidSdk", "gradle", "node", "git"],
  ciNeeds: ["gitHubRemote", "ghAuth"],
};

function version(cmd, args = ["--version"]) {
  try {
    const out = execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 15000 });
    const first = out.trim().split("\n")[0].trim();
    const m = first.match(/(\d+)(\.\d+)*/);
    return { present: true, version: m ? m[0] : first };
  } catch {
    return { present: false, version: null };
  }
}

export function parseJavaMajor(raw) {
  if (!raw) return null;
  const m = raw.match(/^(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  const first = Number(m[1]);
  if (first === 1 && m[2] !== undefined) return Number(m[2]);
  return first;
}

/** Read the SDK location the same way Gradle/Android Studio do. */
export function findAndroidSdk({ env = process.env, projectRoot = process.cwd() } = {}) {
  const explicitEnv = Boolean(env.ANDROID_HOME || env.ANDROID_SDK_ROOT);
  const candidates = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT];
  const localProps = path.join(projectRoot, "local.properties");
  if (fs.existsSync(localProps)) {
    const txt = fs.readFileSync(localProps, "utf8");
    const m = txt.match(/^sdk\.dir=(.+)$/m);
    if (m) candidates.push(m[1].trim().replace(/\\\\/g, "\\"));
  }
  // Well-known install locations are only consulted when the caller did not hand in an
  // explicit environment. Otherwise "nothing is configured" would still find the runner's
  // preinstalled SDK and the answer would depend on the machine, not on the input.
  if (!explicitEnv) {
    if (process.platform === "darwin") candidates.push(path.join(os.homedir(), "Library/Android/sdk"));
    if (process.platform === "linux") candidates.push(path.join(os.homedir(), "Android/Sdk"));
    if (process.platform === "win32") candidates.push(path.join(env.LOCALAPPDATA ?? "", "Android/Sdk"));
  }
  for (const c of candidates) {
    if (!c) continue;
    if (fs.existsSync(path.join(c, "platforms")) || fs.existsSync(path.join(c, "cmdline-tools"))) {
      return { present: true, path: c };
    }
  }
  return { present: false, path: null };
}

export function hasGradleWrapper(projectRoot) {
  const win = path.join(projectRoot, "gradlew.bat");
  const nix = path.join(projectRoot, "gradlew");
  if (fs.existsSync(nix) || fs.existsSync(win)) {
    return { present: true, path: fs.existsSync(nix) ? "gradlew" : "gradlew.bat" };
  }
  return { present: false, path: null };
}

export function gitRemote(projectRoot) {
  try {
    const out = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const m = out.match(/github\.com[:/]([^/]+)\/([^/\s]+?)(?:\.git)?$/);
    return { present: true, url: out, host: m ? "github.com" : new URLishHost(out), owner: m?.[1] ?? null, repo: m?.[2] ?? null };
  } catch {
    return { present: false, url: null, host: null, owner: null, repo: null };
  }
}

function URLishHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

export function ghAuth() {
  try {
    execFileSync("gh", ["auth", "status"], { stdio: ["ignore", "ignore", "ignore"], timeout: 15000 });
    return { present: true, authenticated: true };
  } catch {
    const bin = version("gh");
    return { present: bin.present, authenticated: false };
  }
}

export function diskFreeGb(dir = process.cwd()) {
  try {
    const stat = fs.statfsSync(dir);
    return Math.round(((stat.bavail * stat.bsize) / 1024 ** 3) * 10) / 10;
  } catch {
    return null;
  }
}

export function probeEnvironment({ projectRoot = process.cwd(), env = process.env } = {}) {
  const node = version("node", ["--version"]);
  const java = version("java", ["-version"]);
  const git = version("git", ["--version"]);
  const gradle = hasGradleWrapper(projectRoot);
  const sdk = findAndroidSdk({ env, projectRoot });
  return {
    os: { platform: process.platform, release: os.release(), arch: process.arch },
    node,
    jdk: { ...java, major: parseJavaMajor(java.version) },
    androidSdk: sdk,
    gradleWrapper: gradle,
    gradleCli: version("gradle", ["--version"]),
    git,
    gh: ghAuth(),
    gitHubRemote: gitRemote(projectRoot),
    diskFreeGb: diskFreeGb(projectRoot),
    isCI: Boolean(env.CI),
  };
}

/**
 * Classify an environment snapshot into one of the four execution modes.
 * This is the decision the user is asked to confirm at Step 0.
 */
export function classifyEnvironment(snap) {
  const reasons = [];
  const hasJdk = Boolean(snap.jdk?.present) && (snap.jdk?.major ?? 0) >= 17;
  const hasSdk = Boolean(snap.androidSdk?.present);
  const hasGradle = Boolean(snap.gradleWrapper?.present) || Boolean(snap.gradleCli?.present);
  const hasNode = Boolean(snap.node?.present);
  const heavyLocal = hasJdk && hasSdk && hasGradle;
  const githubConnected = Boolean(snap.gitHubRemote?.present) && snap.gitHubRemote?.host === "github.com";
  const ghOk = Boolean(snap.gh?.authenticated);

  if (!hasJdk) reasons.push("no JDK >= 17 on PATH");
  if (!hasSdk) reasons.push("no Android SDK found");
  if (!hasGradle) reasons.push("no Gradle wrapper in the project");
  if (!hasNode) reasons.push("no Node.js on PATH");

  let mode;
  if (heavyLocal && hasNode) {
    mode = "LOCAL_FULL";
  } else if (!heavyLocal && githubConnected) {
    // Heavy work must happen somewhere. With Actions available, light work can
    // still run here (Node is enough for mapping, diffing and code generation).
    mode = hasNode ? "HYBRID" : "CI_ONLY";
    if (!hasNode) reasons.push("Node is missing, so even light local work is limited to what the agent can do by reading files");
  } else {
    mode = "LIMITED";
  }
  return {
    mode,
    reasons,
    capabilities: {
      canBuildLocally: heavyLocal,
      canRunPlaywrightLocally: hasNode,
      hasGitHubActions: githubConnected,
      canPushBranch: ghOk,
      canCaptureLocally: hasNode,
    },
  };
}

/** Project case detection: does an engine exist, does an old UI exist, or is the project empty? */
export function detectProjectCase(projectRoot) {
  const signals = {
    gradleFiles: [],
    kotlinFiles: 0,
    composeUiFiles: 0,
    viewModelFiles: 0,
    diFiles: 0,
    dataFiles: 0,
    androidManifest: false,
  };
  const skip = new Set([".git", "node_modules", "build", ".gradle", ".uiport", "testbed"]);
  const stack = [projectRoot];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!skip.has(e.name)) stack.push(full);
        continue;
      }
      const lower = e.name.toLowerCase();
      if (lower === "build.gradle.kts" || lower === "build.gradle" || lower === "settings.gradle.kts") {
        signals.gradleFiles.push(path.relative(projectRoot, full));
      }
      if (lower === "androidmanifest.xml") signals.androidManifest = true;
      if (lower.endsWith(".kt")) {
        signals.kotlinFiles++;
        // Backslash paths on Windows must classify identically: normalise separators
        // first, otherwise every /ui/, /di/ and /data/ signal reads as zero on one OS
        // and a real project is misdetected as "nothing".
        const p = full.toLowerCase().replace(/\\/g, "/");
        if (p.includes("/ui/") || p.includes("/screen") || p.includes("composable")) signals.composeUiFiles++;
        if (p.includes("viewmodel")) signals.viewModelFiles++;
        if (p.includes("/di/") || p.includes("module.kt") || p.includes("koin") || p.includes("hilt")) signals.diFiles++;
        if (p.includes("/data/") || p.includes("/repository") || p.includes("/database")) signals.dataFiles++;
      }
    }
  }
  const hasEngine = signals.kotlinFiles > 20 && (signals.viewModelFiles > 0 || signals.dataFiles > 0 || signals.diFiles > 0);
  const hasOldUi = signals.composeUiFiles >= 5;
  let projectCase;
  if (hasEngine && hasOldUi) projectCase = "case-1-old-ui-plus-engine";
  else if (hasEngine && !hasOldUi) projectCase = "case-2-engine-only";
  else projectCase = "case-3-nothing";
  return { projectCase, hasEngine, hasOldUi, signals };
}

/** Tools the environment still needs, as ids from config/tools.json. */
export function toolPlan(mode, snap) {
  const plan = [];
  const add = (id, why) => plan.push({ id, why });
  if (mode !== "LIMITED") {
    add("playwright", "capture the prototype at every viewport with frozen animations");
    add("pixelmatch", "pixel diff percentage and heat map");
    add("pngjs", "PNG IO without native builds (Windows/macOS/Linux)");
    add("ssim-js", "SSIM score per screen");
    add("yaml", "frontmatter and workflow validation");
  }
  if (mode !== "LIMITED" && mode !== "CI_ONLY") add("roborazzi", "render Compose screens on the JVM for diffing");
  if (mode === "CI_ONLY") add("roborazzi", "rendered inside GitHub Actions instead of locally");
  add("ktlint", "fast per-file Kotlin lint in the PostToolUse hook");
  return plan;
}

export function renderPreflightReport(snap, classification, detected) {
  const row = (k, v) => `| ${k} | ${v} |`;
  const yn = (b) => (b ? "yes" : "no");
  const lines = [
    "# Preflight",
    "",
    "## Environment",
    "",
    "| Item | Value |",
    "| --- | --- |",
    row("OS", `${snap.os.platform} ${snap.os.release} (${snap.os.arch})`),
    row("Node", snap.node?.present ? snap.node.version : "missing"),
    row("JDK", snap.jdk?.present ? `${snap.jdk.version} (major ${snap.jdk.major ?? "?"})` : "missing"),
    row("Android SDK", snap.androidSdk?.present ? snap.androidSdk.path : "missing"),
    row("Gradle wrapper", snap.gradleWrapper?.present ? snap.gradleWrapper.path : "missing"),
    row("git", snap.git?.present ? snap.git.version : "missing"),
    row("gh authenticated", yn(snap.gh?.authenticated)),
    row("GitHub remote", snap.gitHubRemote?.url ?? "none"),
    row("Free disk", snap.diskFreeGb == null ? "unknown" : `${snap.diskFreeGb} GB`),
    row("CI runner", yn(snap.isCI)),
    "",
    `## Execution mode: \`${classification.mode}\``,
    "",
    ...classification.reasons.map((r) => `- ${r}`),
    "",
    "## Project case (detected)",
    "",
    `\`${detected.projectCase}\` — Kotlin files: ${detected.signals.kotlinFiles}, UI files: ${detected.signals.composeUiFiles}, ViewModels: ${detected.signals.viewModelFiles}, DI files: ${detected.signals.diFiles}, data files: ${detected.signals.dataFiles}.`,
    "",
  ];
  return lines.join("\n");
}
