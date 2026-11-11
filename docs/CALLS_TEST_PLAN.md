# Trying VAIC's calls on your iPhone (decision 245)

What you should see: when VAIC needs your yes, your iPhone rings with an incoming call from **Vice**. Pick up and Vice
tells you why it called; say your answer. Don't pick up and, about half a minute later, one notification arrives
with **Yes, go ahead** / **No**. Pick up, and no notification follows.

## Once: switch it on (about 15 minutes)

These need you; agents never sign up or pay.

1. **Apple Developer Program** (paid, already needed for any iPhone notification): Apple Developer → Keys → `+` → tick
   **Apple Push Notifications service (APNs)** → download the `.p8`. Note the Key ID and your Team ID.
2. **Paste it in AI City:** Settings → Notifications → **Add the Apple key** (Key ID, Team ID, the app's Bundle ID,
   the whole `.p8`). It goes straight into Secrets Manager.
3. **Turn it on:** GitHub → the repository → Settings → Secrets and variables → Actions → Variables → add
   `VAIC_APNS_ENABLED` = `true`, then Actions → deploy → **Run workflow** (or ask any session to run it). That deploy
   creates the notification and the call channels from your key.
4. **Install the new app build** on your iPhone (Xcode, or TestFlight when that is set up), with the push
   entitlement (`docs/NOTIFICATIONS.md` step 4). Open the app once, sign in, and allow notifications.

## Test 1: the call, answered

1. Lock the phone and put it down.
2. On the laptop or in the app, tell VAIC: "Vice, call me to test the call."
3. **Expect:** within a few seconds the phone rings, showing "Vice", on the lock screen.
4. Answer. **Expect:** Vice speaks first ("Hi Sir, it's Vice…") and says it's a test call. Talk back; it answers.
5. Hang up. **Expect:** no notification afterwards.

## Test 2: the call, missed

1. Say "Vice, call me again."
2. Let it ring without answering (or press decline).
3. **Expect:** the ringing stops after about 30 seconds (straight away if you declined), and one notification
   arrives: "Vice called you". Only one.

## Test 3: the real case, the ad ceiling

1. Tell VAIC: "Set a daily ad ceiling of 300 kronor." **Expect:** it says the new value back (300 SEK a day).
2. Ask Marketing for a campaign planned above it, e.g. "start a Meta campaign for the boots at 500 kronor a day".
   (This needs a connected ad account. Without one, Test 1 and 2 already prove the call.)
3. **Expect:** the phone rings. Answer and say "yes, go ahead" or "no". **Expect:** the campaign starts or doesn't,
   and Vice confirms.
4. Repeat but don't answer. **Expect:** the notification with **Yes, go ahead** / **No**. Long-press it, tap one, and
   confirm with Face ID. **Expect:** Needs you in the app no longer shows the campaign.

## Other things you can say

- "Stop calling me, just send a message": nothing rings any more; the notification still comes.
- "You can call me again": ringing is back.
- "What's my ad limit?": the current ceiling.

## If something is off

- **Nothing rings and no notification arrives:** Settings → Notifications should say the key is saved and at least
  one phone is registered. If not, check steps 2–4 above.
- **A notification but no ringing:** the new app build isn't installed yet, or the deploy in step 3 hasn't run since
  the key was pasted.
- **It rings but there is silence after you answer:** VAIC's voice couldn't open. Try "Vice, call me" again; if it
  repeats, tell VAIC "the call was silent" in the chat so a session can read the logs.
- Calls need mobile data or Wi-Fi. With no connection nothing can ring; the notification arrives when the phone is
  back online.
