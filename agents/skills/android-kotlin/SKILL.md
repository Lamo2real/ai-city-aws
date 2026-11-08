---
name: android-kotlin
description: "Build Android apps in Kotlin with Jetpack Compose and current Gradle and SDK versions."
---
# Android with Kotlin

- Look up current Android Gradle Plugin, Kotlin, Compose BOM and target SDK versions with **Context7** before starting; target the current API level required by Google Play.
- Kotlin, Jetpack Compose, Material 3, coroutines and Flow; MVVM with a ViewModel per screen; Hilt for injection when the app grows past a few screens.
- Version catalog (`libs.versions.toml`) for dependencies. `./gradlew lint test` clean.
- Accessibility: content descriptions, 48 dp targets, font scaling, TalkBack checked.
- Secrets never in the APK; use the Android Keystore for keys.
- Play readiness: adaptive icon, data safety notes, permissions justified, release build with R8.
- Build and test in GitHub Actions (`ubuntu-latest` with the Android SDK); say what only a device can confirm.
