# Connectors, mail and skills: your checklist after the deploy

What to do once the connectors work is deployed (it adds connectors, mail and calendar, and skills). Every
step is something only you can do: a sign-in, an account at a provider, or a choice. Keys and passwords never go
in the chat; AI City always shows a secure field for them. Background: `docs/CONNECTORS_SKILLS.md`,
`docs/MAIL_CALENDAR.md`, `docs/RUNBOOK.md`.

## 0. Check the deploy (2 minutes)
- [ ] GitHub → **Actions → deploy**: the run is green.
- [ ] The run's summary shows **"Mail sign-in redirect URIs"**. It's empty `{}` until you turn on Google or
      Microsoft in step 2. That's expected.
- [ ] Open the HUD. There's a new **Skills** item in the menu, and **Settings → Connectors** shows "No connectors yet"
      and a "Mail & calendar" part.

## 1. Your first connector, by asking AIC (5 minutes)
Web search is a good first one. It needs a free Tavily account.
- [ ] Make an account at tavily.com and copy your API key (it starts with `tvly-`). Don't paste it in the chat.
- [ ] Say to AIC: **"add Tavily web search as an MCP"**. AIC finds it in the MCP Registry and puts a card under its
      reply: *"Add the Tavily MCP server at … Used by: …? "*. Read the address, then tap **Approve**.
