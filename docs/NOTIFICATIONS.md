# Notifications: one message to your iPhone per finished job, no email

AI City sends **no email**. The only notification is a push to your iPhone when a **whole job** you asked for is
finished (done, failed, or stopped), with its name and what it cost. Parts, reviews, hires and partial results never
notify. The switch "Tell my iPhone when a job is finished" in Settings turns it off and on.

(Cognito's own sign-in and password-reset emails, and AWS Budgets' monthly alert, are not city notifications and are
unchanged.)

## One-time setup (about 10 minutes)

1. **Get an Apple push key.** Apple Developer → Certificates, Identifiers & Profiles → **Keys** → `+` → name it, tick
   **Apple Push Notifications service (APNs)** → Continue → Register → **Download** the `.p8` file (Apple lets you
   download it once). Note the **Key ID** on that page and your **Team ID** (top right of the developer portal). The
   **Bundle ID** is the iPhone app's (`ios/AICity`, Xcode → target → General).
2. **Paste it in AI City.** Settings → Notifications → **Add the Apple key**: Key ID, Team ID, Bundle ID, and the
   whole `.p8` file. It goes straight into Secrets Manager as `vaic/prod/apns` (never through chat or the repo).
3. **Turn it on and deploy once.** In the GitHub repository: Settings → Secrets and variables → Actions → Variables →
   `VAIC_APNS_ENABLED` = `true`. Then push any commit to `main` (or run the deploy workflow by hand). The deploy creates
   the two SNS platform applications (App Store/TestFlight builds, and Xcode debug builds) from your key.
4. **Build the app with the push entitlement.** In `ios/Config/AICity.xcconfig` set
   `VAIC_ENTITLEMENTS = Config/AICity-Push.entitlements`, then install the app on the iPhone from Xcode again. Signing
   that entitlement needs your **Apple Developer Program** team (the same account the key in step 1 came from) set as
   `VAIC_TEAM_ID`; a free personal team can't sign it, so a free-team build never receives pushes — the app still
   builds and runs, and its Settings → Notifications says why. The simulator always has the entitlement without this
   line (`ios/README.md` § Notifications).
5. **Allow notifications on the phone.** Open the AI City app; when iOS asks, allow notifications. The app registers
   the phone (`POST /devices`). Settings → Notifications shows "1 phone registered".

Replacing the key later: paste the new one the same way and deploy once.

## How it works

- `infra/modules/notifications`: the secret, the two `aws_sns_platform_application`s (only when `apns_enabled`), and the
  IAM the api and notifier functions need. Nothing is created from the key until the variable is on, so every deploy
  applies with the secret empty.
- `vaic.lambdas.notifier`: EventBridge sends it only `ticket.status` events for top-level jobs (`kind: task`) reaching
  `done`, `failed` or `cancelled`; a ledger claim (`push:<job>`) makes each job notify once; it pushes to every
  registered phone and forgets phones whose endpoint APNs disabled.
- `vaic.shared.push`: the device store (`DEVICE#<id>` in the ledger), the APNs payload, the Apple key check.

## The iPhone app's contract

All routes need the owner's Cognito ID token (`Authorization: Bearer …`), like every other API route.

| Route                     | Body / answer                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `POST /devices`           | `{ "token": "<APNs device token, hex>", "platform": "ios", "sandbox": false }` → `{ "device": { "id", … } }`; `sandbox: true` for Xcode debug builds. 503 until the key is deployed. Re-registering the same token is fine (same id). |
| `GET /devices`            | `{ "devices": [ { "id", "platform", "sandbox", "created_at", "updated_at" } ] }`                        |
| `DELETE /devices/{id}`    | `{ "removed": true }` (sign-out, or the user turned notifications off)                                   |
| `GET /notifications/apns` | `{ "key_saved_at", "enabled", "devices", "secret_name" }`                                                |
| `PUT /notifications/apns` | `{ "key_id", "team_id", "bundle_id", "p8" }` → `{ "ok": true, "saved_at", "next" }` (Settings uses this) |

The push payload: `aps.alert.title` ("Done" / "Stopped" / "Could not finish"), `aps.alert.body` (the job and its
cost), `aps.sound: default`, plus `job` (the job id) and `status`, so the app can open that job.
