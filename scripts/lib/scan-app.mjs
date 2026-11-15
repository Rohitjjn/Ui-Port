/**
 * App scanner — static analysis of an Android / Kotlin Multiplatform project.
 *
 * Produces the compact "app map": modules, build toolchain versions, screens,
 * navigation destinations, ViewModels and the state they expose, DI modules,
 * engine entry points (repositories / use cases / DAOs), data models, and the
 * split between UI code and engine code (which becomes engine-paths.json).
 *
 * Regex based on purpose: no Kotlin compiler dependency, runs in a second.
 */
import path from "node:path";
import { readText, rel, toPosix, walk } from "./fs-utils.mjs";

const UI_PATH_HINTS = [/(^|\/)(ui|presentation|screens?|compose)(\/|$)/i, /(^|\/)component(s)?(\/|$)/i, /(^|\/)theme(\/|$)/i];
const ENGINE_PATH_HINTS = [
  /(^|\/)(data|domain|repository|repositories|database|dao|network|api|service|services|media|player|engine|core)(\/|$)/i,
  /(^|\/)(di|injection)(\/|$)/i,
];
const UI_NAME_HINTS = [/(Screen|View|Ui|Composable)\.kt$/, /(Theme|Colors?|Typography|Shapes|Dimens)\.kt$/];
const ENGINE_NAME_HINTS = [
  /(Repository|Repo|DataSource|Dao|Database|Service|UseCase|Interactor|Client|Api|Engine|Player|Manager|Module|Mapper|Entity)\.kt$/,
];

