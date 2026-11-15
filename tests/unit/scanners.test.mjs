import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { tmpProject } from "../helpers/fixtures.mjs";
import {
  parseBreakpoints,
  parseDesignTokens,
  parseFonts,
  parseRoutes,
  parseStateStores,
  scanPrototype,
} from "../../scripts/lib/scan-prototype.mjs";
import {
  classifyFile,
  engineGlobs,
  parseComposables,
  parseGradleVersions,
  parseSettingsModules,
  parseViewModels,
  scanApp,
} from "../../scripts/lib/scan-app.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const PROTOTYPE = path.join(ROOT, "testbed/prototype");
const SIMPMUSIC = path.join(ROOT, "testbed/SimpMusic");
// The test bed is deletable (docs/CLEANUP.md). Real-tree assertions skip themselves
// when it is gone; the synthetic-fixture tests keep covering the same code paths.
const hasPrototype = fs.existsSync(PROTOTYPE);
const hasSimpMusic = fs.existsSync(SIMPMUSIC);
const prototypeTest = hasPrototype ? test : test.skip;
const simpmusicTest = hasSimpMusic ? test : test.skip;

describe("prototype scanner units", () => {
  test("finds hash-router routes with their components", () => {
    const src = `
      export const router = createHashRouter([
        { path: "/", element: <Shell />, children: [
          { index: true, element: <HomeScreen /> },
          { path: "search", element: <SearchScreen /> },
          { path: "album/:id", element: <AlbumScreen /> },
          { path: "home", element: <Navigate to="/" replace /> },
        ]},
      ]);`;
    const routes = parseRoutes(src, "router.tsx");
    const paths = routes.map((r) => r.path);
    assert.ok(paths.includes("/"));
    assert.ok(paths.includes("search"));
    assert.ok(paths.includes("album/:id"));
    assert.equal(routes.find((r) => r.path === "album/:id").component, "AlbumScreen");
    assert.equal(routes.find((r) => r.path === "home").redirect, true);
  });

  test("reads tailwind breakpoints and collates utilities", () => {
    const bps = parseBreakpoints('class="w-full sm:w-1/2 lg:grid-cols-5 lg:px-10 md:hidden"');
    assert.deepEqual(bps.sm, ["w"]);
    assert.deepEqual(bps.lg.sort(), ["grid", "px"]);
    assert.deepEqual(bps.md, ["hidden"]);
  });

  test("splits light design tokens from dark overrides", () => {
    const css = `@theme { --color-paper: #faf8f3; --color-ink: #25231f; }\n.dark { --color-paper: #1c1b18; }`;
    const t = parseDesignTokens(css);
    assert.equal(t.light["color-paper"], "#faf8f3");
    assert.equal(t.dark["color-paper"], "#1c1b18");
    assert.equal(t.light["color-ink"], "#25231f");
  });

  test("collects font families without leaking var() references", () => {
    const fonts = parseFonts({
      html: '<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500&display=swap">',
      css: ":root { --font-sans: var(--other); } .a { font-family: 'Instrument Serif', Georgia, serif; }",
    });
    assert.ok(fonts.includes("Instrument Serif"));
    assert.ok(fonts.includes("Inter"));
    assert.ok(!fonts.some((f) => f.startsWith("var(")));
  });

  test("reads zustand store keys and actions", () => {
    const src = `export const usePlayerStore = create<PlayerState>((set) => ({
      isPlaying: false,
      progress: 0,
      togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
    }));`;
    const [store] = parseStateStores(src);
    assert.equal(store.name, "usePlayerStore");
    assert.ok(store.stateKeys.includes("isPlaying"));
    assert.ok(store.actions.includes("togglePlay"));
    assert.ok(!store.stateKeys.includes("togglePlay"));
  });

  prototypeTest("real prototype: every screen has an id, file and route", () => {
    const scan = scanPrototype(PROTOTYPE);
    assert.ok(scan.screens.length >= 20, `only ${scan.screens.length} screens`);
    for (const s of scan.screens) {
      assert.ok(s.id && typeof s.id === "string");
      assert.ok(s.route && typeof s.route === "string");
      assert.ok(s.file, `screen ${s.id} has no file`);
      assert.ok(!s.isShell || s.component === "AppShell");
    }
    const ids = scan.screens.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, "screen ids must be unique");
    for (const id of ["home", "search", "library", "settings", "album--id", "artist--id", "playlist--id"]) {
      assert.ok(ids.includes(id), `missing screen ${id} (have ${ids.join(", ")})`);
    }
  });

  prototypeTest("real prototype: libraries, stores, fonts and breakpoints are detected", () => {
    const scan = scanPrototype(PROTOTYPE);
    const libNames = scan.libraries.map((l) => l.name);
    for (const lib of ["framer-motion", "lucide-react", "react-router-dom", "zustand"]) assert.ok(libNames.includes(lib), lib);
    assert.equal(scan.stores.length, 4);
    assert.ok(scan.fonts.includes("Inter"));
    assert.ok(scan.fonts.includes("Instrument Serif"));
    assert.ok(Object.keys(scan.responsive.breakpoints).length > 5);
    assert.equal(scan.responsive.darkMode, "class-toggle");
    assert.ok(scan.motion.libraries.includes("framer-motion"));
    assert.ok(scan.dataShapes.Track, "Track data shape must be mapped");
    assert.ok(scan.dataShapes.Track.fields.some((f) => f.name === "title"));
  });

  prototypeTest("scan is deterministic apart from the timestamp", () => {
    const a = scanPrototype(PROTOTYPE);
    const b = scanPrototype(PROTOTYPE);
    delete a.generatedAt;
    delete b.generatedAt;
    assert.deepEqual(a, b);
  });
});

