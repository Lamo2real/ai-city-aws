# Apps built by the city: contract

Status: contract for the build (lead session, 2026-11-07, branch `apps`). The backend, infra and web
sessions build against this file; change it here first if a shape must change.

## What the owner gets
The owner tells AIC "I'm bored, make me a game where …" (or any small feature). AIC hands it to the
Orchestrator as usual. The Orchestrator uses the **Apps** department (creates it the first time), the
manager hires workers, they build a self-contained web app (HTML/JS/CSS, original content only), the
manager reviews, the Orchestrator signs off. On a PASS sign-off the city asks the owner in **Needs you**
to publish it, with a live preview. Once approved, the app appears as an icon under **Apps** in the HUD
nav and opens as its own page inside AI City (`#/apps/<slug>`), with a way back. The owner can remove it.
The City view shows the whole build: the Apps building, workers walking in and working, their activity,
a "waiting for you" sign while the publish approval is open, and a finished marker when it is published.

## Flow
```
owner → AIC delegate_to_orchestrator → Orchestrator (department "Apps") → Manager → Worker(s)
worker builds in /tmp/work/<hire_id>/app/  →  tool submit_app  (worker runtime, workspace role)
   uploads files to s3://<workspaces>/hires/<hire_id>/app/<path>, puts event app.submitted
EventBridge rule (type = app.submitted) → apps Lambda (aic-prod-apps)
   validates, copies to s3://<apps>/drafts/<draft_id>/<path>, writes APPDRAFT record, puts app.draft
manager review → Orchestrator sign_off PASS
   sign_off (city code, not the prompt) files one approval of kind "app.publish" per ready draft of the task
owner: Needs you → preview iframe → Approve  → POST /approvals/<id> {approved:true}
   API copies drafts/<draft_id>/ → live/<app_id>/, writes APP record, puts app.published
owner: Apps → icon → #/apps/<slug> → sandboxed iframe on the apps origin
owner: Remove → DELETE /apps/<app_id> → deletes live/<app_id>/, CloudFront invalidation, APP record, app.removed
```
Refuse in Needs you → draft status `refused`, nothing is published; the approval is decided like any other
(the existing resume step tells the Orchestrator the owner refused).

## Security (the reason for most of this design)
Apps are agent-written code. They must never reach the owner's tokens, the API, or the HUD's storage.
1. **Isolated origin.** A second CloudFront distribution (its own `*.cloudfront.net` domain) serves a
   dedicated bucket `aic-prod-apps`. The HUD origin never serves app files.
2. **Sandboxed iframe.** The HUD shows apps only as
   `<iframe sandbox="allow-scripts" referrerpolicy="no-referrer" allow="" src="<appsUrl>/live/<app_id>/index.html">`.
   Never `allow-same-origin`, `allow-popups`, `allow-top-navigation*`, `allow-forms`, `allow-modals`.
   The document gets an opaque origin: no cookies, no localStorage/sessionStorage, no IndexedDB.
   v1: the HUD registers **no** `message` listener for apps. v2 adds exactly one listener, the data bridge
   (§ "v2: data bridge"), which answers only the frame it opened and only with granted read data.
