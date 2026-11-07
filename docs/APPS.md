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
   The HUD registers **no** `message` listener for apps and never `postMessage`s anything to them.
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
- Nav: one new item **Apps** (`#/apps`), placed after Tickets. The knowledge (`knowledge`), connectors
  (`skills`) and mail/calendar sessions also add items to `VIEWS` in `App.tsx`: append yours, expect a
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

## Not in v1 (suggested later)
Updating an existing app in place (a new request makes a new app), saved high scores (would need a
per-app storage API), a custom domain for exact `frame-ancestors`.
