# The iPhone app, updated by itself (TestFlight)

Every change to the iPhone app (`ios/`) that reaches `main` is built, tested and uploaded to TestFlight by
`.github/workflows/ios-testflight.yml`. TestFlight then updates the app on your iPhone by itself. The web HUD
needs none of this: it is always the latest version in any browser, including Safari on your phone.

You do the steps below once. They need your own Apple Account and its two-factor codes, so only you can do
them. About 15 minutes.

## 1. Your team ID

developer.apple.com → **Account** → **Membership details** → copy **Team ID** (10 letters and digits).

## 2. Register the app's ID

developer.apple.com → **Certificates, Identifiers & Profiles** → **Identifiers** → **+** → **App IDs** → **App**:

- Description: `AI City`
- Bundle ID: **Explicit**, `com.lamo2real.aicity` (the prefix is `VAIC_BUNDLE_PREFIX` in `ios/Config/AICity.xcconfig`)
- Capabilities: tick **Push Notifications** (for the "a big job is done" notice)

## 3. Create the app in App Store Connect

appstoreconnect.apple.com → **Apps** → **+** → **New App**:

- Platform **iOS**, Name `AI City` (if the name is taken, add something, like `AI City Lamo`; nobody else sees it)
- Bundle ID: pick `com.lamo2real.aicity`
- SKU: anything, for example `aicity`
- User access: **Limited** is fine

It never has to go on the App Store. TestFlight internal testing needs no Apple review.

## 4. An API key for the pipeline

appstoreconnect.apple.com → **Users and Access** → **Integrations** → **App Store Connect API** → **Team Keys**
→ **+**:

- Name `AI City GitHub`, Access **Admin** (needed so the pipeline can create its own signing certificate)
- **Download** the `.p8` file (Apple lets you download it only once) and note the **Key ID** and the
  **Issuer ID** shown above the list.

## 5. Give them to GitHub

In your own terminal (the key goes straight from the file to GitHub; it never appears in a chat or log):

```bash
gh secret set ASC_KEY_ID --repo Lamo2real/ai-city-aws
```

```bash
gh secret set ASC_ISSUER_ID --repo Lamo2real/ai-city-aws
```

```bash
gh secret set ASC_KEY_P8 --repo Lamo2real/ai-city-aws < ~/Downloads/AuthKey_XXXXXXXXXX.p8
```

```bash
gh variable set APPLE_TEAM_ID --repo Lamo2real/ai-city-aws --body YOURTEAMID
```

The first two ask you to paste the value. Then delete the `.p8` from Downloads (or keep it in your password
manager).

## 6. You as the tester

1. App Store Connect → your app → **TestFlight** → **Internal Testing** → **+** → group `Me`, add yourself, and
   turn on **automatic distribution** so every new build goes to you.
2. On the iPhone, install **TestFlight** from the App Store and accept the invitation email.
3. In the TestFlight app → **AI City** → turn on **Automatic Updates**.

## 7. The first build

```bash
gh workflow run "iOS to TestFlight" --repo Lamo2real/ai-city-aws
```

From then on it runs by itself on every change to the app. A build takes about 15 minutes on GitHub, then
Apple processes it for 5 to 15 more, then your phone updates.

## When something goes wrong

- **The run says "TestFlight is not set up yet"**: a secret or the team ID variable is missing (step 5).
- **"No profiles for … were found" or a certificate error**: the API key needs **Admin** access (step 4).
- **"No suitable application records were found"**: the app record or its bundle ID is missing (steps 2 and 3).
- **TestFlight builds expire after 90 days**: any change to the app makes a new one; or run step 7 again.
