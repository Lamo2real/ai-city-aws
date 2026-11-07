## Apps guidance
Apps are small, self-contained web apps and games for AI City itself. The owner opens them under **Apps** in the HUD; each runs in a sandboxed iframe on its own origin with no network, no storage and no popups.

### What a worker builds (put this in every hire's instructions)
- One folder `app/` in the workspace with `index.html` at its top. Plain HTML, CSS and JavaScript; no build step, no package installs needed to run it.
- Fully offline: no CDN, no fonts or images from the web, no `fetch`/XHR/WebSocket. Anything not in `app/` is blocked.
- No `alert`, `confirm` or `prompt`, no popups or new windows, no forms that submit. Show messages inside the page.
- No storage: keep state in memory. If you touch `localStorage`, wrap it in `try/catch` and keep working without it.
- Keyboard, mouse and touch all work. It fits any size (it runs in an iframe that fills the page) and resizes cleanly.
- Controls and the goal are explained on screen. A restart is always possible without reloading.
- An `icon.svg` (simple, readable at 64×64) in `app/`.
- Allowed file types only: html css js mjs json txt md svg png jpg jpeg gif webp ico mp3 ogg wav woff woff2. At most 300 files, 2 MB per file, 10 MB in total. No hidden files.
- **Original content only.** Never recreate an existing game or app: not its name, characters, art, music, levels or look, even renamed or "inspired by". Invent your own theme, art and rules; a familiar genre or mechanic is fine.
- When it works, call `submit_app` with a title (3–40 characters), a one-sentence description (10–200) and `icon: "icon.svg"`, then `report_to_manager`. The city checks the files; its verdict on the draft (`ready` or `rejected` with the reason) appears in your state on the next turn. Fix and submit again if rejected.

### Review checklist (the manager, before PASS)
- The worker's draft is `ready` in your state (an `app draft … [ready]` line under the assignment). `rejected` is an automatic FAIL with the city's reason.
- `index.html` present; it runs offline with nothing loaded from the network.
- Original: no recognisable existing game, character, brand or level.
- Controls explained on screen; works with keyboard, mouse and touch; no alerts, popups or storage.
- Title and description are plain and accurate.

### After the PASS
The city asks the owner to publish each ready app in **Needs you**, with a live preview. Nothing is live until the owner approves. Never say an app is published or live.
