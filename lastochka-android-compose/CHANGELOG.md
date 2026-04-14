# Changelog

## [Unreleased]

### Replaced tinodesdk with custom HTTP client
- Removed `:tinodesdk` module from project
- Created `TinodeHttpClient` (OkHttp WebSocket + JSON/Gson)
- Created `TinodeProtocol` data models (hi, login, acc, sub, pub, data, meta, pres, info, ctrl)
- Rewrote `TinodeClient` as high-level wrapper for UI
- Removed tinodesdk dependencies: Jackson, ICU4J, Java-WebSocket

### Migrated from kapt to KSP
- Replaced `org.jetbrains.kotlin.kapt` with `com.google.devtools.ksp` (1.9.25-1.0.20)
- Hilt compiler: `kapt` → `ksp`
- Room compiler: `kapt` → `ksp`
- Kotlin version: 1.9.24 → 1.9.25
- Compose Compiler: 1.5.14 → 1.5.15

### Added OkHttp for WebSocket communication
- Added `com.squareup.okhttp3:okhttp:4.12.0`

### Updated app icon
- Replaced all `ic_launcher_foreground.png` with `logo2.png` (mdpi–xxxhdpi)
- Replaced `ic_launcher_play_store.png` (512×512)
- Updated splash screen: SVG → PNG (`logo_src.png`)
- Added `values-night/colors.xml` for dark mode splash
- Removed old `logo_splash.xml` (SVG-based)

### Fixed Compose import issues
- Added missing `sp`/`dp` imports in LoginScreen, ChatScreen, ChatListScreen, Avatar
- Fixed `Done`/`DoneAll` icons: `AutoMirrored` → `filled` (with material-icons-extended)
- Added `verticalScroll`/`rememberScrollState` imports in RegisterScreen
- Fixed `LockReset` → `Lock` icon
- Fixed Avatar fontSize: `size.value * 0.38f.sp` (was broken `.dp`)
- Added `@OptIn(ExperimentalMaterial3Api)` for RegisterScreen

### Fixed dependency issues
- Added `com.google.dagger:hilt.android` Gradle plugin (was missing)
- Added `com.google.android.material:material:1.12.0` (needed for themes)
- Added `com.google.devtools.ksp` plugin
- Removed `com.android.library` root plugin (tinodesdk module removed)

### Code cleanup
- Removed `TinodeConnState` enum conflict with kotlinx.coroutines
- Used callback-based state observer instead of broken Flow API
- Simplified `TinodeClient` event handling with `runBlocking` + `emit`