export function parseGradleVersions(root) {
  const out = {};
  const toml = readText(path.join(root, "gradle", "libs.versions.toml"), null);
  if (toml) {
    const versions = {};
    const section = (name) => {
      const m = toml.match(new RegExp(`\\[${name}\\]([\\s\\S]*?)(?=\\n\\[|$)`));
      return m ? m[1] : "";
    };
    for (const m of section("versions").matchAll(/^\s*([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)"/gm)) versions[m[1]] = m[2];
    out.catalog = versions;
    out.catalogKeys = {
      agp: pick(versions, ["android", "agp", "android-gradle-plugin", "androidGradlePlugin"]),
      kotlin: pick(versions, ["kotlin"]),
      composeBom: pick(versions, ["compose-bom", "composeBom"]),
      composeMultiplatform: pick(versions, ["composeMultiplatform", "compose-multiplatform"]),
      ksp: pick(versions, ["ksp"]),
      koin: pick(versions, ["koin-bom", "koin"]),
      roborazzi: pick(versions, ["roborazzi"]),
      paparazzi: pick(versions, ["paparazzi"]),
      room: pick(versions, ["room"]),
    };
  }
  const wrapper = readText(path.join(root, "gradle", "wrapper", "gradle-wrapper.properties"), null);
  if (wrapper) {
    const m = wrapper.match(/distributionUrl=.*gradle-([0-9][^-\s]*)-(bin|all)\.zip/);
    out.gradle = m ? m[1] : null;
  }
  // compileSdk / minSdk / jvmTarget from any build.gradle.kts
  const sdks = {};
  for (const f of walk(path.join(root), { maxFiles: 20000 }).filter((x) => x.endsWith("build.gradle.kts"))) {
    const src = readText(f, "");
    const cs = src.match(/compileSdk\s*=\s*(\d+)/);
    const ms = src.match(/minSdk\s*=\s*(\d+)/);
    const ts = src.match(/targetSdk\s*=\s*(\d+)/);
    const jvm = src.match(/jvmTarget(?:\.set)?\s*=?\s*(?:JvmTarget\.)?JVM_(\d+)/);
    if (cs || ms || ts || jvm) {
      sdks[toPosix(rel(root, f))] = {
        compileSdk: cs ? Number(cs[1]) : null,
        minSdk: ms ? Number(ms[1]) : null,
        targetSdk: ts ? Number(ts[1]) : null,
        jvmTarget: jvm ? Number(jvm[1]) : null,
      };
    }
  }
  out.android = sdks;
  return out;
}

function pick(map, keys) {
  for (const k of keys) if (map[k]) return map[k];
  return null;
}

export function parseSettingsModules(root) {
  const text =
    readText(path.join(root, "settings.gradle.kts"), null) ?? readText(path.join(root, "settings.gradle"), null) ?? "";
  const modules = [];
  for (const m of text.matchAll(/include\(\s*([^)]*)\)/g)) {
    for (const q of m[1].matchAll(/"([^"]+)"/g)) modules.push(q[1].replace(/^:/, ""));
  }
  // project(":x").projectDir = File(...) remaps
  const remaps = {};
  for (const m of text.matchAll(/project\(\s*"(:[^"]+)"\s*\)\s*\.projectDir\s*=\s*File\(([^)]*)\)/g)) {
    remaps[m[1].replace(/^:/, "")] = m[2].trim();
  }
  const desktopTargets = [];
  if (/[^\w]jvm\(\)/.test(text) || text.includes("desktop")) desktopTargets.push("jvm");
  return { modules: [...new Set(modules)], remaps, isMultiplatform: /kotlin\s*\(\s*"multiplatform"/.test(text) || text.includes("compose-multiplatform") };
}

export function classifyFile(posixPath, source) {
  const uiScore =
    UI_PATH_HINTS.filter((re) => re.test(posixPath)).length * 2 +
    UI_NAME_HINTS.filter((re) => re.test(posixPath)).length * 2 +
    (/@Composable/.test(source) ? 3 : 0);
  const engineScore =
    ENGINE_PATH_HINTS.filter((re) => re.test(posixPath)).length * 2 +
    ENGINE_NAME_HINTS.filter((re) => re.test(posixPath)).length * 2 +
    (/@(Dao|Entity|Serializable|Inject|Module|Singleton|Provides)\b/.test(source) ? 2 : 0) +
    (/\b(interface|abstract class)\s+\w+(Repository|DataSource|UseCase)\b/.test(source) ? 3 : 0);
  if (uiScore > engineScore && uiScore >= 2) return "ui";
  if (engineScore > uiScore && engineScore >= 2) return "engine";
  if (/@Composable/.test(source)) return "ui";
  return "shared";
}

/**
 * Find composables by locating `@Composable` annotations first, then the
 * declaration that follows them (annotations and modifiers may span lines).
 * A regex that requires "fun" to be on the same line as a preceding annotation
 * misses most real-world Compose code.
 */
export function parseComposables(source) {
  const out = [];
  const annRe = /@Composable\b/g;
  let m;
  while ((m = annRe.exec(source))) {
    const tail = source.slice(m.index, m.index + 1200);
    const decl = tail.match(/\bfun\s+(?:<[^>]*>\s*)?([A-Za-z0-9_.]+)\s*\(/);
    if (!decl) continue;
    const name = decl[1].split(".").pop();
    // The whole declaration counts: default parameter values (koinViewModel(),
    // remember...) are part of how the composable gets its state.
    const body = sliceFunctionBody(source, m.index + decl.index);
    const isScreen = /(Screen|Page|Route)$/.test(name);
    out.push({
      name,
      isScreen,
      hasState: /\bremember\b|\brememberSaveable\b|\bcollectAsState/.test(body),
      usesViewModel: /koinViewModel|hiltViewModel|koinInject|\bviewModel\s*\(/.test(body),
      visibility: /\bprivate\b[\s\S]{0,60}$/.test(tail.slice(0, decl.index)) ? "private" : "public",
    });
  }
  return dedupeByName(out);
}

function dedupeByName(list) {
  const seen = new Set();
  return list.filter((c) => (seen.has(c.name) ? false : (seen.add(c.name), true)));
}

/**
 * From a `fun` declaration, return the source of its body.
 * The parameter list is balanced first, because default arguments contain braces
 * (`onScroll: () -> Unit = {}`) and would otherwise look like the body.
 */
function sliceFunctionBody(source, fromIndex) {
  const paren = source.indexOf("(", fromIndex);
  if (paren === -1) return "";
  let pd = 0;
  let afterParams = -1;
  for (let i = paren; i < source.length; i++) {
    if (source[i] === "(") pd++;
    else if (source[i] === ")") {
      pd--;
      if (pd === 0) {
        afterParams = i + 1;
        break;
      }
    }
  }
  if (afterParams === -1) return "";
  // skip a return type / `where` clause up to the body brace
  const open = source.indexOf("{", afterParams);
  if (open === -1) return source.slice(fromIndex, Math.min(afterParams, fromIndex + 4000));
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(fromIndex, Math.min(i + 1, fromIndex + 24000));
    }
  }
  return source.slice(fromIndex, open + 20000);
}

export function parseNavDestinations(sources) {
  const out = [];
  for (const [file, src] of Object.entries(sources)) {
    for (const m of src.matchAll(/(?:object|data object|data class)\s+([A-Za-z0-9_]+)\s*(?:\([^)]*\))?\s*:\s*([A-Za-z0-9_.]+)/g)) {
      if (/Destination|Nav|Route|Screen/i.test(m[2]) || /Destination$/.test(m[1])) out.push({ name: m[1], type: m[2], file });
    }
    for (const m of src.matchAll(/composable\(\s*(?:route\s*=\s*)?["']([^"']+)["']/g)) out.push({ route: m[1], file });
    for (const m of src.matchAll(/navigate\(\s*([A-Za-z0-9_]+)\(/g)) out.push({ navigateTarget: m[1], file });
    for (const m of src.matchAll(/NavHost\(/g)) out.push({ navHost: true, file });
  }
  const seen = new Set();
  return out.filter((d) => {
    const k = JSON.stringify(d);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function parseViewModels(sources) {
  const out = [];
  for (const [file, src] of Object.entries(sources)) {
    // KMP ViewModels often implement interfaces after the type (": ViewModel(), Foo, Bar"),
    // so the supertype group stays loose and the ViewModel check is done in code.
    const vmRe = /class\s+([A-Za-z0-9_]+)\s*(?:<[^>]*>)?\s*(?:@Inject\s+)?(?:constructor\s*)?\(([\s\S]{0,600}?)\)\s*(?::|\{)([\s\S]{0,160})/g;
    for (const m of src.matchAll(vmRe)) {
      if (!/ViewModel/.test(m[3])) continue;
      const deps = m[2]
        .split(/,\s*(?=\s*(?:private|internal|public|val|var)\s+[a-zA-Z_])/)
        .map((d) => d.match(/(?:val|var)\s+([a-zA-Z_][A-Za-z0-9_]*)\s*:/)?.[1] ?? d.split(":")[0].trim())
        .filter((d) => /^[a-zA-Z_][A-Za-z0-9_]*$/.test(d));
      // Public (non-underscore) StateFlows are the surface the UI can collect.
      const exposed = [];
      for (const s of src.matchAll(/(?:^|\n)\s*(?:val|var)\s+([a-zA-Z][A-Za-z0-9_]*)\s*:\s*([A-Za-z0-9_<>,.\s?]*StateFlow[A-Za-z0-9_<>,.\s?]*)\s*=/g)) {
        if (s[1].startsWith("_")) continue;
        exposed.push({ name: s[1], type: s[2].trim() });
      }
      out.push({ name: m[1], file, deps, state: exposed.slice(0, 25) });
    }
  }
  return out;
}

export function parseDiModules(sources) {
  const out = [];
  for (const [file, src] of Object.entries(sources)) {
    if (/\bmodule\s*\{/.test(src) || /@Module/.test(src)) {
      const singles = [...src.matchAll(/(single|factory|viewModel|worker)\s*(?:<[^>]*>)?\s*(?:\([^)]*\))?\s*\{/g)].map((m) => m[1]);
      const binds = [...src.matchAll(/bind\s*<([^>]+)>\s*\{/g)].map((m) => m[1].trim());
      out.push({ file, kind: /@Module/.test(src) ? "dagger" : "koin", registrations: singles.length + binds.length, binds: binds.slice(0, 10) });
    }
  }
  return out;
}

export function parseDataModels(sources) {
  const out = [];
  for (const [file, src] of Object.entries(sources)) {
    for (const m of src.matchAll(/(?:^|\n)(?:@Serializable\s*\n)?(?:data class|class)\s+([A-Za-z0-9_]+)\s*(?:<[^>]*>)?\s*\(([\s\S]{0,800}?)\)\s*(?::|\\{|$)/g)) {
      const fields = m[2]
        .split(/,\s*\n/)
        .map((f) => f.trim())
        .filter((f) => f && f.includes(":"))
        .map((f) => {
          const [namePart, typePart] = f.split(":");
          return { name: namePart.trim().replace(/^(val|var)\s+/, ""), type: (typePart ?? "").split("=")[0].trim() };
        })
        .filter((f) => /^[a-zA-Z_][A-Za-z0-9_]*$/.test(f.name));
      if (fields.length) out.push({ name: m[1], file, fields: fields.slice(0, 40) });
    }
  }
  const seen = new Set();
  return out.filter((d) => (seen.has(d.name) ? false : (seen.add(d.name), true)));
}

export function engineEntryPoints(sources, classification) {
  const out = [];
  for (const [file, src] of Object.entries(sources)) {
    if (classification[file] === "ui") continue;
    for (const m of src.matchAll(/interface\s+([A-Za-z0-9_]*(?:Repository|UseCase|DataSource|Service|Dao))\b/g)) {
      const body = src.slice(m.index, m.index + 3000);
      const fns = [...body.matchAll(/\n\s*(?:suspend\s+)?fun\s+([A-Za-z0-9_]+)\s*\(/g)].map((f) => f[1]).slice(0, 12);
      out.push({ type: "interface", name: m[1], file, functions: fns });
    }
    for (const m of src.matchAll(/class\s+([A-Za-z0-9_]*(?:Repository|UseCase|Engine|Player)(?:Impl)?)\b/g)) {
      out.push({ type: "class", name: m[1], file });
    }
  }
  return out.slice(0, 400);
}

/**
 * Globs that must be protected from agent edits: engine code, never UI code.
 *
 * A directory becomes a single gitignore-style glob ONLY when every Kotlin file
 * in it is engine code. Mixed directories (the common case: a `ui/` folder that
 * holds both the screen and its view-model glue) are protected file by file, so
 * the agent is never blocked from editing UI. Protecting a whole module
 * (`composeApp/**`) would be a catastrophic false positive: it would forbid the
 * very work the plugin exists to do.
 */
export function engineGlobs(classification) {
  const dirKinds = new Map();
  for (const [file, kind] of Object.entries(classification)) {
    const dir = path.posix.dirname(file);
    const entry = dirKinds.get(dir) ?? { ui: 0, engine: 0, shared: 0, files: [] };
    entry[kind]++;
    entry.files.push(file);
    dirKinds.set(dir, entry);
  }
  const globs = new Set();
  for (const [dir, entry] of dirKinds) {
    const hasUi = entry.ui > 0;
    if (!entry.engine) continue;
    if (!hasUi && dir !== ".") {
      globs.add(`${dir}/**`);
    } else {
      for (const f of entry.files) {
        if (classification[f] === "engine") globs.add(f);
      }
    }
  }
  return [...globs].sort();
}

export function scanApp(root, { maxFiles = 20000 } = {}) {
  const files = walk(root, { maxFiles });
  const ktFiles = files.filter((f) => f.endsWith(".kt") || f.endsWith(".kts"));
  const sources = {};
  for (const f of ktFiles) {
    const r = rel(root, f);
    // Never read generated build output or the plugin's own UI-port output.
    if (r.includes("/build/")) continue;
    sources[r] = readText(f, "");
  }
  const classification = {};
  for (const [file, src] of Object.entries(sources)) classification[file] = classifyFile(file, src);

  const counts = { ui: 0, engine: 0, shared: 0 };
  for (const k of Object.values(classification)) counts[k]++;

  const moduleDirs = new Set();
  for (const file of Object.keys(sources)) {
    const parts = file.split("/");
    if (parts.length > 2 && /src$/.test(parts[1] ?? "")) moduleDirs.add(parts.slice(0, 3).join("/"));
  }

  const screens = [];
  const composables = [];
  for (const [file, src] of Object.entries(sources)) {
    if (classification[file] !== "ui") continue;
    many: for (const c of parseComposables(src)) {
      composables.push({ ...c, file });
      if (c.isScreen) screens.push({ name: c.name, file, stateful: c.hasState });
    }
  }

  const viewModels = parseViewModels(sources);
  const nav = parseNavDestinations(sources);
  const di = parseDiModules(sources);
  const models = parseDataModels(sources);
  const entryPoints = engineEntryPoints(sources, classification);

  const uiFiles = Object.entries(classification).filter(([, k]) => k === "ui").map(([f]) => f);
  const engineFiles = Object.entries(classification).filter(([, k]) => k === "engine").map(([f]) => f);

  return {
    root: path.resolve(root),
    generatedAt: new Date().toISOString(),
    modules: parseSettingsModules(root),
    versions: parseGradleVersions(root),
    files: { total: files.length, kotlin: Object.keys(sources).length, ui: counts.ui, engine: counts.engine, shared: counts.shared },
    screens: dedupeBy(screens, (s) => s.name),
    composables: composables.slice(0, 1200),
    viewModels,
    navigation: nav,
    di,
    models: models.slice(0, 200),
    engineEntryPoints: entryPoints,
    split: {
      uiFiles: uiFiles.slice(0, 400),
      engineFiles: engineFiles.slice(0, 400),
      engineGlobs: engineGlobs(classification),
      heuristicNote:
        "Classification is path+content based. Review .uiport/engine-paths.json with the user before the first edit: a false positive blocks legitimate UI work, a false negative lets the agent change engine code.",
    },
  };
}

function dedupeBy(arr, keyFn) {
  const seen = new Set();
  return arr.filter((x) => {
    const k = keyFn(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function renderAppMap(scan) {
  const L = [];
  L.push("# App map", "");
  L.push(`Scanned \`${scan.root}\` at ${scan.generatedAt}.`, "");
  L.push("## Toolchain", "", "| Item | Value |", "| --- | --- |");
  const v = scan.versions;
  L.push(`| Gradle | ${v.gradle ?? "unknown"} |`);
  L.push(`| AGP | ${v.catalogKeys?.agp ?? "unknown"} |`);
  L.push(`| Kotlin | ${v.catalogKeys?.kotlin ?? "unknown"} |`);
  L.push(`| Compose BOM | ${v.catalogKeys?.composeBom ?? "-"} |`);
  L.push(`| Compose Multiplatform | ${v.catalogKeys?.composeMultiplatform ?? "-"} |`);
  L.push(`| KSP | ${v.catalogKeys?.ksp ?? "-"} |`);
  L.push(`| Multiplatform | ${scan.modules.isMultiplatform ? "yes" : "no"} |`);
  const sdkEntry = Object.entries(v.android ?? {})[0];
  if (sdkEntry) L.push(`| Android SDK | compile ${sdkEntry[1].compileSdk ?? "?"}, min ${sdkEntry[1].minSdk ?? "?"} (${sdkEntry[0]}) |`);
  L.push("");
  L.push("## Modules", "");
  L.push(`${scan.modules.modules.length} included modules: ${scan.modules.modules.map((m) => `\`:${m}\``).join(", ")}`);
  if (Object.keys(scan.modules.remaps ?? {}).length) {
    L.push("", "Remapped project dirs:", "");
    for (const [k, val] of Object.entries(scan.modules.remaps)) L.push(`- \`:${k}\` -> ${val}`);
  }
  L.push("");
  L.push("## Code split (UI vs engine)", "");
  L.push(`| Kind | Files |`, `| --- | --- |`);
  L.push(`| UI | ${scan.files.ui} |`);
  L.push(`| Engine | ${scan.files.engine} |`);
  L.push(`| Shared | ${scan.files.shared} |`);
  L.push(`| Kotlin total | ${scan.files.kotlin} |`);
  L.push("");
  L.push("## Screens (composables named *Screen/*Page/*Route)", "");
  L.push(`| Screen | File | Stateful |`, `| --- | --- | --- |`);
  for (const s of scan.screens) L.push(`| ${s.name} | \`${s.file}\` | ${s.stateful ? "yes" : "no"} |`);
  L.push("");
  L.push("## Navigation", "");
  const navHost = scan.navigation.filter((n) => n.navHost);
  if (navHost.length) L.push(`NavHost found in: ${navHost.map((n) => `\`${n.file}\``).join(", ")}`);
  const dests = scan.navigation.filter((n) => n.name);
  if (dests.length) {
    L.push("", "| Destination | Type | File |", "| --- | --- | --- |");
    for (const d of dests.slice(0, 120)) L.push(`| ${d.name} | \`${d.type}\` | \`${d.file}\` |`);
  }
  const routes = scan.navigation.filter((n) => n.route);
  if (routes.length) L.push("", `String routes: ${routes.map((r) => `\`${r.route}\``).slice(0, 60).join(", ")}`);
  L.push("");
  L.push("## ViewModels (the UI's real data source)", "");
  L.push(`| ViewModel | State exposed | Dependencies | File |`, `| --- | --- | --- | --- |`);
  for (const vm of scan.viewModels) {
    const state = vm.state.map((x) => (typeof x === "string" ? x : `${x.name}: ${x.type}`)).slice(0, 4).join("<br>");
    L.push(`| ${vm.name} | ${state || "-"} | ${vm.deps.slice(0, 5).join(", ") || "-"} | \`${vm.file}\` |`);
  }
  L.push("");
  L.push("## Dependency injection", "");
  for (const d of scan.di.slice(0, 40)) L.push(`- \`${d.file}\` — ${d.kind}, ${d.registrations} registrations`);
  L.push("");
  L.push("## Engine entry points", "");
  for (const e of scan.engineEntryPoints.slice(0, 80)) {
    L.push(`- \`${e.name}\` (${e.type}) — \`${e.file}\`${e.functions?.length ? `: ${e.functions.slice(0, 8).join(", ")}` : ""}`);
  }
  L.push("");
  L.push("## Data models", "");
  for (const m of scan.models.slice(0, 60)) {
    L.push(`### ${m.name} (\`${m.file}\`)`, "");
    L.push(m.fields.map((f) => `\`${f.name}: ${f.type}\``).join(", "), "");
  }
  L.push("## Protected engine globs (proposal for engine-paths.json)", "");
  L.push("```json");
  L.push(JSON.stringify({ globs: scan.split.engineGlobs.slice(0, 120) }, null, 2));
  L.push("```");
  return L.join("\n");
}
