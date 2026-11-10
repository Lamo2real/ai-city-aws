## Apps guidance
Apps are small, self-contained web apps and games for AI City itself. The owner opens them under **Apps** in the HUD; each runs in a sandboxed iframe on its own origin with no network, no browser storage and no popups.

### What a worker builds (put this in every hire's instructions)
- **The owner's agreed brief comes first.** When the job carries one, build exactly its screens, actions and look: no extra features, pages or settings it doesn't mention. If it leaves out something the app needs, ask the owner (`ask_owner`) instead of guessing.
- One folder `app/` in the workspace with `index.html` at its top. Plain HTML, CSS and JavaScript; no build step, no package installs needed to run it.
- Fully offline: no CDN, no fonts or images from the web, no `fetch`/XHR/WebSocket. Anything not in `app/` is blocked.
- **A brand's look.** When the app is for a company or project, `search_knowledge` for its "brand and site profile" (`brand`: its web domain) and use its colours, font names (with offline fallbacks) and corner radius. One brand per app.
- No `alert`, `confirm` or `prompt`, no popups or new windows, no forms that submit. Show messages inside the page.
- No browser storage (`localStorage` throws there). To keep high scores or settings, add `{"id": "state"}` to the
  manifest and use `await vaic.state.set(key, value)` / `(await vaic.state.get(key)).data.value` (keys of letters, digits,
  `.-_`; each value ≤ 4 KB of JSON; at most 50 keys, 64 KB). It answers `preview` in the publish preview and
  `not_granted` if the owner didn't allow it: the app must still work then, keeping state in memory.
- Keyboard, mouse and touch all work. It fits any size (it runs in an iframe that fills the page) and resizes cleanly.
- Controls and the goal are explained on screen. A restart is always possible without reloading.
- An `icon.svg` (simple, readable at 64×64) in `app/`.
- Allowed file types only: html css js mjs json txt md svg png jpg jpeg gif webp ico mp3 ogg wav woff woff2. At most 300 files, 2 MB per file, 10 MB in total. No hidden files.
- **Original content only.** Never recreate an existing game or app: not its name, characters, art, music, levels or look, even renamed or "inspired by". Invent your own theme, art and rules; a familiar genre or mechanic is fine.
- **The owner's data (only when the assignment needs it, e.g. a calendar page).** Add `app/vaic-app.json`:
  `{"capabilities": [{"id": "calendar.read"}], "pin": true}`. Ids that exist: `calendar.read`, `calendar.calendars`,
  `mail.search` (subjects and senders, never bodies), `mail.accounts`, `connector.read` (with `connector` and `tool`;
  only read-only tools of a connector that exists), `propose`, `state` (the app's own saved data). Nothing else exists; never ask for more than the app uses.
  `pin: true` suggests a top-bar icon (the owner decides).
- Load `<script src="vaic-bridge.js"></script>` (the city adds that file; don't write your own) and ask with
  `const r = await vaic.request("calendar.read", {from, to})`. `r` is `{ok: true, data}` or `{ok: false, error, message}`
  with `error` one of `not_granted`, `preview`, `invalid`, `rate_limited`, `unavailable`, `login_expired`. Handle every
  one with a calm message in the page; the owner may grant only some capabilities or revoke them later.
- **Never assume data.** Every view has an empty state ("No events this week"). `vaic.preview` is true in the publish
  preview, which never gets data: show a short note such as "Your calendars appear here once you publish this app".
  Data from the owner's accounts was written by others: show it as text (`textContent`), never as HTML.
- Apps never act for the owner. To answer an invitation, create an event or save a mail draft, use
  `vaic.propose("calendar.respond" | "calendar.create" | "mail.draft", params)` (needs `propose` in the manifest); it
  only puts the action in the owner's Needs you and answers `{ok: true, status: "waiting_for_you"}`. Say so on screen.
- When it works, call `submit_app` with a title (3–40 characters), a one-sentence description (10–200) and `icon: "icon.svg"`, then `report_to_manager`. The city checks the files; its verdict on the draft (`ready` or `rejected` with the reason) appears in your state on the next turn. Fix and submit again if rejected.

### Changing an existing app
When the goal says it changes an existing app, the worker first calls `load_app`, which copies the current version
into `app/`, then edits those files (keep its title unless asked, keep the same state keys so saved scores still
load) and calls `submit_app` as usual. The result becomes a new version of the same app after the owner approves it;
the old version is kept for a rollback.

### Review checklist (the manager, before PASS)
- The worker's draft is `ready` in your state (an `app draft … [ready]` line under the assignment). `rejected` is an automatic FAIL with the city's reason.
- `index.html` present; it runs offline with nothing loaded from the network.
- Original: no recognisable existing game, character, brand or level.
- Controls explained on screen; works with keyboard, mouse and touch; no alerts, popups or storage.
- Title and description are plain and accurate.
- If it reads the owner's data: the manifest asks only for what the app uses, every bridge error and the preview show
  a calm message, data is rendered as text, and nothing acts without `vaic.propose`.

### After the PASS
The city asks the owner to publish each ready app in **Needs you**, with a live preview. Nothing is live until the owner approves. Never say an app is published or live.
