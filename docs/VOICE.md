# AIC's voice: OpenAI text-to-speech

The owner chose OpenAI's voice for AIC's spoken replies ("use OpenAI's voice, whatever they have as
default"). This is a voice service only: the agents keep running on Anthropic models through Amazon Bedrock.
Until the key is in, the HUD speaks through Amazon Polly as before.

## One-time setup (about two minutes)

1. Create an API key at https://platform.openai.com/api-keys (any name, for example "AI City voice"). Copy it
   once; it starts with `sk-`.
2. In AI City, open **Settings → Voice** and paste the key into the **OpenAI key** field. It goes straight to AWS
   Secrets Manager (`aic/prod/openai`), is never shown again, never logged, and never sent anywhere but OpenAI.
3. Pick a voice (OpenAI's default, **alloy**, is preselected) and press **Test voice**: you should hear one
   sentence. From then on AIC speaks through OpenAI.

No redeploy is needed: the key is read when a reply is spoken.

## What it costs

OpenAI bills text-to-speech per character: about $0.015 per 1,000 characters for `gpt-4o-mini-tts` (a
three-sentence reply is well under a cent). Nothing is charged while the key is empty.

## How it works

- `POST /speech` (owner only, like every route) takes `{"text": "...", "voice": "alloy"}` (text up to 2,000
  characters, voice optional) and answers with the MP3 bytes (`Content-Type: audio/mpeg`, never cached).
- The Lambda calls OpenAI's speech API with `gpt-4o-mini-tts` and falls back to `tts-1` if the account can't use
  the newer model; 15-second timeout.
- `GET /voice/openai` → `{configured, voices, default, key_saved_at}`; `PUT /voice/openai-key` with `{"key"}`
  stores the key.
- Errors come back as `{"error": code, "message": plain words}`: `503 not_configured` (no key yet), `503 bad_key`
  (OpenAI rejected it: paste it again), `503 rate_limited`, `502 timeout`, `502 unreachable`, `502 openai_error`.
  The HUD shows the message on the voice line and falls back to Polly for that reply.
- Only the api function may read or write the secret (`infra/modules/voice`); the key never reaches the
  browser, the agents or the logs.

## Where to look

`backend/src/aic/shared/speech.py`, the `_speech_routes` block in `backend/src/aic/lambdas/api.py`,
`infra/modules/voice/main.tf`, tests in `backend/tests/test_speech.py`.
