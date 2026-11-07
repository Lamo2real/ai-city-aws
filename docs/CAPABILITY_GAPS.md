# Capability gaps: Mac version → AWS version

What the Mac version could do that this one doesn't, and the AWS-native or API replacement.

| Mac capability | Status on AWS | Replacement / plan |
|---|---|---|
| Native Swift and iOS builds (Xcode, simulator) | **Out of scope** — needs macOS | GitHub Actions macOS runners or EC2 Mac (not serverless, costs per host-day); not built |
| Local voice models (Pipecat, Silero VAD, Kokoro/Piper offline TTS) | Replaced | Amazon Transcribe streaming + Amazon Polly neural voices, from the browser |
| Barge-in, smart-turn detection | Not built | Push-to-talk and a wake-word mode; Transcribe partial results could drive barge-in later |
| Apple Calendar, Reminders, Notes | Not available | Reminders and notes live in the ledger (AIC's `add_note`, `add_reminder`); Google Calendar via AgentCore Gateway + Identity (built, off) |
| Mail (IMAP, Gmail through the Mac) | Not available | Gmail via Gateway + AgentCore Identity OAuth (built, off); notifications go out by SNS email |
| Safari control (real browser on the Mac) | Replaced | AgentCore Browser for workers (isolated, cloud); no access to the owner's own browser or logins |
| Spotify control | Built, off | Spotify Web API via Gateway + Identity (secret container exists); no local playback control |
| OpenClaw desktop/shell executor | Replaced | Each worker has its own AgentCore microVM shell and files, plus AgentCore Code Interpreter |
| Telegram relay | Not built | Could be an API Gateway webhook + Lambda; not requested |
| iPhone app (JarvisPhone) | Replaced | The HUD is responsive and works on a phone (tested at 412 px) |
| Keychain secrets | Replaced | AWS Secrets Manager, read by name at runtime |
| launchd schedules | Replaced | EventBridge Scheduler (created disabled) |
| Workers running free with credentials readable (owner's 2026-11-04 decision) | **Changed** | On AWS the policy gate applies to workers by default, and IAM fences them |
| Self-improvement auto-merge | Built, disabled, fenced harder | Cannot touch `infra/`, IAM, caps, policy or CI |
| Reviewer and Executive Secretary agents | Removed by design | Managers review; the Orchestrator signs off; AIC summarizes |
| Workspaces as git worktrees on the Mac | Partly | Workers clone into their microVM and push branches; the S3 workspace sync code (IAM ready) is not written yet |
