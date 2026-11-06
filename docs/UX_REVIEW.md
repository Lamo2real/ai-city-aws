# UX review (section 2.9, every screen)

Method: each screen was walked through against the ten rules of section 2.9, on desktop (1280×800) and on a phone (Pixel 7, 412 px wide), with the Playwright journeys in `web/e2e/` and the screenshots in `docs/screenshots/`. Automated: axe (WCAG 2 A/AA) on Ace, City, Needs you, Tickets, Costs and Settings reports **no serious or critical violations**; a test counts primary buttons on each screen (≤ 1).

Legend: ✅ meets the rule · 🔧 failed first, fixed tonight · ⚠️ known gap (not fixed tonight).

## Rules × screens

| Rule | Sign-in | Ace | City | Needs you | Tickets | Costs | Settings | First-run guide |
|---|---|---|---|---|---|---|---|---|
| One obvious next action, ≤ 1 primary | ✅ automatic redirect, no buttons | ✅ Send | ✅ "Open: needs you" only when something waits | ✅ the first "Use default" | ✅ none (list) | ✅ none | ✅ Save changes | ✅ Next / Start |
| Plain words, details behind a toggle | ✅ | ✅ | ✅ (IDs only as name plates, like the Mac HUD) | ✅ | ✅ JSON behind "Details" | ✅ model names, not IDs | ✅ "Worldwide / Europe only" instead of profile prefixes | ✅ |
| Talking to Ace is the default | — | ✅ lands here, input focused (tested), mic visible | ✅ big mic in the bottom bar | ✅ "Talk to Ace" button | ✅ | ✅ | ✅ | ✅ |
| Nothing dangerous by accident | — | — | — | ✅ approvals need **holding** (tested: a tap does nothing) | — | — | ✅ pause asks first and says what happens and what it costs; raising a cap asks, and a very high cap needs typing **raise**; Undo for 12 s on pause and on settings | — |
| Safe defaults | — | ✅ | — | ✅ every question shows its default with one tap | — | — | ✅ pre-filled from the server; negative caps rejected; caps above the sanity limit need confirmation; > 25 sessions/s rejected by the API | — |
| Always show what's happening | ✅ "Taking you to sign in…" | ✅ eyes show listening / thinking / speaking / waiting in words; streamed reply | ✅ live feed, bubbles, walking figures | ✅ toast after each answer | ✅ skeleton | ✅ skeleton | ✅ skeleton; busy state on buttons | — |
| Errors explain and fix | ✅ boot failure has "Try again" | ✅ "Connection lost. Your messages are saved. Reconnecting…" (tested); unsent messages marked and re-sent | ✅ banner if the city can't load or live updates stop | ✅ plain error + nothing changed | ✅ "Try again" | ✅ "Try again" | ✅ | — |
| Money always visible | — | ✅ pill in the header on every screen | ✅ pill + "Est. value" in the status bar | ✅ | ✅ | ✅ meters with amber/red words | ✅ | ✅ step 3 explains it |
| The City explains itself | — | — | ✅ "What the marks mean" legend; tapping a figure or building shows one plain sentence first | — | — | — | — | ✅ step 2 |
| First-run guide | — | — | — | — | — | — | ✅ "Show the first-run guide again" | ✅ 3 steps, skippable (tested) |
| Consistency, 44 × 44 targets | ✅ | ✅ (phone test measures the mic) | ✅ (phone test measures every toolbar button) | ✅ | ✅ | ✅ | ✅ | ✅ |

## What failed and was fixed

1. 🔧 **Needs you went blank.** The list was sorted inside the store selector, which made React re-render forever. Now the store objects are selected and sorted while rendering.
2. 🔧 **Events lost during a reload of the city.** An event that arrived while a fresh snapshot was loading was wiped when the snapshot landed (a question could vanish). The store now replays events received during a snapshot load.
3. 🔧 **Activity feed not reachable by keyboard** (axe: scrollable-region-focusable). It is now focusable and labelled as a log.
4. 🔧 **Low-contrast grey text on dark screens** (axe: color-contrast). Muted text uses a light tone on the night background and the dark tone on parchment cards.
5. 🔧 **Phone: toolbar ran off the screen and tabs were squeezed beside the money pill.** The bottom bar is now two rows (actions above, zoom below), every button stays on screen and ≥ 44 px (tested), and the tabs get their own scrollable row.
6. 🔧 Ambiguous labels: two controls were both called "Talk to Ace"-like; the brand button now reads "AI City — talk to Ace" and the mic is exactly "Talk to Ace".

## Known gaps (not fixed tonight)

- ⚠️ **Departments list on phones**: on narrow screens the Departments/Records panel is hidden to keep the map visible. Buildings remain tappable, but Workforce/Health/Legend are only reachable on wider screens. Suggested fix: a "Records" sheet behind a tile.
- ⚠️ **Voice was tested only with a fake.** Transcribe streaming and Polly need AWS; the push-to-talk and wake-mode flows are covered with a fake voice in Playwright.
- ⚠️ **Undo for answered questions** is not offered, because an answer wakes the agent immediately and cannot be taken back server-side. The confirmation toast says what was sent instead.
- ⚠️ **Screen-reader pass with a real reader** (VoiceOver/TalkBack) was not done; axe and role/label checks were.
