# The installable APK

The ported UI ships inside the real SimpMusic app, so it can be installed and judged on a device
rather than only through screenshots.

## Where it is

The APK is built and verified by the `ci-e2e-simpmusic` workflow on every push that touches the test
bed. The latest successful build for this branch:

| | |
| --- | --- |
| Workflow run | [`45187478380`](https://github.com/Rohitjjn/Ui-Port/actions/runs/45187478380) |
| Artifact name | `simpmusic-debug-apk` |
| File to install | **`androidApp-universal-debug.apk`** |
| Download | <https://api.github.com/repos/Rohitjjn/Ui-Port/actions/artifacts/14823474052/zip> |
| Archive size | 300,335,626 bytes |
| Also in the archive | `androidApp-arm64-v8a-debug.apk`, `androidApp-armeabi-v7a-debug.apk`, `androidApp-x86_64-debug.apk` |
| Retention | 30 days |

GitHub artifact downloads require an authenticated session — the URL works in a browser where you are
signed in, or with `gh run download`:

```
gh run download 45187478380 --repo Rohitjjn/Ui-Port -n simpmusic-debug-apk
```

Then install the universal APK:

```
adb install -r androidApp-universal-debug.apk
```

The package is `com.maxrave.simpmusic.dev`, so it installs beside a normal SimpMusic build rather than
replacing it.

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
