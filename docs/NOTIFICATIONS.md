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

## Calls from VAIC (decision 245)

The owner (2026-11-11): VAIC should call when it needs their input, "call once, and then send message if I don't
answer. But if I answer, don't send a message", with every bill on AWS. So the call is an **in-app call**, not a phone
number: no carrier, no Twilio, no WhatsApp, no Amazon Connect.

- **What rings:** a PushKit VoIP push through SNS (`APNS_VOIP` / `APNS_VOIP_SANDBOX` platform applications, made from
  the same Apple key) makes the AI City app report an incoming call to CallKit: the iPhone's own call screen, "Vice",
  also when locked.
- **Answered:** the app says so (`POST /calls/{id}/answered`), opens VAIC's real-time voice (`POST /voice/session`, the
  same Nova Sonic relay as the web, decision 120) and sends `{"type":"call","id":…}`; the relay gives Sonic a `[call]`
  line with the reason, so Vice speaks first, says why it called and asks. The owner's answer goes to VAIC
  (`ask_vaic`), which acts on it (e.g. `ad_spend_limit` confirm or refuse). No message is sent.
- **Not answered:** declined, or nothing after 30 s on the phone (`POST /calls/{id}/missed`), or nothing reported after
  45 s (the notifier's own timeout, e.g. the phone is off) → one ordinary push, "Vice called you", with **Yes, go
  ahead** / **No** buttons (category `VAIC_DECIDE`) that answer the approval (`POST /approvals/{id}`). Each state move
  is a conditional write (`ringing → answered → ended`, `ringing → missed → messaged`), so whoever reports first wins
  and the message goes out at most once.
- **What calls:** an `ad.spend` approval (the owner's ad spend limit, decision 240; now also a daily ceiling, "300 kr a
  day") and the owner's own "Vice, call me" (`call_owner` → `call.requested`). The rule `vaic-prod-call-owner` sends both
  to the notifier (90 s timeout). Nothing else rings: with Autopilot on, nothing else waits for the owner.
- **Switch:** "stop calling me" → VAIC sets `call_owner: false` (Settings): the message still comes, nothing rings.
- **Cost:** only AWS: SNS mobile pushes (free tier: 1 million a month) and the Nova Sonic minutes of the call.
- **Security:** no phone number exists anywhere. Only the owner's own registered app rings (VoIP tokens are registered
  through the owner's Cognito login); every `/calls` route needs the owner's token; the call id only reads the
  reason; the Yes / No buttons ask for Face ID before they answer (`authenticationRequired`).

Calls need everything in "One-time setup" above, plus the new app build (UIBackgroundModes `voip` and `audio`).

| Route                         | Body / answer                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| `POST /devices`               | the VoIP token: `{ "token", "platform": "ios", "sandbox", "kind": "voip", "bundle": "<bundle id>" }` |
| `GET /calls/{id}`             | `{ "call": { "id", "reason", "approval", "state", "created_at" } }`                                  |
| `POST /calls/{id}/answered`   | `{ "call", "moved" }` (`moved: false` when it was already missed or answered)                        |
| `POST /calls/{id}/missed`     | declined or unanswered on the phone: the message goes out once                                      |
| `POST /calls/{id}/ended`      | the owner or Vice hung up                                                                           |

The VoIP payload: `{"aps": {}, "vaic_call": {"id", "reason", "approval"}}`, sent with `apns-push-type: voip`,
priority 10 and topic `<bundle>.voip`. The message: `aps.category: "VAIC_DECIDE"` and `vaic_call: {"id", "approval"}`.
