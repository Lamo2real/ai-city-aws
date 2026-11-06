# ADR 0006: Voice through a Cognito identity pool, not a Lambda proxy
**Status:** accepted
**Decision.** The browser gets short-lived credentials from a Cognito identity pool (authenticated owner only) whose role allows only `transcribe:StartStreamTranscription(WebSocket)` and `polly:SynthesizeSpeech`. Transcribe uses a custom vocabulary with "AIC" and "AIC".
**Why.** Streaming audio through Lambda adds latency and cost; the identity pool keeps the browser talking straight to the speech services with nothing else allowed. Transcribe and Polly are speech services, not language models.
