# Setting up AI City: step by step

The same guide is in the app: **Settings → Departments & tools → Setup guide**, with live counts of what is connected. Decisions 113 and 114 explain the design.

## 1. Teach the city your business (10 minutes)
Open **Knowledge** and add what every department must follow: your brand guide and logo, tone of voice, prices and products, policies (refunds and returns, privacy, terms), product documentation, templates (proposals, contracts, emails) and anything else that is yours. Choose **Always include** for the brand guide and the most important policies. Every department searches Knowledge before it writes, designs or decides.

## 2. Connect the shared tools
Every department uses these. Essential: Stripe, Jira & Confluence, Slack, Notion. More: Zapier, Box, Dropbox, Calendly, Miro, Granola.

**Stripe is one account for everything you sell**, however many products, apps or sites: each thing sold becomes a Stripe product tagged with the app it belongs to, sold through a payment link or a checkout the IT department builds. Never a second account.

For each tool: no account yet? Tap **Create an account**, sign up on the service's own site, then come back. Switch the tool on and tap **Sign in to …**; approve on the service's page. Some services ask for a key or (Salesforce, Google) an OAuth client id and secret instead: the card says which and where to find it.

## 3. Connect each department's essential tools

- **Application**: essential GitHub, Context7, Sentry, Vercel; more Supabase, Figma, Linear, Shopify Dev Docs, Microsoft Learn.
- **IT Infrastructure**: essential AWS Knowledge, GitHub, Datadog, PagerDuty; more Grafana Cloud, Sentry, Cloudflare Docs, Microsoft Learn, Context7, Vanta.
- **Data & AI**: essential Google Analytics, BigQuery, PostHog; more Amplitude, Mixpanel, Hex, Airtable, Supabase, Hugging Face, Context7.
- **Marketing**: essential Canva, Meta Ads, Google Ads, Google Analytics; more Higgsfield, HeyGen, ElevenLabs, Klaviyo, HubSpot, Semrush, Ahrefs, Buffer, Webflow, Wix, Typeform, Figma.
- **Sales**: essential Salesforce, HubSpot, Apollo.io, PandaDoc; more Pipedrive, Attio, Close, Gong, Docusign, Fireflies.
- **Customer Support**: essential Intercom, Gorgias, Help Scout; more Shopify (store), Typeform, SurveyMonkey, HubSpot.
- **Finance**: essential Xero, PayPal, Ramp; more Square, Plaid, Shopify (store), Airtable.
- **Legal**: essential Docusign, PandaDoc, Vanta; more .
- **Product**: essential Linear, Figma, PostHog; more Amplitude, Mixpanel, Typeform, SurveyMonkey, Fireflies.
- **Operations**: essential Asana, monday.com, Airtable; more ClickUp, Shopify (store), Typeform.
- **Research**: essential Hugging Face, Exa, Consensus; more OpenAlex, Parallel, Tavily, Jina AI, Firecrawl, Crunchbase, Product Hunt.
- **Media**: essential Metricool, Higgsfield, ElevenLabs, Canva; more Opus Clip, Captions, Runway, HeyGen, Synthesia, Pika, Ideogram, Buffer, Ayrshare, Blotato, vidIQ, TubeBuddy, Artlist, Envato, Unsplash, Frame.io, Vimeo, Mux, Cloudinary.

Special cases:
- **Salesforce** needs an External Client App in your org (Setup → External Client App Manager → New, OAuth with the `mcp_api` scope and the callback URL the card shows); paste its consumer key and secret in the card.
- **Google Analytics** and **BigQuery** need a Google OAuth client (Google Cloud console → APIs & Services → Credentials → OAuth client ID, type Web application, the callback URL the card shows).
- **Shopify (store)** asks for your store's name (the part before `.myshopify.com`).
- **Meta Ads** and **Google Ads** go through Pipeboard: sign in with your Meta or Google account on Pipeboard's page.
- **Pipedrive**, **Gorgias** and **Ayrshare** ask for an API key from their settings.
- **YouTube, TikTok, Instagram and Facebook**: switch on **Metricool** (Media), sign in, then connect each social account inside Metricool with the platform's own sign-in. The city never needs your social passwords.

## 4. Give IT your GitHub
Make a classic GitHub token with every scope and paste it in **Settings → GitHub** (see `docs/GITHUB_ACCESS.md`). The city can then create repositories, push code, open pull requests and set repository secrets and variables.

## 5. Optional: VAIC's voice
Paste an OpenAI key in **Settings → VAIC's voice** (see `docs/VOICE.md`).

## 6. Ask VAIC for work
"Make a launch campaign for my new product", "build a landing page that sells it with Stripe", "reply to today's support tickets", "prepare this month's VAT figures". The Orchestrator sends it to the right department.

## What the city never does on its own
It never moves money, never adds funds or payment methods, never signs contracts and never publishes or sends anything without your yes. Ads are created paused and budgets are asked. Refunds, payouts and launches wait for your approval in Needs you or in the chat.
