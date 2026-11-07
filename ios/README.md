# AI City for iPhone

A native SwiftUI app that does what the web HUD (`web/`) does: sign in, talk to AIC (typed or by voice), watch the City, answer what needs you, follow tickets and costs, change settings. It talks to the same backend as the web HUD: the same `config.json`, the same Cognito user pool and app client, the same owner-only HTTP API and the same WebSocket events. Nothing in AWS changes for it.

## What's inside

| Folder | What |
|---|---|
| `AICity.xcodeproj` | The Xcode project (folders are synced: a new `.swift` file in `AICity/` is in the app automatically) |
| `Config/AICity.xcconfig` | Your site address, team ID and bundle ID prefix (public values only) |
| `Config/Info.plist` | Microphone and speech-recognition wording, App Transport Security (HTTPS only) |
| `AICity/Auth` | Cognito sign-in on the app's own screens: SRP, first-login password, authenticator app, forgot password, refresh, sign-out. Tokens in the Keychain |
| `AICity/Core` | `config.json`, the HTTP API, the WebSocket, the store (chat, outbox, AIC's steps), Markdown |
| `AICity/City` | The event reducer (a Swift port of `web/src/city/city-state.js`) and the pixel town drawn with SwiftUI Canvas |
| `AICity/Voice` | Push-to-talk with Apple's Speech framework (on the iPhone when it can) and spoken replies |
| `AICity/UI` | The screens |
| `AICityTests` | XCTest unit tests with fakes only (no AWS) |
| `scripts/` | `srp_vectors.py` (SRP test vectors from Python), `make_icon.swift` (the app icon) |

Requires Xcode 26 or later; runs on iOS 17 or later.

## Open and run it in the Simulator

1. Open `ios/AICity.xcodeproj` in Xcode.
2. Pick the **AICity** scheme and an iPhone simulator, then **Run** (⌘R).
3. On first launch the app asks for your AI City web address, the one you open the HUD at (for example `d1234abcd.cloudfront.net`). It reads `config.json` from there, like the web HUD. To skip that screen, put the host in `Config/AICity.xcconfig` as `AIC_SITE_HOST`.
4. Sign in with your email, password and 6-digit code, exactly as on the web.

**Demo mode (Debug builds only):** in Xcode, *Product → Scheme → Edit Scheme → Run → Arguments*, add `-demo` to see the app with a made-up city and no AWS at all (`-demo -signedout` shows the sign-in screens; the demo password `first` walks the first-login steps and the code is `123456`). Release builds don't contain the demo.

Tests: *Product → Test* (⌘U), or

```bash
cd ios && xcodebuild test -project AICity.xcodeproj -scheme AICity -destination 'platform=iOS Simulator,name=iPhone 17'
```

## Install it on your iPhone

### Option A: free, with your Apple Account (no developer program)

1. Xcode → **Settings → Accounts** → add your Apple Account. A "Personal Team" appears.
2. In `Config/AICity.xcconfig` set `AIC_TEAM_ID` to that team's ID (Xcode shows it under the account; or pick the team in the target's *Signing & Capabilities* tab instead) and set `AIC_BUNDLE_PREFIX` to something only you use, for example `com.yourname`.
3. Plug in the iPhone (or pair it over Wi-Fi), unlock it, and trust the Mac.
4. On the iPhone: **Settings → Privacy & Security → Developer Mode → On** (it restarts).
5. In Xcode pick your iPhone as the run destination and press **Run**.
6. The first time, the iPhone says the developer is not trusted: **Settings → General → VPN & Device Management →** your Apple Account **→ Trust**.

With a free team the app stops opening after **7 days**; run it from Xcode again to renew. Nothing is lost: your sign-in stays in the iPhone's Keychain until it expires (7 days without use, like the web).

### Option B: TestFlight (Apple Developer Program, $99 / year)

1. Enroll at developer.apple.com, then set `AIC_TEAM_ID` to the program team and `AIC_BUNDLE_PREFIX` to your own reverse domain.
2. In App Store Connect create an app with the bundle ID `<prefix>.aicity` (internal testing only is fine; it never needs to be public).
3. In Xcode choose **Any iOS Device**, then **Product → Archive** → **Distribute App → TestFlight & App Store** → Upload.
4. In App Store Connect → TestFlight, add yourself as an internal tester; install from the TestFlight app on the iPhone. Builds last 90 days.

The app declares `ITSAppUsesNonExemptEncryption = false` (it uses only Apple's HTTPS and Keychain), so uploads don't stop at the export-compliance question.

## Security

- **Tokens** (ID, access, refresh) live only in the Keychain, readable only on this iPhone while it's unlocked (`WhenUnlockedThisDeviceOnly`). Sign-out revokes the refresh token at Cognito and deletes them.
- **No secrets in the app.** The bundle holds only public values (the site host, if you set it). Cognito IDs and endpoints come from the public `config.json`.
- **HTTPS only.** App Transport Security is on with no exceptions; the app also refuses a `config.json` whose API isn't `https://` or whose WebSocket isn't `wss://`.
- **Agent output is text.** AIC's Markdown is parsed into native text runs (bold, italic, code, lists, tables). No web view anywhere; HTML stays visible as characters; only `http(s)` links open, in Safari.
- **The password never leaves the phone:** SRP sends a proof, not the password.
- The chat is kept on the iPhone (last 60 lines, file protection "complete"); *Settings → Forget this iPhone's conversation* clears it.

## Voice

Tap the mic, talk, tap again to send. The words are recognised by Apple's Speech framework, on the iPhone when the model is available (no audio leaves the phone then); otherwise Apple's speech service. Replies are read aloud with the system voice (*AIC → ⋯ → Speak replies* turns it off). The web HUD uses Amazon Transcribe and Polly instead; see `docs/DECISIONS.md` (decision 64). The microphone is used only while listening.

## Adding a screen

Other features (apps, knowledge, connectors, mail) add one case to `AppSection` in `AICity/App/AppModel.swift` (a tab, or a row under **More** via `underMore`) and one view in `MainTabs.screen(_:)`.