describe("app scanner units", () => {
  test("classifies UI and engine files by path and content", () => {
    assert.equal(classifyFile("app/src/main/java/x/ui/screen/HomeScreen.kt", "@Composable fun HomeScreen() {}"), "ui");
    assert.equal(classifyFile("core/data/repository/AlbumRepositoryImpl.kt", "class AlbumRepositoryImpl : AlbumRepository"), "engine");
    assert.equal(classifyFile("core/data/dao/AlbumDao.kt", "@Dao interface AlbumDao {}"), "engine");
    assert.equal(classifyFile("app/src/main/java/x/util/Time.kt", "fun now() = 1"), "shared");
  });

  test("finds composables across annotations, modifiers and default args", () => {
    const src = `
      @OptIn(ExperimentalMaterial3Api::class)
      @Composable
      fun HomeScreen(
          onScroll: () -> Unit = {},
          viewModel: HomeViewModel = koinViewModel(),
      ) {
          val items by viewModel.items.collectAsStateWithLifecycle()
          LazyColumn { }
      }
      @Composable
      private fun Row(item: Item) { Text(item.title) }
    `;
    const list = parseComposables(src);
    assert.deepEqual(list.map((c) => c.name), ["HomeScreen", "Row"]);
    assert.equal(list[0].isScreen, true);
    assert.equal(list[0].hasState, true);
    assert.equal(list[0].usesViewModel, true);
    assert.equal(list[1].visibility, "private");
    assert.equal(list[1].isScreen, false);
  });

  test("a composable with nullary default lambda does not confuse the body scan", () => {
    const src = "@Composable\nfun A(onClick: () -> Unit = {}) {\n  val x = remember { 1 }\n}\n";
    const [c] = parseComposables(src);
    assert.equal(c.hasState, true);
  });

  test("reads gradle catalog versions and sdk levels", () => {
    const p = tmpProject();
    try {
      p.write("gradle/libs.versions.toml", '[versions]\nkotlin = "2.4.21"\nandroid = "9.5.0"\ncompose-bom = "2026.09.00"\n');
      p.write("gradle/wrapper/gradle-wrapper.properties", "distributionUrl=https\\://services.gradle.org/distributions/gradle-9.8.1-bin.zip\n");
      p.write("app/build.gradle.kts", "android { compileSdk = 37\n defaultConfig { minSdk = 26 } }\n");
      const v = parseGradleVersions(p.dir);
      assert.equal(v.gradle, "9.8.1");
      assert.equal(v.catalogKeys.kotlin, "2.4.21");
      assert.equal(v.catalogKeys.agp, "9.5.0");
      assert.equal(v.catalogKeys.composeBom, "2026.09.00");
      assert.equal(Object.values(v.android)[0].compileSdk, 37);
      assert.equal(Object.values(v.android)[0].minSdk, 26);
    } finally {
      p.cleanup();
    }
  });

  test("reads included modules from settings.gradle.kts", () => {
    const p = tmpProject();
    try {
      p.write("settings.gradle.kts", 'include(\n    ":app",\n    ":core",\n)\nrootProject.name = "x"\n');
      const m = parseSettingsModules(p.dir);
      assert.deepEqual(m.modules, ["app", "core"]);
    } finally {
      p.cleanup();
    }
  });

  test("extracts ViewModel dependencies and public state flows", () => {
    const src = `
      class AlbumViewModel(
          private val songRepository: SongRepository,
          private val albumRepository: AlbumRepository,
      ) : BaseViewModel() {
          private val _uiState: MutableStateFlow<AlbumUIState> = MutableStateFlow(AlbumUIState.initial())
          val uiState: StateFlow<AlbumUIState> = _uiState
      }`;
    const [vm] = parseViewModels({ "AlbumViewModel.kt": src });
    assert.equal(vm.name, "AlbumViewModel");
    assert.deepEqual(vm.deps, ["songRepository", "albumRepository"]);
    assert.deepEqual(vm.state, [{ name: "uiState", type: "StateFlow<AlbumUIState>" }]);
  });

  test("engine globs never protect a directory that also holds UI code", () => {
    const globs = engineGlobs({
      "app/ui/screen/HomeScreen.kt": "ui",
      "app/ui/screen/HomeState.kt": "engine",
      "core/data/AlbumRepository.kt": "engine",
      "core/data/AlbumDao.kt": "engine",
    });
    assert.ok(globs.includes("core/data/**"), "all-engine directory collapses to one glob");
    assert.ok(globs.includes("app/ui/screen/HomeState.kt"), "mixed directory protects file by file");
    assert.ok(!globs.includes("app/ui/screen/**"), "mixed directory must not protect the whole folder");
    assert.ok(!globs.some((g) => g.includes("HomeScreen.kt")), "UI file is never protected");
  });

  simpmusicTest("real app: split, screens, view models and navigation are mapped", () => {
    const scan = scanApp(SIMPMUSIC);
    assert.ok(scan.files.kotlin > 900, `only ${scan.files.kotlin} kotlin files`);
    assert.ok(scan.files.engine > 300);
    assert.ok(scan.files.ui > 100);
    assert.equal(scan.versions.gradle, "9.8.1");
    assert.equal(scan.versions.catalogKeys.kotlin, "2.4.21");
    assert.ok(scan.modules.modules.includes("composeApp"));
    assert.ok(scan.modules.modules.includes("desktopApp"));
    const screens = scan.screens.map((s) => s.name);
    for (const expected of ["HomeScreen", "AlbumScreen", "ArtistScreen", "SearchScreen", "NowPlayingScreen"]) {
      assert.ok(screens.includes(expected), `missing ${expected}`);
    }
    assert.ok(scan.viewModels.length >= 20, `only ${scan.viewModels.length} view models`);
    const album = scan.viewModels.find((v) => v.name === "AlbumViewModel");
    assert.ok(album, "AlbumViewModel must be mapped");
    assert.ok(album.state.length > 0);
    assert.ok(album.deps.includes("albumRepository"));
    assert.ok(scan.navigation.length > 0);
    assert.ok(scan.split.engineGlobs.length > 50);
    assert.ok(
      !scan.split.engineGlobs.some((g) => /^composeApp\/src\/commonMain\/kotlin\/com\/maxrave\/simpmusic\/ui\/\*\*$/.test(g)),
      "the UI package must never be protected as a whole",
    );
  });

  simpmusicTest("real app: does not read build outputs", () => {
    const scan = scanApp(SIMPMUSIC);
    assert.ok(!scan.split.uiFiles.some((f) => f.includes("/build/")));
  });
});
