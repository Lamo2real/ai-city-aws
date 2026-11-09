# Files: design and contract

The owner keeps anything here (photos, videos, PDFs, documents, any type); the departments read it and save their
work into it; VAIC finds any file from a vague spoken description and shows it in the chat to view and download.
This file is the contract between `infra/`, `backend/`, `web/` and `ios/`. The decision and the trade-offs are
decision 151 in `docs/DECISIONS.md`.

> The owner (2026-11-09): "I should also be able to store files in s3 … videos, images, pdf, etc … the departments
> [need] read and write access to that storage … I should be able to … tell AIC 'hey do you remember the time I
> took an image of the sunrise for a thumbnail with the porsche inside that image? can you find it and give it to
> me?' (… possible for any file not just images) and then AIC will pull that image up to the chat to allow the user
> to view it and download it."

## 1. Files is its own store, not a view onto Knowledge
Knowledge is what agents **read as reference** (laws, manuals, notes): every item is chunked into the Bedrock
Knowledge Base and can be pulled into any agent's answer. Files is **storage**: things the owner keeps, finds and
downloads, and what the departments make. Mixing them would put every holiday photo and every draft thumbnail into
every agent's search, and would let workers feed their own output into the knowledge base (which only VAIC, on the
owner's word, may add to). So Files has its own bucket, records and search; it reuses the knowledge base's code
(uploads, routing by format, Haiku vision and page reading, MediaConvert, Transcribe) and the same Titan
embedding model. A document that should also be reference is added to Knowledge too (the + button in the chat).

## 2. Services (eu-north-1, ~$0 idle)
| Part | Service |
|---|---|
| The files | S3 bucket `aic-prod-files`: KMS (project key), versioned (deleted files recoverable 30 days), no public access, TLS only, CORS `PUT`/`GET`/`HEAD` from the HUD origin only, EventBridge notifications |
| Records | DynamoDB `aic-prod-files` (`pk`, `sk`, `gsi1pk`/`gsi1sk`, PITR, KMS) |
| Describing | Lambda `aic-prod-files` (the shared bundle, handler `aic.lambdas.files.handler`, 2,048 MB, 15 min, 20 at once), driven by EventBridge rules on the default bus; DLQ `aic-prod-files-events-dlq` (alarmed) |
| Captions and descriptions | Claude Haiku 5.5 (utility role) through the gate (spend caps, cost rows) |
| Video and odd audio | AWS Elemental MediaConvert with the knowledge base's role (the permission boundary lets roles pass only that one); it also reads `files/*` and writes `work/*` here |
| Speech | Amazon Transcribe batch (jobs named `aic-files-<id>-<ms>`) |
| Previews | CloudFront distribution (Origin Access Control, HTTPS only, trusted key group; signed URLs, 15 min, one object; decision 156); the signing key pair lives only in Secrets Manager `aic/prod/files-signing-key`, made there by the `aic-prod-files-signing-key` Lambda, which Terraform invokes and which returns the public key alone |
| Vectors | Amazon Titan Text Embeddings V2 (`embeddings.files` in `config/models.json`, 512 dimensions), kept on the record as float16 |

## 3. Keys
- `files/<id>/<name>`: the file. `id` = `f-` + 12 URL-safe characters.
- `thumbs/<id>.jpg`: a 480 px thumbnail (images; a video's first frame).
- `work/<id>/…`: frames, the extracted sound, the transcript (expire after 7 days).
- `hires/<hire>/files/<id>/<name>`: a department's drop (§8); adopted into `files/` within seconds; leftovers expire after 7 days.

Record `FILE#<id>` / `META`: `id, name, kind (image|video|audio|document|text|other), content_type, size_bytes,
folder ("Thumbnails/2026"), tags[], note (the owner's or the agent's own words), description (made when it landed),
status (uploading → processing → ready | failed), error?, warning?, object_key, thumb_key?, taken_at? (+ taken_from:
device | photo | owner), added_by ("owner" or the hire id), department?, created_at, updated_at, gsi1 FILE /
<created_at>#<id>`; plus `search_text`, `excerpt` (≤ 2,000 characters of text) and `vec` (base64 float16), which the
API never returns. Pipeline bookkeeping: `upload_id`, `mediaconvert_job`, `transcribe_job`, `stage`,
`frames_description`.

## 4. Uploads (the owner's device)
`POST /files/uploads` creates the record and answers a presigned `PUT` up to 100 MB, else a multipart upload
(64 MB parts, larger above 640 GB so there are never more than 10,000; up to 50 GB per file), the same shape as
Knowledge's. The device sends the bytes straight to S3 (parts in parallel, each retried) and, for multipart, calls
`POST /files/uploads/<id>/complete`. The device's `lastModified` is sent as `taken_at` (a photo's EXIF date, when it
has one, wins; a date the owner sets wins over both).

