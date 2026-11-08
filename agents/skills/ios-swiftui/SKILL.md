---
name: ios-swiftui
description: "Build iOS apps in SwiftUI with the current Xcode and iOS SDK, ready for TestFlight and the App Store."
---
# iOS with SwiftUI

- Before coding, look up the current Xcode, Swift and iOS SDK versions and any API you use with **Context7** (Apple docs). Target the current iOS minus one unless the goal says otherwise.
- SwiftUI first, Swift Concurrency (`async`/`await`, `@MainActor`), Observation (`@Observable`). No third-party packages without a reason in the report.
- Structure: one feature per folder; views small; logic in testable types. XCTest or Swift Testing for logic; UI tests for the main flow.
- Accessibility: Dynamic Type, VoiceOver labels, 44 pt targets, Dark Mode.
- Secrets in the Keychain, never in `UserDefaults` or the bundle. HTTPS only (ATS on).
- App Store readiness: app icon set, privacy manifest (`PrivacyInfo.xcprivacy`), usage strings for every permission, launch screen.
- In the cloud sandbox there is no Xcode: write the code, the `.xcodeproj`/`Package.swift` and tests, push the branch, and let the owner's CI (GitHub Actions on `macos-latest`) build and test it. Say in the report what only a Mac or a device can confirm.
