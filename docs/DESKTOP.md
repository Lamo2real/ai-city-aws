# VAIC on your Mac, your PC and your iPhone

VAIC runs in any browser at https://d2lcjbjaz1khxz.cloudfront.net. It also comes as an app for Mac and Windows,
and it can sit on an iPhone's home screen. Each one is the same City, chat, voice, Work, Projects, Files,
Knowledge, Skills, Costs and Settings, always the newest version.

**Only the owner can sign in.** Every copy asks for the owner's email, password and the 6-digit code from the
owner's authenticator app, and the AWS backend checks all three. The download contains no password, key or
token, so sharing the file with friends gives them the app, not access to the City.

## Download

Always the newest: **https://github.com/Lamo2real/ai-city-aws/releases/latest**

| Computer | File |
|---|---|
| Mac with Apple Silicon (M1 or newer; Apple menu → About This Mac says "Chip Apple M…") | `VAIC-…-mac-arm64.dmg` |
| Mac with Intel (About This Mac says "Processor Intel…") | `VAIC-…-mac-x64.dmg` |
| Windows 10 or 11 | `VAIC-…-win-x64.exe` (or the `.msi`, for whoever prefers it) |

## Install on a Mac

1. Open the `.dmg` and drag **VAIC** onto **Applications**.
2. Open VAIC from Applications. The first time, macOS says it can't verify the app (it is not signed by Apple
   yet, see below). Click **Done**.
3. Apple menu → **System Settings** → **Privacy & Security**, scroll down to "VAIC was blocked…", click
   **Open Anyway**, then **Open Anyway** again and enter your Mac password.
4. VAIC opens. Sign in. The first time you press the voice button, allow the microphone.

Steps 2 and 3 come back once for each new version of the Mac app. The app itself rarely changes: everything you
see in it comes live from the City, so new City features appear without reinstalling.

**New versions on the Mac.** The Mac app can't install updates itself until it is signed (below). Instead, from
version 1.0.7 on, it looks at the releases when it starts and once a day while open; when a newer one is out it says
"VAIC 1.0.x is out" with a **Download** button that opens the right `.dmg` (Apple Silicon or Intel) in your
browser. Open it and drag VAIC onto Applications to replace the old one (then steps 2 and 3 once). Version 1.0.6 and
older have no such notice: download the next version once by hand.

## Install on Windows

1. Run the `.exe`. Windows may say "Windows protected your PC" (the app isn't signed yet): click **More info**,
   then **Run anyway**.
2. Pick where to install it. A **VAIC** shortcut lands on the desktop and in the Start menu.
3. Sign in. The first time you press the voice button, allow the microphone.

The Windows app checks for a new version each time it starts and installs it when you quit.

## New versions of the City itself

Everything inside the app, the iPhone home-screen app and the browser comes live from the City. When a newer
version of the City goes live while VAIC is open, a small notice says "A new version of VAIC is ready" with a
**Reload** button. Nothing reloads by itself, so whatever you are typing or saying is never cut off: press Reload
when it suits you.

## On the iPhone

Two ways:

- **Add to Home Screen (free, now):** open https://d2lcjbjaz1khxz.cloudfront.net in **Safari** → the Share button →
  **Add to Home Screen** → **Add**. VAIC gets its own icon and opens full screen. Sign in once there (it keeps its own
  sign-in, apart from Safari).
- **The iPhone app (TestFlight):** the native app in `ios/` comes through TestFlight once the owner has the Apple
  Developer Program; the one-time steps are in [IOS_TESTFLIGHT.md](IOS_TESTFLIGHT.md). Friends can be invited
  through a TestFlight public link after a short Apple review.

## Signing (for the owner)

Without signing, people see the warnings above once per version; everything else works. To remove them:

- **Mac:** the **Apple Developer Program**, $99 a year (developer.apple.com/programs). It gives a "Developer ID
  Application" certificate and Apple's notarization; the same membership covers TestFlight for the iPhone. With it
  the Mac app opens without warnings and can update itself.
- **Windows:** a code-signing certificate: Microsoft's **Trusted Signing** (Azure, about $10 a month; check that
  your country is accepted for individuals) or an OV certificate with cloud signing from a seller such as
  SSL.com or Certum (roughly $100–300 a year). Windows still warns about a new publisher until enough people have
  installed it; the warning then names you instead of "Unknown publisher".

You sign up and pay; agents never do. Afterwards an agent session stores the certificate in Secrets Manager
and switches signing on in `.github/workflows/desktop.yml` and `desktop/electron-builder.yml`.

## How it works (for whoever changes it)

- `desktop/` is an [Electron](https://www.electronjs.org) app: one window that loads the live HUD, Chromium on
  both Mac and Windows (the same engine as Chrome, so voice behaves the same everywhere). It bundles no copy of the
  HUD, so Cognito, the API's allowed origin and the CSP need no change: it is the same site.
- `desktop/src/policy.js` holds every rule, tested in `desktop/test/policy.test.js` (`cd desktop && npm test`):
  the page has no Node.js and runs sandboxed; the main window never leaves the HUD (other links and file
  downloads open in the computer's browser); a connector sign-in opens in its own app window that may visit the
  provider and come back; only the HUD gets the microphone (audio only), the clipboard and full screen.
  The user agent leaves out "Electron", so Google's sign-in page accepts it; if a provider still refuses,
  connect that account once in the browser: connections live in the City and work in the app too.
- `desktop/src/releases.js` (tested in `desktop/test/releases.test.js`): the Mac-only release check. A packaged Mac
  app reads `api.github.com/repos/Lamo2real/ai-city-aws/releases` on start and every 24 hours, takes the newest
  published `desktop-vX.Y.Z` release, and when it is newer than `app.getVersion()` shows a native dialog once per
  version per session; Download opens that release's `-mac-arm64.dmg` or `-mac-x64.dmg` (by `process.arch`), only
  ever a `https://github.com` link. Windows keeps `electron-updater`. Unauthenticated GitHub API: 60 calls an hour
  per address, far above one a day.
- The HUD's "new version" notice (`web/src/lib/version.ts`, `web/src/components/UpdateNotice.tsx`): each build
  stamps a hash of `index.html` (which names every hashed bundle) into `<meta name="hud-version">` and
  `/version.json` (`web/vite.config.ts`). The deploy uploads `version.json` with `Cache-Control: no-cache` after
  `index.html` and invalidates it; CloudFront's CachingOptimized policy then keeps it at most a second. The page
  checks on start, on focus or when it shows again (at most once a minute) and every 5 minutes while visible, and
  shows the notice when the ids differ. Same source, same id: a deploy that doesn't change the HUD shows nothing.
- Sign-in tokens stay in the app's own data folder on that computer (readable only by that computer's user), like
  Chrome's; signing out removes them.
- `.github/workflows/desktop.yml` runs on pushes to `main` that change `desktop/` (or by hand): tests, builds the
  `.dmg` files on macOS and the `.exe` and `.msi` on Windows, and publishes the release `desktop-v1.0.<run>`.
- Run from source: `cd desktop && npm install && npm start` (`VAIC_DESKTOP_URL=http://localhost:5173 npm start`
  points it at a local HUD; a packaged app ignores that).
- Not tested yet: Windows on a real PC, the Intel Mac build, voice inside the app with a real microphone, and a
  connector sign-in inside the app.
