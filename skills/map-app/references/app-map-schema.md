# app-map.json schema (v1)

Produced by `scripts/scan-app.mjs`. Paths are project-relative and POSIX-style.

```jsonc
{
  "root": "/abs/path",
  "generatedAt": "ISO-8601",
  "modules": {
    "modules": ["androidApp", "composeApp", "..."],   // from settings.gradle(.kts)
    "remaps": { "common": "coreDir, \"common\"" },     // projectDir overrides
    "isMultiplatform": false
  },
  "versions": {
    "gradle": "9.8.1",
    "catalog": { "kotlin": "2.4.21", "...": "every [versions] entry" },
    "catalogKeys": { "agp": "...", "kotlin": "...", "composeBom": "...", "ksp": "...", "koin": "...", "roborazzi": null },
    "android": { "androidApp/build.gradle.kts": { "compileSdk": 37, "minSdk": 26, "targetSdk": 36, "jvmTarget": 17 } }
  },
  "files": { "total": 0, "kotlin": 0, "ui": 0, "engine": 0, "shared": 0 },
  "screens": [{ "name": "HomeScreen", "file": "…/HomeScreen.kt", "stateful": true }],
  "composables": [{ "name": "…", "isScreen": false, "hasState": true, "usesViewModel": true, "visibility": "public", "file": "…" }],
  "viewModels": [{ "name": "AlbumViewModel", "file": "…", "deps": ["songRepository"], "state": [{ "name": "uiState", "type": "StateFlow<AlbumUIState>" }] }],
  "navigation": [{ "name": "Home", "type": "Destination" }, { "route": "…" }, { "navHost": true, "file": "…" }],
  "di": [{ "file": "…", "kind": "koin|dagger", "registrations": 12, "binds": [] }],
  "models": [{ "name": "Track", "file": "…", "fields": [{ "name": "id", "type": "String" }] }],
  "engineEntryPoints": [{ "type": "interface", "name": "SongRepository", "file": "…", "functions": ["getSong"] }],
  "split": {
    "uiFiles": ["…"], "engineFiles": ["…"],
    "engineGlobs": ["core/data/**", "…"],
    "heuristicNote": "…"
  }
}
```

## How to query it instead of re-scanning

```
# every screen and the file to replace
node -e "const m=require('./.uiport/maps/app-map.json'); console.table(m.screens)"

# what the Album screen can call in the engine
node -e "const m=require('./.uiport/maps/app-map.json'); console.log(m.viewModels.find(v=>v.name==='AlbumViewModel'))"

# which files must not be edited without approval
node -e "console.log(require('./.uiport/engine-paths.json').globs.join('\n'))"
```

Keep these reads narrow. A 1200-file project produces a map of a few hundred kilobytes; pasting
it into the conversation burns context for no reason.
