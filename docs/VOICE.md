# AIC's voice

## Real-time voice: Nova 2.5 Sonic (decision 120)

The voice button on the AIC screen opens a real-time call. Talk naturally; talk over AIC and it stops at once
and listens. While AIC works on something longer it says a short cue ("one sec, checking"). Tap the button
again, or say "stop listening", to end the call.

- **The brain stays AIC.** Amazon Nova 2 Sonic only hears and speaks. Its one tool, `ask_aic`, runs a normal
  AIC turn, so departments, the Orchestrator, the policy gate and the ledger work as before. AIC's answer
  appears in the chat as usual; Sonic says it in its own words.
- **How it connects.** The HUD calls `POST /voice/session` and gets a five-minute signed WebSocket address to
  AIC's own runtime (`/ws` in `backend/src/aic/runtime/server.py`). The relay (`backend/src/aic/runtime/voice.py`)
  streams 16 kHz microphone audio to Bedrock and 24 kHz speech back (`web/src/voice/sonic.ts`).
- **Models and regions** are in `config/models.json` under `voice`: Nova 2.5 Sonic (`amazon.nova-2-5-sonic`) in
  Stockholm, then Virginia, then Nova 2 Sonic in the same two. The voice is `tiffany`: Nova Sonic offers 16 fixed
  voices and no custom or cloned ones, and Tiffany (warm, American, feminine, and able to speak every supported
  language) is the closest to ChatGPT's Sol. Sol itself is not available outside ChatGPT. Personality, pacing and
  expressions come from `agents/voice.md`; the timbre comes only from the voice ID. The voice is `voiceId`; how quickly it decides you finished is `endpointingSensitivity`.
- **Thinking cues** are status cues, not reasoning: said only when AIC has not answered after `voice.cues.afterMs`
  (1.5 s), again every `againMs` (10 s), at most `max` (2), and never while the owner is talking (the relay waits
  until the owner has been quiet for 1.2 s). The standard voice does the same with the constants in
  `web/src/voice/cues.ts`, and waits while the mic hears the owner.
- **Personality** (`agents/voice.md`, and AIC's spoken style in `agents/ace.md`): a calm, warm executive assistant;
  varied pace and emphasis; expressions for understanding, responding and investigating used only when they fit,
  never twice in a row; no invented steps, no narrated reasoning; after an interruption it continues from what
  the owner just said.
- **Long calls.** Bedrock ends a stream after eight minutes; the relay starts a fresh one after about seven and
  replays what was said.
- **When Sonic is not available** the button falls back to the step-by-step voice below by itself, and a short notice says why (the model, region and AWS error), so the cause is visible without logs. A call that breaks part-way carries on in the step-by-step voice the same way.
- **AIC always listens in a voice conversation**, also while it talks (the owner's wish). In the step-by-step voice the mic stays open for the whole conversation. While AIC's reply plays, a level listener (echo cancellation, noise-relative threshold) silences it the moment the owner's voice rises, and what the owner says goes straight to AIC. Words that are mostly AIC's own reply coming back from the speakers are ignored (`isEcho` in `web/src/voice/convo.ts`). See `web/src/voice/bargeIn.ts`.
- **No "um" or stammers.** What the owner says is cleaned before it is sent or typed: fillers, stammered repeats and filler-only sounds are dropped (`web/src/voice/clean.ts`, `ios/AICity/Voice/SpeechClean.swift`); words in quotation marks stay exactly as said. In the voice conversation the pieces heard between short pauses (under 1.1 s) go as one message.
- **Voice on is unmistakable**: the screen behind dims, the voice bar glows, a beating "Voice on" badge shows, and the voice button breathes.
- **Logs.** The ace runtime logs `voice.*` lines (model chosen, rotation, failures).

## Step-by-step voice: OpenAI text-to-speech

The owner chose OpenAI's voice for AIC's spoken replies ("use OpenAI's voice, whatever they have as
default"). This is a voice service only: the agents keep running on Anthropic models through Amazon Bedrock.
Until the key is in, the HUD speaks through Amazon Polly as before.

## One-time setup (about two minutes)

1. Create an API key at https://platform.openai.com/api-keys (any name, for example "AI City voice"). Copy it
   once; it starts with `sk-`.
2. In AI City, open **Settings → Voice** and paste the key into the **OpenAI key** field. It goes straight to AWS
   Secrets Manager (`aic/prod/openai`), is never shown again, never logged, and never sent anywhere but OpenAI.
3. Pick a voice (**Marin (closest to ChatGPT's Sol)** is preselected, decision 105) and press **Test voice**: you
   should hear one sentence. From then on AIC speaks through OpenAI.

No redeploy is needed: the key is read when a reply is spoken.

## What it costs

OpenAI bills text-to-speech per character: about $0.015 per 1,000 characters for `gpt-4o-mini-tts` (a
three-sentence reply is well under a cent). Nothing is charged while the key is empty.

## How it works

- `POST /speech` (owner only, like every route) takes `{"text": "...", "voice": "marin"}` (text up to 2,000
  characters, voice optional) and answers with the MP3 bytes (`Content-Type: audio/mpeg`, never cached).
- The Lambda calls OpenAI's speech API with `gpt-4o-mini-tts` plus an `instructions` line asking for ChatGPT's
  Sol manner (savvy and relaxed), and falls back to `tts-1` if the account can't use the newer model (no
  instructions there; marin, cedar, ballad and verse become `sage`); 15-second timeout.
- ChatGPT's own voices (Sol, Cove, Juniper, …) are not offered by any OpenAI API and cannot be cloned from a
  recording; marin with the Sol instructions is the closest the API allows.
- OpenAI has announced that `tts-1`, `tts-1-hd` and `gpt-4o-mini-tts` shut down on **2027-01-06**; the
  replacement is the Realtime API (`gpt-realtime-2.1-mini`), a different workflow. Plan that migration in 2026.
- `GET /voice/openai` → `{configured, voices, default, key_saved_at}`; `PUT /voice/openai-key` with `{"key"}`
  stores the key.
- Errors come back as `{"error": code, "message": plain words}`: `503 not_configured` (no key yet), `503 bad_key`
  (OpenAI rejected it: paste it again), `503 rate_limited`, `502 timeout`, `502 unreachable`, `502 openai_error`.
  The HUD shows the message on the voice line once and speaks with Polly for the rest of the visit; saving a key
  or a working Test voice tries OpenAI again (`web/src/voice/openai.ts`).
- Only the api function may read or write the secret (`infra/modules/voice`); the key never reaches the
  browser, the agents or the logs.

## Where to look

`backend/src/aic/shared/speech.py`, the `_speech_routes` block in `backend/src/aic/lambdas/api.py`,
`infra/modules/voice/main.tf`, tests in `backend/tests/test_speech.py`.
