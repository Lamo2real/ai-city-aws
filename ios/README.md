# AI City for iPhone

A native SwiftUI app that does what the web HUD (`web/`) does: sign in, talk to VAIC (typed or by voice), watch the City, answer what needs you, follow tickets and costs, change settings. It talks to the same backend as the web HUD: the same `config.json`, the same Cognito user pool and app client, the same owner-only HTTP API and the same WebSocket events. Nothing in AWS changes for it.

## What's inside

| Folder | What |
|---|---|
| `AICity.xcodeproj` | The Xcode project (folders are synced: a new `.swift` file in `AICity/` is in the app automatically) |
| `Config/AICity.xcconfig` | The AI City's web address (built in; nobody types it), team ID and bundle ID prefix (public values only) |
| `Config/Info.plist` | Microphone and speech-recognition wording, background modes for calls, App Transport Security (HTTPS only) |
| `AICity/Auth` | Cognito sign-in on the app's own screens: SRP, first-login password, authenticator app, forgot password, refresh, sign-out. Tokens in the Keychain |
| `AICity/Core` | `config.json`, the HTTP API, the WebSocket, the store (chat, outbox, VAIC's steps), Markdown |
| `AICity/City` | The City screen and its locked-down web view; the event reducer (a Swift port of `web/src/city/city-state.js`) for the native lists and sheets |
| `AICity/CityWeb` | The web HUD's own City scene, built from `web/src/city/` (do not edit; rebuild it) |
| `AICity/Voice` | Push-to-talk with Apple's Speech framework (on the iPhone when it can) and spoken replies; VAIC's real-time voice on calls (`SonicLink.swift`) |
| `AICity/UI` | The screens |
| `AICityTests` | XCTest unit tests with fakes only (no AWS) |
| `scripts/` | `srp_vectors.py` (SRP test vectors from Python), `make_icon.swift` (the app icon: the owner's eye in white on black, from `web/public/eye.svg`), `make_tap_sound.py` (the tap click, `AICity/Sounds/tap.wav`) |

Requires Xcode 26 or later; runs on iOS 17 or later.

## Open and run it in the Simulator

1. Open `ios/AICity.xcodeproj` in Xcode.
2. Pick the **AICity** scheme and an iPhone simulator, then **Run** (⌘R).
3. The app opens on the sign-in screen. Its AI City web address is built in (`VAIC_SITE_HOST` in `Config/AICity.xcconfig`, the HUD's CloudFront host from Terraform's `hud_url` output); it reads `config.json` from there, like the web HUD. Nobody types an address (decision 111). A build with that setting empty cannot start and says so in one sentence.
4. Sign in with your email, password and 6-digit code, exactly as on the web. The first time, use the temporary password from the "Welcome to AI City" email.

**Demo mode (Debug builds only):** in Xcode, *Product → Scheme → Edit Scheme → Run → Arguments*, add `-demo` to see the app with a made-up city and no AWS at all (`-demo -demo-voice you` or `-demo -demo-voice vaic` shows the voice's light without a microphone; `-demo -signedout` shows the sign-in screens; the demo password `first` walks the first-login steps and the code is `123456`). `-demo -demo-cognito` uses the real sign-in code against a fake Cognito (any password, code `123456`, ID tokens that last 2 minutes) so you can quit and relaunch and see that you stay signed in; add `-reset` to start over. Release builds don't contain the demo.

Tests: *Product → Test* (⌘U), or

```bash
cd ios && xcodebuild test -project AICity.xcodeproj -scheme AICity -destination 'platform=iOS Simulator,name=iPhone 17'
```

## Install it on your iPhone

Installing is all there is: the app knows its AI City, so the first screen is sign-in (or the first-login steps). If the deployment ever moves to another address, change `VAIC_SITE_HOST` and install again.

### Option A: free, with your Apple Account (no developer program)

1. Xcode → **Settings → Accounts** → add your Apple Account. A "Personal Team" appears.
2. In `Config/AICity.xcconfig` set `VAIC_TEAM_ID` to that team's ID (Xcode shows it under the account; or pick the team in the target's *Signing & Capabilities* tab instead) and set `VAIC_BUNDLE_PREFIX` to something only you use, for example `com.yourname`.
3. Plug in the iPhone (or pair it over Wi-Fi), unlock it, and trust the Mac.
4. On the iPhone: **Settings → Privacy & Security → Developer Mode → On** (it restarts).
5. In Xcode pick your iPhone as the run destination and press **Run**.
6. The first time, the iPhone says the developer is not trusted: **Settings → General → VPN & Device Management →** your Apple Account **→ Trust**.

With a free team the app stops opening after **7 days**; run it from Xcode again to renew. Nothing is lost: your sign-in stays in the iPhone's Keychain, so the app opens signed in.

### Option B: TestFlight (Apple Developer Program, $99 / year)

**Automatic:** follow `docs/IOS_TESTFLIGHT.md` once; then every change to `ios/` on `main` is built, tested and uploaded to TestFlight by `.github/workflows/ios-testflight.yml`, and the iPhone updates by itself. The manual way:


1. Enroll at developer.apple.com, then set `VAIC_TEAM_ID` to the program team and `VAIC_BUNDLE_PREFIX` to your own reverse domain.
2. In App Store Connect create an app with the bundle ID `<prefix>.aicity` (internal testing only is fine; it never needs to be public).
3. In Xcode choose **Any iOS Device**, then **Product → Archive** → **Distribute App → TestFlight & App Store** → Upload.
4. In App Store Connect → TestFlight, add yourself as an internal tester; install from the TestFlight app on the iPhone. Builds last 90 days.

The app declares `ITSAppUsesNonExemptEncryption = false` (it uses only Apple's HTTPS and Keychain), so uploads don't stop at the export-compliance question.

## Security

- **Sign in once.** The tokens (ID, access, refresh) live only in the Keychain, on this iPhone only (never synced or backed up), readable after the phone's first unlock since it started. Opening the app, or coming back to it, refreshes them silently; you see the sign-in screen again only if Cognito refuses the refresh token (revoked, or past its validity). Sign-out revokes the refresh token at Cognito and deletes them.
- **No secrets in the app.** The bundle holds only public values (the site host). Cognito IDs and endpoints come from the public `config.json`.
- **HTTPS only.** App Transport Security is on with no exceptions; the app also refuses a `config.json` whose API isn't `https://` or whose WebSocket isn't `wss://`.
- **Agent output is text.** VAIC's Markdown is parsed into native text runs (bold, italic, code, lists, tables). VAIC's replies never go into a web view; HTML stays visible as characters; only `http(s)` links open, in Safari. The one web view in the app is the City map: bundled code only, no network, no tokens.
- **The password never leaves the phone:** SRP sends a proof, not the password.
- The chat is kept on the iPhone (last 60 lines, file protection "complete"); *Settings → Forget this iPhone's conversation* clears it.

## Notifications

After the first sign-in the app asks, in one sentence, whether this iPhone should get a notification when the city finishes a **large feature** (never small steps). Allow it and the app registers with Apple's push service on every launch and sends the token to the backend (`POST /devices`); the push itself is sent by the backend through SNS → APNs when a top-level job finishes, with the job, outcome and cost in the text. Tapping it opens VAIC. Sign-out removes this iPhone from the backend; so does turning notifications off in iOS Settings. "Not now" is never asked again — Settings → Notifications offers it later.

Real pushes need the **Push Notifications capability**, which only Apple Developer Program teams have (option B above): set `VAIC_ENTITLEMENTS = Config/AICity-Push.entitlements` in `Config/AICity.xcconfig`. With a free personal team the app still builds and runs; Settings → Notifications explains that this build can't receive them. The simulator always has the entitlement and `xcrun simctl push booted <bundle-id> payload.json` shows a notification end to end, but a push from the real backend needs a real iPhone.

## Calls from VAIC

When VAIC needs a decision from you (a campaign that wants to spend over your daily ad ceiling, say), it calls this iPhone, once. It is an in-app call, not a phone number: the backend sends a PushKit **VoIP push**, and the app shows it through **CallKit**, so the phone rings full-screen with "Vice" calling, locked or not. Answer and you talk to VAIC's real-time voice (Amazon Nova Sonic on VAIC's runtime, the same WebSocket the web HUD uses; `Voice/SonicLink.swift`), and VAIC says first why it called. Let it ring 30 seconds or decline and it counts as missed: the backend sends a normal notification instead, with **Yes, go ahead** and **No** buttons that answer the approval after Face ID. Answer and no message follows. One call at a time. `App/Calls.swift` has the whole lifecycle.

- The app registers its VoIP token with `POST /devices` (`kind: "voip"`, with the bundle id) on every launch and when it changes, whether or not notifications are allowed; sign-out removes it.
- `Config/Info.plist` adds the background modes `voip` and `audio` (a call keeps talking with the screen locked).
- VoIP pushes go through APNs with the **same Apple key** the notifications already use, to the topic `<bundle id>.voip`; nothing new to paste. Like notifications, they need the Push Notifications capability (Apple Developer Program, `VAIC_ENTITLEMENTS` above).
- **Install a new build** on the iPhone to get calls; an older build never registers a VoIP token, so VAIC can't ring it and only the message comes.
- The simulator can't receive VoIP pushes or ring through CallKit; the unit tests cover the lifecycle with fakes, and a real call needs a real iPhone.

## Voice

Tap the mic, talk, tap again to send. The words are recognised by Apple's Speech framework, on the iPhone when the model is available (no audio leaves the phone then); otherwise Apple's speech service. A message you spoke is answered aloud with the system voice; a typed one is answered in text. While you talk a soft blue light rises from the message box behind the chat, amber while VAIC talks, and nothing shows when nobody does. There is no hands-free wake mode on the iPhone. The web HUD uses Amazon Transcribe and Polly instead; see `docs/DECISIONS.md` (decision 69). The microphone is used only while listening.

## The + menu

The + button beside the message box opens the same menu as the web HUD: **Add files or photos** (from Photos or Files), **Add folders** (every file inside, hidden ones skipped, at most 100), **Slash commands** (`/status`, `/stop`, `/home`, `/knowledge`, `/connect <service>`, `/clear`, plus one per enabled skill), **Connectors** and **Plugins**. Files go to the knowledge base through the same upload routes as the browser and show as chips under the box with their live status; the message then carries an "Attached (now in my knowledge base): …" line that VAIC reads first. In demo mode the uploads land in a fake bucket and turn ready after two seconds.

## The City is the browser's City

The map is the web HUD's own code (`web/src/city/scene.js` and `city-state.js`), built into one small page and bundled in the app, so the phone and the browser always draw the same town. After changing anything in `web/src/city/`, rebuild it and commit the result:

```bash
npm run build:city-embed -w @vaic/web
```

`npm test` fails if you forget. The page runs in a web view that can load only those bundled files, has no network access and never sees your tokens: the app hands it the city snapshot and live events, and the page tells the app only what you tapped.

## Adding a screen

Other features (apps, knowledge, connectors, mail) add one case to `AppSection` in `AICity/App/AppModel.swift` (a tab, or a row under **More** via `underMore`) and one view in `MainTabs.screen(_:)`.
