# The installable APK

The ported UI ships inside the real SimpMusic app, so it can be installed and judged on a device
rather than only through screenshots.

## The small one: 27 MB

Release, minified, **arm64-v8a only**, signed with the debug key, and set to open the ported UI.

| | |
| --- | --- |
| Workflow run | [`45353678178`](https://github.com/Rohitjjn/Ui-Port/actions/runs/45353678178) |
| Artifact name | `simpmusic-uiport-release-arm64` |
| File | **`androidApp-release.apk`** |
| Size | **28,762,332 bytes (27 MB)** |
| Artifact size | 27,508,532 bytes (one APK, nothing else) |
| sha256 | per run — see the run summary |
| ABI | arm64-v8a only |
| Package | `com.maxrave.simpmusic` |
| Signed | yes — debug keystore, verifiable |
| Retention | 30 days |

```
gh run download 45353678178 --repo Rohitjjn/Ui-Port -n simpmusic-uiport-release-arm64
adb install -r androidApp-release.apk
```

This is the one to use on a metered connection: 27 MB against 286 MB for the debug universal APK,
because release is minified and shrunken and ships one ABI's native libraries instead of four copies.

**arm64-v8a** is the ABI of essentially every Android phone made since about 2015. On the rare 32-bit
device this APK will refuse to install, which is a clear failure at install time rather than a crash.

The sha256 changes every run: CI signs with a freshly generated debug keystore, so the bytes are
not reproducible. The exact hash for any build is printed as an `apk size` annotation on that run and
in its job summary — check it there rather than against a number written in this file.

`arm64` only, and the package name has no `.dev` suffix, so it **replaces** an existing SimpMusic
install of the same signature rather than sitting beside it. Uninstall first if you want to keep the
original.

## The original app, from the same APK

```
adb shell am start -n com.maxrave.simpmusic/com.maxrave.simpmusic.MainActivity --ez uiport false
```

## The bigger debug artifact

`ci-e2e-simpmusic` still builds debug for three ABIs plus a universal APK — ~286 MB — as a
build-correctness check. It is not the thing to download to look at the port.

Click **Run workflow** on `apk-release` to build the small APK on demand once this is on `main`.

## What it opens

A debug build opens the ported UI. The original app is one intent extra away, so the port can be put
beside the thing it is a port of, on the same device, from the same build:

```
adb shell am start -n com.maxrave.simpmusic.dev/com.maxrave.simpmusic.MainActivity --ez uiport false
```

A release build is unchanged and never shows the port.

Two of the three ported screens are reachable from the bottom bar: **Home** and **Library**, both
measured against real reference captures. **Search** is in the prototype's nav but has not been ported
— there is no reference capture for it, so there is nothing to port against — and selecting it stays
on Home rather than showing an empty stub that would be scored as a broken port. **Now playing** is
rendered and measured but is not wired to a route in the app, because in the prototype it is an
overlay over the current screen rather than a destination.

## What "verified" means here

The workflow does not trust the build to have done what the commit intended. Before uploading, it
unzips `classes.dex` from the APK and fails if `UiPortApp`, `UiPortHomeScreen`,
`UiPortLibraryScreen` or `UiPortBottomNav` are absent, and fails if the vendored typefaces
(`uiport_instrument_serif`, `uiport_inter_*`) are not packaged — without those the port would render
in a fallback font and every geometry measurement in this repository would stop meaning anything.

That check exists because the APK was, until this change, a deliverable in name only: the workflow
built and uploaded it for weeks while nothing in the app called the ported screens, so the artifact
opened the original SimpMusic. A green "Upload APK" step said nothing about that, because "the build
succeeded" and "the artifact contains the ported UI" are different claims.

## What it is not

It is a **debug** build, unsigned for distribution, with `applicationIdSuffix = ".dev"`. It is not a
release, not on a store, and not signed with a release key. It exists so the port can be looked at,
not shipped.