3. **Strict CSP on the apps origin** (response headers policy, override = true):
   `default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; worker-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors https://*.cloudfront.net`
   plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
   `Permissions-Policy: camera=(), microphone=(), geolocation=(), usb=(), payment=(), clipboard-read=()`,
   HSTS, and CORS `Access-Control-Allow-Origin: *` for GET/HEAD only (an opaque-origin document needs it
   for `type="module"` scripts; nothing on this origin is secret and it sets no cookies).
   `frame-ancestors` cannot name the HUD's exact domain: the HUD CSP must name the apps domain, so the two
   distributions would depend on each other (Terraform cycle). The wildcard is the accepted residual risk
   (someone else's CloudFront site could frame a game); a custom domain (listed gap) removes it.
4. **HUD CSP** gains exactly the apps origin: `frame-src <appsUrl>` and `img-src … <appsUrl>` (icons).
   `connect-src` does not change.
5. **Validation in the apps Lambda** (never trust the worker's file list): `index.html` required; at most
   300 files and 10 MB in total, 2 MB per file; relative paths of `[A-Za-z0-9._/-]` only, no `..`, no
   leading `/`, no hidden files; extensions allowlist `html css js mjs json txt md svg png jpg jpeg gif webp
   ico mp3 ogg wav woff woff2`; `Content-Type` set by the Lambda from the extension (never from the worker);
   `Cache-Control: no-cache` for `.html`, `max-age=300` otherwise. A failed check → draft `rejected` with
   the reason, put on `app.draft`; the worker's ticket gets the reason in its history.
6. **Publishing needs the owner** (approval kind `app.publish`, decided only through the owner-only API).
   No agent tool can publish, remove or touch `live/`. Workers never get the apps bucket.
7. Agent text (title, description) is untrusted: the HUD renders it as plain text, capped
   (title ≤ 40 chars, description ≤ 200).
8. The apps origin is public read like any CloudFront site, but paths carry random ids
   (`live/app-<12 hex>/`) and apps hold no owner data.

## Data (single-table ledger)
| Item | pk | sk | Fields |
|---|---|---|---|
| Draft | `APPDRAFTS` | `DRAFT#<draft_id>` | `draft_id` (`drf-<12 hex>`), `hire_id`, `ticket_id` (worker's assignment ticket), `task_id`, `department`, `title`, `description`, `icon` (relative path or null), `status` (`staging` / `ready` / `rejected` / `awaiting_owner` / `published` / `refused`), `reason`, `files` [{`path`,`size`,`type`}], `total_bytes`, `preview_url`, `approval_id`, `created_at` |
| App | `APPS` | `APP#<app_id>` | `app_id` (`app-<12 hex>`), `slug` (unique, `[a-z0-9-]{1,40}` from the title, `-2`… on clash), `title`, `description`, `icon_url` or null, `url` (`<appsUrl>/live/<app_id>/index.html`), `draft_id`, `task_id`, `published_at` |
| Approval | `APPROVAL#<id>` | `META` | existing record + `kind: "app.publish"`, `draft_id`, `preview_url`, `title`, `description` |

## Tool (worker only): `submit_app`
`mcp__city__submit_app` in `runtime/tools.py`, worker tool set, gated like every tool (policy allows it).
Input: `{ "title": str 3–40, "description": str 10–200, "dir": str = "app", "icon": str | null }`
(`dir` relative to `/tmp/work/<hire_id>/`; `icon` a path inside it, svg/png, shown 64×64).
Does: walks the dir, refuses early on the limits above (same checks as the Lambda, shared code), assumes
the workspace role with session tag `hire_id`, uploads to `hires/<hire_id>/app/<path>` (deleting older
objects under that prefix first), puts `app.submitted`. Returns "Submitted <n> files; the city is checking
them." Calling it again replaces the submission (new draft; older drafts of the same hire become `rejected`
with reason "replaced").

## Events (add to `shared/events.py`; all carry `at`)
- `app.submitted` {`hire_id`, `ticket_id`, `task_id`, `department`, `title`, `description`, `icon`, `files`: [{`path`,`size`}]}
- `app.draft` {`draft_id`, `ticket_id`, `task_id`, `department`, `title`, `status`, `reason`?, `preview_url`?}
- `app.published` {`app_id`, `slug`, `title`, `icon_url`?, `url`, `task_id`, `department`}
- `app.removed` {`app_id`, `slug`}
- `approval.requested` carries `kind` (`tool` default, or `app.publish`); `app.publish` also carries `draft_id`, `preview_url`, `title`, `description`.

## API (owner-only like every route; added to the routes list and `test_api.py`'s owner check)
- `GET /apps` → `{ "apps": [App, …] }` newest first.
- `DELETE /apps/<app_id>` → `{ "removed": app_id }`; 404 if unknown.
- API Lambda env (backend, 2026-11-07): `AIC_APPS_BUCKET`, `AIC_APPS_URL`, `AIC_APPS_DISTRIBUTION_ID`. Without the first two, publish/remove answer 503 and the approval stays pending.
- `POST /approvals/<id>` (existing): when `kind == "app.publish"`, approve → publish (copy, APP record,
  `app.published`, draft `published`) and return `{approval, app}`; refuse → draft `refused`.
  Publishing is idempotent on `draft_id`.
- The city snapshot (`GET /city` or whatever `loadCity` reads) gains `apps` (same list) so the City view
  can place finished markers after a reload.

## Lambda `aic-prod-apps` (`backend/src/aic/lambdas/apps.py`)
Trigger: EventBridge rule on the city bus, `detail.type = "app.submitted"`. Reads `hires/<hire_id>/app/*`
from the workspaces bucket (KMS decrypt), validates (`shared/apps.py`, shared with the tool), copies to
`drafts/<draft_id>/`, writes the draft (`ready` or `rejected`), puts `app.draft`. Env:
`AIC_APPS_BUCKET`, `AIC_APPS_URL`, `AIC_WORKSPACES_BUCKET`, plus the usual ledger/bus names.

## Infra (`infra/`)
- New module `infra/modules/apps` (or inside `frontend`; infra session's call, but no cycle): bucket
  `${name}-apps` (SSE-S3 like the site bucket so OAC reads it, versioning, public access block, TLS-only,
  lifecycle: `drafts/` expire after 30 days), OAC, distribution (default cert, `PriceClass_100`, same WAF
  web ACL as the HUD, no SPA error rewrite: a missing file is a 403/404), response headers policy above.
- HUD CSP in `frontend`: `frame-src` and `img-src` add the apps URL (pass `apps_url` in).
- `config.json` gains `appsUrl` (public value).
- Lambda `aic-prod-apps` (arm64, the shared zip) + EventBridge rule + DLQ like the others;
  IAM: `s3:GetObject`/`ListBucket` on workspaces `hires/*/app/*` + `kms:Decrypt` on the data key,
  `s3:PutObject` on apps `drafts/*`, ledger `PutItem/UpdateItem/GetItem/Query` limited to
  `APPDRAFTS`, bus `PutEvents`.
- API Lambda: `s3:GetObject`/`ListBucket` on apps `drafts/*`, `s3:PutObject`/`DeleteObject` on apps
  `live/*`, `cloudfront:CreateInvalidation` on the apps distribution; ledger keys `APPS`, `APPDRAFTS`
  (whatever form its policy already uses).
- No new permission for workers or the Orchestrator (workers already reach `hires/<own id>/`).
- Cost-allocation tags with `Component = "apps"`; `scripts/check-iam.mjs` and `check-tags.mjs` pass.
- The deploy uploads nothing to the apps bucket.

## Prompts (`agents/`)
- `agents/departments/apps.md` (new): self-contained web apps and games for AI City. One folder
  `app/` with `index.html`; plain HTML/CSS/JS, no build step, no CDN or network (it will be blocked), no
  `alert/confirm/prompt`, no popups, no storage (wrap any `localStorage` use in try/catch; keep state in
  memory), keyboard + mouse + touch, fits any size (it runs in an iframe), an `icon.svg`. **Original content
  only**: no recreation of an existing game, its name, characters, art, music or levels, even renamed.
  The manager's review checks: index.html present, runs offline, original, controls explained on screen,
  `submit_app` called and its draft is `ready` (the manager sees `app.draft` in the ticket history).
- `orchestrator.md`: "a game, toy or small tool for AI City itself → the Apps department; after a PASS the
  city asks the owner to publish it, so don't promise it is live".
- `ace.md`: when the owner asks for a game or app, delegate; say it will appear under Apps after they
  approve it in Needs you.
- `worker.md`: mention `submit_app` only for Apps work.

## HUD (`web/`)
- Nav: one new item **Apps** (`#/apps`), placed after Tickets. The knowledge (`knowledge`) and connectors
  (`skills`) sessions also add items to `VIEWS` in `App.tsx`: append yours, expect a
  trivial merge.
- Routes: `#/apps` = grid of app icons (icon + title + description, empty state: "Ask AIC for a game");
  `#/apps/<slug>` = app page: top row with "← Apps" (back), the title, and "Remove" (confirm dialog,
  then `DELETE`), the sandboxed iframe filling the rest. Unknown slug → "This app is gone" + back.
  `viewFromHash` must accept `apps/<slug>`.
- Needs you: an `app.publish` approval shows title, description, the preview iframe (same sandbox
  attributes, `src = preview_url`), Approve (primary) / Refuse.
- Store: `apps` list from the snapshot/`GET /apps`, updated by `app.published` / `app.removed`;
  `appsUrl` from `config.json`.
- City view (`web/src/city/`): the Apps department building appears on `department.created` (exists);
  workers' activity bubbles (exist); add: a "waiting for you" sign on the building while a draft is
  `awaiting_owner` (`approval.requested` with kind `app.publish`), confetti + a small arcade-cabinet marker
  per published app at the building on `app.published` (from the snapshot after a reload), removed on
  `app.removed`; clicking a marker opens `#/apps/<slug>`. Original pixel art only.
- Tests: vitest for the store reducers, the hash routing, the iframe attributes (exact `sandbox` value,
  no `allow-same-origin`); Playwright journeys (mock API + a fake apps origin served by the mock):
  open an app from Apps and come back; approve a publish from Needs you with the preview shown; remove
  an app; axe clean; ≤ 1 primary button per screen.

## Tests (fakes only, never Bedrock or AWS)
- backend: `shared/apps.py` validation table (paths, sizes, types, missing index), the tool with a fake
  S3 and fake STS, the Lambda with fake S3/ledger/bus, sign_off filing `app.publish` approvals only for
  ready drafts of that task, API publish/refuse/remove/idempotency/owner-check, event schemas.
- infra: `tests/infra.test.ts` asserts the apps CSP has `connect-src 'none'`, the HUD CSP's frame-src is
  only the apps origin, tags, and that no worker/orchestrator policy names the apps bucket.

## v2: data bridge (the owner's requirement, 2026-11-07)
The owner's words: "the user should have the option to create this kind of ecosystem and environment, so that
the user can add anything dynamically and on demand". Example: "a combined calendar page with an icon in the top
bar" showing the day, week, month or year across personal and work accounts, **built as an app on demand**.
So an app may read the owner's data, but only what the owner granted it, only by asking the HUD, and never
anything that acts for the owner. Everything in v1 stays: isolated origin, `sandbox="allow-scripts"`,
`connect-src 'none'`. The app still can't reach the network, the API, tokens or storage.

### Manifest: `app/aic-app.json` (optional; no file = no capabilities)
```json
{ "capabilities": [
    { "id": "calendar.read" },
    { "id": "mail.search" },
    { "id": "connector.read", "connector": "<connector id>", "tool": "<tool name>" } ],
  "pin": true }
```
Capability catalogue (`backend/src/aic/shared/app_caps.py`, one table; nothing else is ever grantable):
| id | Params (validated by the API) | Runs | Returns |
|---|---|---|---|
| `calendar.read` | `{from, to}` ISO, ≤ 366 days, split into ≤ 62-day calls; `calendar_ids?` | the same code as the `calendar_events` tool (`docs/MAIL_CALENDAR.md` §5.2, §11) | `{events: [Event], calendars: [Calendar], errors}` |
| `calendar.calendars` | — | `calendar_list` | `{calendars}` |
| `mail.search` | `{query, account_id?, unread_only?, after?, before?, limit ≤ 25}` | `mail_search` | `{messages: [MailSummary]}` (no bodies) |
| `mail.accounts` | — | `mail_accounts` | `{accounts: [{id, label, provider, address}]}` |
| `connector.read` | `{args}` for that one tool, checked against the tool's input schema | the connector's Gateway tool `<id>___<tool>`, **only if** its record says `read_only: true` and not `destructive` (`docs/CONNECTORS_SKILLS.md` §1.2, §1.4) | `{content}` (text parts only, ≤ 100 KB) |
Never grantable, by construction (not in the table): any send, draft, trash, label, create, update, respond,
delete, accept, any non-read-only connector tool, AIC/city tools, knowledge writes, settings.

Validation: the apps Lambda reads the manifest at staging; an unknown capability id, a `connector.read` naming
a connector or tool that doesn't exist or isn't read-only, or a malformed file → the draft is `rejected` with
the reason. Requested capabilities are stored on the draft (`capabilities`).

### Grant at publish (Needs you)
- The `app.publish` approval carries `capabilities` and the card lists each in plain words, e.g. "Read your
  calendars (all accounts)", "Search your mail (subjects and senders, not bodies)", "Read from <connector label>:
  <tool>". Each has a switch, on by default; the owner may turn any off. Approve = publish with those grants.
- `POST /approvals/<id>` for `app.publish` accepts `{approved: true, grants?: [capability, …]}`; `grants` must be a
  subset of the draft's `capabilities` (default: all). Stored on the APP record as `grants` with `granted_at`.
- Settings → Apps (or the app page's ⋯ menu): the owner can revoke any grant later
  (`PUT /apps/<app_id> {grants?, pinned?}`); grants can only shrink there, never grow (a new grant needs a new
  publish). Revoking takes effect on the next request.
- **Preview has no data.** In Needs you the preview frame gets `{ok: false, error: "preview"}` for every request,
  so the owner sees the app's empty state; the city's `aic-bridge.js` exposes `aic.preview === true`.

### Runtime protocol (HUD ⇄ app)
The city adds `aic-bridge.js` (its own file from `backend/src/aic/assets/aic-bridge.js`, never the worker's; a
worker file with that name is overwritten) to every staged app. Apps use:
```js
const r = await aic.request("calendar.read", { from: "2026-11-01T00:00:00Z", to: "2026-12-01T00:00:00Z" });
// r = { ok: true, data } | { ok: false, error: "not_granted" | "preview" | "invalid" | "rate_limited" | "unavailable" | "login_expired", message }
```
Wire format (structured clone, no functions): app → parent `{aic: 1, id: <random string ≤ 40>, cap, params}`;
parent → app `{aic: 1, id, ok, data | error, message}`.

HUD side (`web/src/lib/bridge.ts`, one `message` listener for the whole HUD):
1. Accept a message only when `event.source === <the contentWindow of the AppFrame currently mounted>` (the
   origin of a sandboxed frame is `"null"`, so the source window is the check, plus `event.origin === "null"`).
   Anything else is dropped silently. The app id comes from the mounted frame's own state, **never from the message**.
2. Shape check (`aic === 1`, `id` string ≤ 40, `cap` string ≤ 40, `params` plain object, JSON ≤ 8 KB), and the
   cap must be in that app's `grants` (HUD copy) — otherwise answer `not_granted` without calling the API.
3. Throttle per frame: 4 in flight, 30 per minute; over → `rate_limited`.
4. Call `POST /apps/<app_id>/bridge {cap, params}` with the owner's token (the token never leaves the HUD).
5. Reply with `frame.contentWindow.postMessage(reply, "*")`. `"*"` is required (the frame's origin is opaque);
   it is safe because the target is that exact window and the HUD CSP `frame-src <appsUrl>` keeps the frame on
   the apps origin (a frame navigated elsewhere is blocked).
6. Never sent to an app: tokens, the API URL, config, ids of other apps, the owner's email, HUD state.
7. Preview frames (Needs you) get `preview` for everything, without an API call.
8. Residual: an app could navigate its own frame to another published app's page on the same origin, which would
   then run with the first app's grants. Every app is owner-approved and grants are read-only, so this is accepted;
   a per-app subdomain (custom domain gap) would remove it.

### API: `POST /apps/<app_id>/bridge` (owner group checked, like every route)
- Loads the APP record; `cap` must be in its `grants` → else 403 `not_granted`. Params validated per capability
  (table above) → 400 `invalid`.
- Runs the read through `policy.gate` as role **`app`**, agent `app-<app_id>`, with tool name `mcp__app__<cap>` for
  mail/calendar reads and `mcp__gateway__<id>___<tool>` for connector reads (so every connector rule in
  `config/policy.json`, such as the merge and secret denies, applies to apps too), audited with `app_id` (name, decision, duration; never args or data,
  as for every tool). `config/policy.json` gets: `^mcp__app__(calendar\.read|calendar\.calendars|mail\.search|mail\.accounts)$`
  → allow for role `app`; every other `mcp__app__` name → deny; for role `app`, "ask" counts as deny. A test pins that no write tool name can pass.
- The api Lambda checks the grant and params, then invokes the **app-bridge Lambda** `aic-prod-app-bridge`
  (role `aic-prod-fn-app-bridge`) synchronously with `{app_id, cap, params}`. Only that Lambda can reach the
  Gateway or the mail/calendar reads for apps, so the api role gets no Gateway access (agreed with the connectors
  lead, `docs/CONNECTORS_SKILLS.md` §1.9 on `connectors-skills`, commit 8fb8d53).
- Connector reads: the bridge Lambda calls `aic.shared.connector_calls.app_call(d, app_id=, connector_id=, tool=,
  args=)` → `{ok, data: [{type: "text", text} | {type: "json", json}], truncated, error}` (Gateway client in
  `aic.shared.gateway`). `app_call` re-checks the grant on the APP record
  (below), that the connector is `ready` and the tool read-only and not destructive, runs `policy.gate` as role
  `app` (agent `app-<app_id>`, tool `mcp__gateway__<id>___<tool>`; "ask" counts as deny) and the audit, applies its own 60/min per-app limit for
  connector calls, and calls the Gateway as the bridge role; the Cedar `permit` for that principal lists
  exactly the `<id>___<tool>` pairs found in some APP record's `grants` that are still read-only, not destructive
  and ready (`docs/CONNECTORS_SKILLS.md` §1.9, commit c4f1cf9).
- After every publish, app removal or grant change the api Lambda invokes the connectors Lambda
  (`aic-prod-connectors`) asynchronously with `{"action": "policies"}` so Cedar matches the grants. Until it
  has run, `app_call`'s own grant check still refuses revoked grants. Output ≤ 200k characters, untrusted.
- Grant record that `app_call` reads: the APP item itself (pk `APPS`, sk `APP#<app_id>`), field `grants`: a list of
  `{id, connector?, tool?}` (for example `{id: "connector.read", connector: "github", tool: "list_issues"}`), plus
  `granted_at`. A revoked grant is simply removed from the list; a removed app has no item.
- Mail/calendar reads (`docs/MAIL_CALENDAR.md` §11 on `connectors-skills`, connectors lead, commit 59a46a2):
  the bridge Lambda uses `aic.mail.service.MailService.from_env(ledger)` and only its read methods `accounts()`,
  `calendars()`, `events(start, end, calendar_ids=None, query=None)` and `search(query, account_id=None, folder=None,
  unread_only=False, after=None, before=None, limit=25)` (summaries only). Results carry `errors` for accounts that
  failed; titles and snippets are untrusted. Bridge IAM for this: `GetWorkloadAccessTokenForUserId` on workload
  `aic-prod-mail` (each account is its own vault user `ma-…`), `GetResourceOauth2Token` on `aic-prod-google` /
  `aic-prod-microsoft` and the default token vault, `secretsmanager:GetSecretValue` on `aic/prod/mail/*` + `kms:Decrypt`
  on the project key, ledger read on `pk = "MAIL"`; no writes, no `CompleteResourceTokenAuth`.
- Proposals run through the mail module: the api files them with `aic.mail.approvals.file(ledger, service, tool, args,
  requested_by="app:<app_id>")` (full tool name such as `mcp__city__calendar_respond`, preview from `aic.mail.preview.build`,
  hash from `policy.action_hash`) and on approve runs `aic.mail.approvals.execute(ledger, service, approval)`, which
  re-checks the policy and the hash and consumes `APPROVED#<hash>` once. Standing rules never apply to app proposals.
- Rate limit per app: 120 requests per minute, counted in the ledger (`RATE#app-<id>`) → 429 `rate_limited`.
- Response ≤ 256 KB (cut lists with `truncated: true`). Data is returned as data; the app renders it inside
  its own sandbox, so hostile content in an email subject can at worst affect that one app's page.
- `login_expired` / `unavailable` pass through as plain errors (the HUD also shows "Sign in again" on the account).

### Outward actions stay with the owner
Apps get no capability that sends, deletes, accepts or changes anything. An app may *propose* one:
`aic.propose(kind, params)` with `kind` in `calendar.respond`, `calendar.create`, `mail.draft` (v2 list; nothing
else). The HUD posts `POST /apps/<app_id>/proposals {kind, params}`; the API files a normal approval (kind `tool`,
the matching mail/calendar tool, with the mail/calendar preview of `docs/MAIL_CALENDAR.md` §5.5,
`requested_by: "app:<app_id>"`) into Needs you. On approve, the API runs that tool once, exactly as shown.
Proposals need the `propose` grant (listed like any capability: "Ask you to approve actions such as answering
invitations"), are limited to 10 per hour per app, and the app only learns `{ok: true, status: "waiting_for_you"}`.

### Pinned apps in the top bar
- APP record `pinned` (bool; the manifest's `pin` is a suggestion shown as a pre-ticked box on the publish card).
- The HUD top bar shows up to 6 pinned app icons after the nav (`aria-label` = title, 44 px targets), each
  opening `#/apps/<slug>`; a 7th pin is refused with a plain message. On phones they move into the nav overflow.
- Pin/unpin from the app page (☆) and Settings → Apps; `PUT /apps/<app_id> {pinned}`; event `app.updated {app}`.

### Backend notes (apps-v2-backend, 2026-11-07; additions, nothing removed)
- `aic.propose(kind, params)` travels as a bridge message with `cap: "propose"` and `params: {kind, params}`; the HUD
  posts it to `POST /apps/<id>/proposals {kind, params}`.
- `POST /approvals/<id>` for `app.publish` also accepts `pinned?: bool` (default: the manifest's `pin`, dropped
  silently when 6 apps are already pinned; `pinned: true` then answers 409). `grants` outside the draft's
  `capabilities` → 400, and the approval stays pending.
- Drafts, `app.publish` approvals and `approval.requested` carry `capabilities` with a plain `label` on each, and `pin`.
  The APP record has `capabilities` (asked), `grants`, `granted_at`, `pinned`.
- Bridge answers: 200 `{ok: true, data}`; 403 `not_granted`; 400 `invalid`; 429 `rate_limited`; 404 unknown app;
  `unavailable` / `login_expired` come as 200 `{ok: false, error, message}`.
- An approved proposal answers `{approval, result: {ok, result | error, message}}`. The approval stores the exact
  `input`, `preview` and `requested_by: "app:<app_id>"`; its `agent` is `app-<app_id>` (not an agent record, so the
  Step Functions resume step wakes nobody).
- Connector reads check the connector record (`CONNECTORS` / `CONN#<id>`, `status: ready`, tool `read_only: true`
  and `destructive: false`) at staging and again on every call; a tool `input_schema` (or `inputSchema`) on the
  record, when present, is checked against `args`. The apps Lambda therefore reads `CONNECTORS` from the ledger.
- Gate names are built only from validated catalogue ids, so the `$` in the `mcp__app__` policy regex (Python also
  matches it before a trailing newline) can't be reached with a crafted name.

### Events (v2)
`app.updated` {`app`} (grants or pin changed). Apps granted `calendar.read` or `calendar.calendars` also get the
`calendar.changed` event (`docs/MAIL_CALENDAR.md` §6) through the bridge as `{aic: 1, event: "calendar.changed"}`, so they
can reload; `aic-bridge.js` exposes it as `aic.on("calendar.changed", fn)`. No other event reaches an app. The combined
calendar the owner asked for is an app built on demand (there is no fixed Calendar screen); account `color` and
calendar `hidden` come with `calendars`. `approval.requested` for `app.publish` also carries `capabilities`.

### Where the work goes
- **backend:** `app_caps.py` (catalogue, params validation, labels), manifest checks in `stage_submission`,
  `aic-bridge.js` asset, grants on publish, `PUT /apps/<id>`, `POST /apps/<id>/bridge`, `POST /apps/<id>/proposals`,
  role `app` in the gate + policy rules, rate limit, `app.updated`, prompts (apps department: manifest, `aic.request`,
  `aic.preview`, empty states, never assume data). Mail/calendar capabilities wire to the mail/calendar module once
  branch `connectors-skills` merges; until then they answer `unavailable`. Connector reads wire to `GatewayClient` once
  `connectors-skills` merges; same fallback.
- **web:** `lib/bridge.ts` (the listener above), grant switches on the publish card, pinned icons in the top bar,
  pin and grant controls on the app page / Settings → Apps; vitest for every drop rule (wrong source, wrong shape,
  not granted, rate limit, preview) and Playwright: a fake calendar app on the fake apps origin reads granted
  events, gets `not_granted` after a revoke, and a proposal lands in Needs you.
- **infra:** routes `POST /apps/{id}/bridge`, `POST /apps/{id}/proposals`, `PUT /apps/{id}`; Lambda
  `aic-prod-app-bridge` (role `aic-prod-fn-app-bridge`, the shared zip, handler `aic.lambdas.app_bridge.handler`)
  that only the api role may invoke, with ledger read on `APPS`/`CONNECTORS`/mail account rows, `RATE#app-*` and audit
  writes, and `bedrock-agentcore:InvokeGateway` on the connectors gateway (after `connectors-skills` merges);
  mail/calendar secret/vault reads as listed under "Mail/calendar reads" (after `connectors-skills` merges). The api
  role gets `lambda:InvokeFunction` on it and no Gateway access. Nothing for workers or the apps origin. HUD CSP unchanged.
- **connectors session:** `connector_calls.app_call` and the Cedar `permit` for `aic-prod-fn-app-bridge` (§1.9 of its contract).

## Not in v1 (suggested later)
Updating an existing app in place (a new request makes a new app), saved high scores (a per-app storage capability would fit the v2 catalogue), a custom domain for exact `frame-ancestors`.