- [ ] A card **"Add the key for Tavily"** appears. Paste the key into that field (it's hidden) and tap **Save securely**.
- [ ] Within a minute, Settings → Connectors shows Tavily as **"On · N tools"**.
- [ ] Ask AIC something that needs the web ("what's the weather in Stockholm today?"). It should answer using
      `tavily___…` tools.

If AIC can't find a server by name, give it the server's https link instead.

## 2. Mail and calendar from Google or Microsoft (20–30 minutes, once)
These need your own OAuth app at Google or Microsoft (free). IMAP accounts (iCloud, Fastmail, Yahoo…) need
none of this: skip to step 3.

**Google (Gmail and Google Calendar)**
- [ ] In Google Cloud Console, create a project, then enable the **Gmail API** and the **Google Calendar API**.
- [ ] Set up the OAuth consent screen (External). Then set the publishing status to **"In production"**. In
      "Testing", Google ends the sign-in every 7 days. It stays "unverified", which only means a warning screen
      when you sign in.
- [ ] Credentials → **Create OAuth client ID** → "Web application". Leave the redirect URIs empty for now. Copy the
      **client ID** and the **client secret**.

**Microsoft (Outlook and Microsoft 365, work or personal)**
- [ ] In the Entra admin center → App registrations → New: "Accounts in any organizational directory and personal
      Microsoft accounts". No redirect URI yet.
- [ ] Certificates & secrets → New client secret. Copy the **value** (it's shown once) and the **Application (client) ID**.
- [ ] API permissions → Microsoft Graph → Delegated: `openid`, `email`, `offline_access`, `User.Read`,
      `Mail.ReadWrite`, `Mail.Send`, `Calendars.ReadWrite`. A work tenant may need its admin to consent once.

**Hand them to AWS**
- [ ] AWS console → Secrets Manager (eu-north-1) → `aic/prod/oauth-google` → **Retrieve secret value → Edit** (or
      "Set secret value") → plain text `{"client_secret": "…"}` → Save. Do the same for `aic/prod/oauth-microsoft`.
      Terraform created both containers; it never writes a value.
- [ ] GitHub → Settings → Secrets and variables → Actions → **Variables** → `AIC_MAIL_PROVIDERS`, for example:
      `{"google":{"enabled":true,"client_id":"…apps.googleusercontent.com"},"microsoft":{"enabled":true,"client_id":"…","tenant_id":"common"}}`.
      Client IDs aren't secret. Leave out a provider you don't use, or set `"enabled": false`.
- [ ] Run the deploy (**Actions → deploy → Run workflow**).
- [ ] Copy each `callback_url` from the run's summary ("Mail sign-in redirect URIs") into the matching place:
      Google client → **Authorized redirect URIs**, and Entra app → **Authentication → Add a platform → Web → Redirect URIs**.
      The sign-in only works after this.

**Connect the accounts**
- [ ] Say to AIC: **"connect my work Outlook and my personal Gmail"**. Two cards appear: **"Sign in to Microsoft
      (Work)"** and **"Sign in to Google (Personal)"**.
- [ ] Tap each one, sign in on the provider's page (a new tab) and allow access. You come back to AI City and see
      **"Signed in. It's connected."** The card turns into "connected ✓".
- [ ] Settings → Connectors → Mail & calendar lists both accounts with their addresses. Untick any calendar AIC
      shouldn't see.
- [ ] Try it: "what's on my calendar tomorrow?", or "draft a reply to the last email from …". Sending, deleting and
      answering invitations always wait for you in **Needs you**, with the whole email or event shown.

## 3. A mailbox with an app password (IMAP: iCloud, Fastmail, Yahoo, …)
- [ ] Make an **app password** at your provider (not your normal password).
- [ ] Say to AIC: **"connect my Fastmail"** (or the provider's name). A card **"Add the app password for …"** appears.
- [ ] Pick your provider in the card (it fills in the servers), type your address and the app password, then tap
      **Connect securely**. If the server refuses it, the card says so and nothing is stored.

## 4. GitHub, Slack and other services that need a sign-in
- [ ] Ask AIC: **"add GitHub as an MCP"** (or Slack, Notion, Linear, Higgsfield…), then approve the card.
- [ ] If the service supports automatic app registration, you get **"Sign in to …"** right away. Tap it and approve.
- [ ] If it doesn't (GitHub usually doesn't), the card asks for a **client id and client secret**, and shows a
      **callback URL**. Create an OAuth app at the service (GitHub: Settings → Developer settings → OAuth Apps → New)
      with that callback URL, paste the id and secret into the card, then tap **Sign in to …**.
- [ ] Choose who may use it in Settings → Connectors (each agent role: No / Read only / Everything). The default
      approval setting asks you before anything destructive.

## 5. A server that runs as a package (npm or PyPI)
- [ ] Ask AIC to add one by name, or exactly, for example **"add npm:@scope/server@1.2.3"**. The card names the
      package, the exact version, the publisher and the source link. Approve it only if you trust that publisher:
      it's someone else's code, run in its own isolated sandbox with only its own key.
- [ ] If it needs keys, a card asks for each one by name.

## 6. A service without an MCP server (OpenAPI)
- [ ] Ask AIC: **"connect the Acme API, here's its OpenAPI link: https://…/openapi.json"**. The card says how many
      actions it has and how many are read-only or delete. Then add a key or sign in, as the card asks.

## 7. Your first skill
- [ ] Open **Skills → Add skill**. Pick a folder with a `SKILL.md` (or just the file), choose who may use it, and save.
      If the card lists removed settings (such as `allowed-tools`), that's expected: only the city's policy decides
      what agents may do.

## 8. What only this real run can confirm (tell the build session if one fails)
| Check | How you'll notice |
|---|---|
| Sign-in return through AgentCore Identity | After signing in you see "Signed in. It's connected." Instead "The sign-in didn't finish…" means it failed: note the message. |
| AWS-side access rules (Cedar) | A connector shows "On", but AIC says a tool was "not allowed": the policy didn't match the roles. |
| Tools appearing at the Gateway | "On · 0 tools", or tools missing that the service has. |
| Package servers starting | A package connector stuck on "Setting up…", or an error naming the install. |
| Real mail and calendar calls | Searches or calendar reads show "Couldn't reach <label>: …" for one account. |
| Costs | Cost Explorer after a few days: Secrets Manager is about $0.40 per key-based connector or IMAP account each month. Gateway, Policy, Lambda and the MCP host are billed per use. Tavily is free up to 1,000 searches a month. |

Logs, if something is stuck: CloudWatch `/aws/lambda/aic-prod-connectors`, `/aws/lambda/aic-prod-connector-bridge`,
`/aws/lambda/aic-prod-api`, and `/aws/bedrock-agentcore/runtimes/aic_prod_mcp_host-*`. A connector stuck in an
error: **Settings → Connectors → Refresh tools**. If it stays, remove it and ask AIC again.