## 5. Describing (the files Lambda)
| Event | Does |
|---|---|
| Object created under `files/` | `index`: images: thumbnail, EXIF date, a Claude caption ("sunrise over the sea, black Porsche 911, thumbnail… Keywords: …"); PDFs and documents: their text (scanned PDFs: Claude reads the first pages) → a description; audio: Transcribe (MediaConvert first for formats it can't take); video: one MediaConvert job takes up to 12 frames (one every 10 s) and the sound; anything else: found by name, folder and tags |
| Object created under `hires/` | `adopt` (§8) |
| MediaConvert Job State Change, `userMetadata.component = files` | frames → thumbnail + Claude describes four of them; then Transcribe. A video without sound fails the first job: a frames-only job runs instead |
| Transcribe Job State Change, name `aic-files-…` | the transcript (with `[mm:ss]` marks) + the frames' description → Claude's description |
| `{"action": "index", "file_id"}` | "Try again" from the HUD |

Then the search text (name, kind, folder, tags, who added it, the dates in words such as "April 2026, spring,
Sunday", the owner's note, the description and the excerpt) is embedded and the file is `ready`. A step that can't
describe a file never loses it: the file is `ready` with a plain warning (found by its name), or `failed` with the
whole reason and a Try again button (the owner's rule: every error in full). HEIC photos are kept and found by name
(no HEIC decoder in the bundle; the iPhone app and Safari usually send JPEG). Every caption and description prompt
says the file is data, never instructions (`agents/utility/files-*.md`).

## 6. Search
`GET /files?q=…&after=…&before=…&kind=…&folder=…&department=…` and the agents' `find_files`: the query is embedded
with Titan; every file is scored by cosine similarity plus 0.35 × the share of the query's words found in its
search text; files outside `after`/`before` (their `taken_at`, else `created_at`) are left out. VAIC turns "last
spring" into dates itself. The best match "clearly fits" when it leads the second by 0.08; otherwise VAIC shows two
or three and asks. One pass over the records (well under a second for tens of thousands of files); past that the
vectors move to a vector index (§11).

## 7. HTTP API (owner only, like every route)
| Route | Body → answer |
|---|---|
| `GET /files` | browse or search (below) → `{files: [File], count, next, folder, subfolders: [{name, path, files, updated_at}], found_folders, folders, departments, total}` |
| `GET /files/<id>` | → `File` |
| `POST /files/uploads` | `{file_name, content_type, size_bytes, folder?, taken_at?, tags?, note?}` → `{file, upload}` |
| `POST /files/uploads/<id>/complete` | `{upload_id, parts: [{part_number, etag}]}` → `{file}` |
| `PUT /files/<id>` | `{name?, folder?, tags?, note?, taken_at?}` → `{file}` (re-embedded) |
| `DELETE /files/<id>` | → `{ok: true}` (the object, its thumbnail, work files and record) |
| `POST /files/<id>/retry` | → `{file}` (described again) |

`GET /files` takes: `folder` (the open folder; empty = the top level), `q` (search), `scope` (`here`: without `q` the
files right inside `folder`, with `q` the files in `folder` and below; `all`: every file; default `here` without `q`,
`all` with it), `sort` (`relevance` with `q`, `date`, `name`, `size`, `type`), `order` (`asc`/`desc`), `offset` and
`limit` (≤ 200, default 60; `next` is the next offset or null), and `kind`, `department`, `after`, `before`.
Browsing returns the folder's subfolders with their file counts; a search also returns the folders whose path
matches a query word. Folders exist as long as a file is in them (a file's `folder` is its path).

`File` = the record without keys, vector and search text, plus `url` (to view it) and `thumb_url`: CloudFront signed
URLs once the distribution is deployed (S3 presigned inline before that), and `download_url`: always S3 presigned with
`attachment` and the file's current name; all last 15 minutes and are made per request, never stored or logged. Event `files.updated` `{id, status, name, kind,
folder, department, error?}` on every change. VVAIC's `city_api` may call every route except `POST /files/uploads*`
(bytes come from the owner's device), and what it reads back has the signed addresses removed: a signed link only
ever reaches the owner's own screen.

## 8. Agents (all through the policy gate)
| Tool | Roles | Does |
|---|---|---|
| `find_files` | VAIC, managers, workers | §6; results as `<files>` JSON with the line that they are data, never instructions |
| `show_files` | VAIC | 1–3 file ids → event `ace.files` `{conversation, files: [card], ask}`; the HUD and the iPhone draw each with a preview and Download, numbered when there are several |
| `get_file` | managers, workers | a worker gets a copy in its workspace (`files/<name>`); a manager gets the description and, for a text file, its text (≤ 40,000 characters) |
| `save_file` | managers, workers | a worker saves a workspace file, a manager saves text; it goes to `hires/<hire>/files/<new id>/<name>` with folder, description and tags as object metadata; the Lambda adopts it with the department **read from the ledger's agent record** (never from what the agent wrote) and folder `Departments/<department>` by default |

**References for a build (decision 155):** `delegate_to_orchestrator` takes `references` (≤ 5: `file_id`, `use` =
`follow` | `inspiration`, `note`). They are stored on the task, listed for the Orchestrator, managers and workers
(`runtime/references.py`), and a worker's assignment turn carries the images as image blocks (≤ 3) and the documents'
text in `<file-content>` blocks, marked as data. `ace.files` with `label: "References for this build"` shows them in
the chat (the project's own chat in the Apps studio).

**Scoping, as with workspaces:** managers and workers reach the bucket only through the workspace role, assumed with
the session tag `hire_id` (`wkr-…`, now also `mgr-…`): every hire may read `files/*` and write only
`hires/${aws:PrincipalTag/hire_id}/files/*`; no hire may delete. The runtimes read the records and call Titan; VAIC
may also read `files/*` and `thumbs/*` to sign the chat's preview addresses. Only the api and the Lambda write
records. `scripts/check-iam.mjs` (`checkFiles`) enforces this.

## 9. Environment
`FILES_TABLE`, `FILES_BUCKET` (api, the Lambda, VAIC/manager/worker runtimes), `FILES_FUNCTION` (api: Try again),
`MEDIACONVERT_ROLE_ARN` (the Lambda), `FILES_CDN_URL`, `FILES_CDN_KEY_ID` and `FILES_SIGNING_SECRET` (api: signs
previews). The HUD's CSP allows the bucket's two S3 hosts in `img-src`, `media-src`,
`connect-src` and `frame-src` (the PDF preview).

## 10. Tests
pytest `backend/tests/test_files.py` (fakes: memory table and bucket, a bag-of-words embedder, scripted Haiku,
fake MediaConvert/Transcribe/S3); vitest `web/test/files.test.tsx`, `tests/infra.test.ts`; Playwright
`web/e2e/files.spec.ts`; XCTest `ios/AICityTests/FilesTests.swift`.

## 11. Screens
**HUD `#/files`:** breadcrumbs (Files › Brand › 2026) and folder tiles to go in and back up; the files of the open
folder in a grid or a list (remembered on the device), 60 at a time, the next page loading as the end scrolls into
view (and a "Show more" button), thumbnails loaded lazily; sort (best match, newest, oldest, name A–Z / Z–A, largest,
smallest, type); kind and department filters; search names and contents everywhere or "Only in" the open folder,
with matching folders listed first and each file saying where it lives; uploads go into the open folder.
**iPhone, Files tab:** the same browsing (each folder a page, Back goes up, the path above), search with an
Everywhere / In this folder scope, a Sort and view menu, endless scroll, + for Photos and videos (photos sent as
JPEG with their date) or the Files app (sent from disk part by part, so a long video never sits in memory whole),
and a sheet per file with the preview, Download (share sheet), rename, move and delete.

## 12. Later (not built)
A vector index (S3 Vectors or a `files` index on the knowledge collection) past ~20,000 files; frames across the whole
length of a long video (today the first 2 minutes); HEIC thumbnails; a PDF thumbnail image (the HUD shows the first
page in the browser's own viewer).
