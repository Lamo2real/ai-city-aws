# The AI City guide

How to use every part of AI City: where things are, what each button does, and how to get things done. VAIC answers
"how do I…" questions from this guide at once, and it is also in the Knowledge base as "AI City guide (built in)".
Links like `#/settings/connectors` open that page in the app.

## The idea in one minute
- You talk to **VAIC** (said "Vice", short for Vice Artificial Intelligence City). VAIC answers simple things itself and starts real work on the **project board**.
- A small job goes straight to one worker; a bigger one gets a **planner** that gives each part to a **department** (Application, IT Infrastructure, Data & AI,
  Marketing, Sales, Customer Support, Finance, Legal, Product, Operations, Research, Media, plus any you build).
- Each department's **manager** hires **workers** for the job, reviews every result and reports back up. Workers go
  home when they're done.
- **Executives** (CEO, COO, CFO, CTO) give advice when asked; they never run work.
- **Nothing starts on its own.** Work begins only when you tell VAIC. That holds for a whole project and for one small
  task. "Run my business" and standing orders are switches you turn on yourself.

## Getting around (the top bar)
- **VAIC** `#/vaic`: talk to VAIC by typing or by voice.
- **City** `#/city`: the city map. Watch your agents work, see each department's tower, and open Features.
- **Work** `#/tickets`: every job. The tabs are Working now, Finished, Decided for you, Tickets (customer support)
  and Sales pipeline.
- **Projects** `#/apps`: the apps and games the city builds. Open one to preview it on a phone, a laptop or any size.
- **Knowledge** `#/knowledge`: your documents. Everything the agents may read and quote.
- **Files** `#/files`: your storage for anything (photos, videos, PDFs, documents, any type). The departments read
  and save here too; what they save is marked with the department.
- **Skills**: what your agents know how to do (built-in skills and your own).
- **Costs**: what the city spent today and this month (estimates; the AWS bill is the truth).
- **Settings** `#/settings`: a menu of pages (listed below).

## Talking to VAIC (the VAIC screen)
- **Type** in the message box and press send (the paper-plane button) or Enter.
- **Voice conversation**: tap the **voice button** (the gold button with sound bars). VAIC listens all the time and
  answers aloud. Talk over VAIC and it stops and listens. Say "stop listening" or tap the button again to end. The
  light above the message box shows who is talking: blue is you, amber is VAIC.
- **Dictation**: tap the **microphone-with-lines button** to speak words into the message box without sending. Tap
  ✓ to keep them, or × to cancel.
- Fillers like "um" and stammers are removed from what you say, unless you put words in quotes.
- **The + button** (left of the box): add files or photos, add folders, slash commands, connectors, plugins.
- **Slash commands**: type `/` in the box to see them (your skills and shortcuts).
- **The clock icon** (top left of the chat): "While you were away", a summary of what happened.
- **The trash icon** (top right of the chat): clears the conversation on this device.
- **"What I did"** under a reply shows the steps VAIC took.
- **Ask VAIC to do it for you.** Anything you can set or change on any screen, VAIC can do when you ask: "switch to
  dark mode", "turn the CFO off", "set a $20 daily limit", "delete that document", "add a standing order…", "open my
  connectors", "add a skill called release notes", "set new workers per second to 2". VAIC prepares the change, shows
  what will change in the chat and asks "Do you want to save these changes?" with **Yes** and **No** buttons (a skill
  shows its card with **Add**); nothing is saved until you tap Yes, type it or say it, and No leaves everything as it
  was. When several skills fit, VAIC shows them as choices to tap. The only exception is a password, key or token:
  VAIC opens the page and you paste it there yourself, because secrets never go through the chat.

## The City
- The map shows HQ (VAIC and the planner), one tower per department, and the houses where workers live. Workers
  ride taxis to work and home. The mailman cycles letters between HQ and the departments.
- The top card shows **Agents working now** (workers on a job right now), **Jobs running**, and the time. The
  **(i)** button checks whether everything is running normally.
- **City | Features** switches between the map and your own features (for example Calendar).
- The dock at the bottom: chat with VAIC, Work, the **mic** (talk to VAIC from the map), sound on/off, and costs.
- The right panel lists Departments and Records (Workforce, Costs, Health, On hold). Tap a department to see its
  people and work.

## Settings pages
- **Company** `#/settings/company`: what your business is. "Run my business" turns on the rounds that keep it going
  (Customer Support handles tickets, Marketing and Sales work the pipeline). Off until you say so.
- **Executives** `#/settings/executives`: the CEO, COO, CFO and CTO. Turn each on or off, read their
  recommendations, and switch on optional reviews (off by default).
- **While I'm away** `#/settings/away`: Autopilot (the Chief of Staff decides questions for you), standing orders,
  and anything still open.
- **General**: appearance (light or dark), notifications, region, the setup guide again, sign out.
- **Departments & tools** `#/settings/departments`: build a new department or demolish one, and choose the tools
  each department may use.
- **Connectors** `#/settings/connectors`: every connected service grouped by department, with search, browsing and
  **+ Add**. Mail and calendars are here too.
- **GitHub** (`#/settings/github` opens it): on the GitHub card in Connectors, your one GitHub token, so the city can use your repositories.
- **VAIC's voice** `#/settings/voice`: the voice VAIC speaks with, and the optional OpenAI key.
- **Apps**: the apps the city built (pin, remove, what they may read).
- **Limits & spending**: optional spend caps and how many workers may work at once.
- **Start over**: empties the city and starts fresh (it asks first).

## How do I…
- **…start a project or a task?** Tell VAIC what you want, for example "build a booking app for my salon" or "find 20
  leads for my agency". VAIC asks what it needs, then the team starts it. Follow it in Work or the City.
- **…choose how many agents work on it?** Say it: "use 5 workers". That number is respected exactly.
- **…add a connector (Slack, Jira, HubSpot, Canva, YouTube…)?** The easiest way: tell VAIC what you want to do ("find
  a person on LinkedIn"). VAIC offers the right service and walks you through signing in. Or go to Settings →
  Connectors `#/settings/connectors`, press **+ Add** or browse, and pick the service. Sign in when asked; keys go
  straight to AWS and are never shown again.
- **…connect my email and calendar?** Settings → Connectors → Mail & calendar → "Add a mailbox or calendar", or tell
  VAIC "connect my work Outlook". Meetings then show in City → Features → Calendar.
- **…add knowledge (documents, laws, manuals)?** Open Knowledge `#/knowledge` and drop the files (many at once),
  paste text, or add a link. Each item is sorted by country, year and topic automatically; you can correct them.
  Agents then use the right country's rules (EU rules like GDPR for EU markets, US rules for the US).
- **…store photos, videos and other files?** Open Files `#/files` and drop them in (or press **+ Upload**; on the
  iPhone, pick photos or files). Large videos upload straight from your device. Each file gets a description by
  itself (what a photo shows, what a document or recording says), so you can later ask VAIC "find the sunrise photo
  with the Porsche from last spring" and it shows the file in the chat with a **Download** button. Rename, move to a
  folder, tag, delete or download from the Files screen, or ask VAIC to.
- **…tell Files and Knowledge apart?** Knowledge is what the agents read as reference (laws, manuals, notes).
  Files is your storage: things you keep, find and download, and what the departments make.
- **…let the business run without me?** Settings → Company: describe the business and turn on "run my business".
  Settings → While I'm away: turn on Autopilot. Turn either off any time.
- **…get advice from the executives?** Ask VAIC: "what does the CFO think about this?" or "ask the CTO to review
  the architecture". They come to HQ, advise, and go home.
- **…build or remove a department?** Ask VAIC ("make a Customer Success department") or use Settings → Departments
  & tools. Its workers run on Sonnet 5.5 and its reviewer on Opus 5.5, like every department.
- **…see what something costs, or cap spending?** Costs shows today and this month. Settings → Limits & spending
  sets optional caps.
- **…build an app and see it?** Ask VAIC ("make me a game where…"). It is built while you're away and asks your
  taste along the way without waiting. Open it in Projects to preview it on a phone or a laptop.
- **…run ads?** Say "let's create Meta ads" or "Google Ads". VAIC recognises the workflow, asks only what's missing
  (like the daily budget) and either walks you through it or has Marketing do it. Money is never spent without your
  stated budget.
- **…get the iPhone app?** See `docs/IOS_TESTFLIGHT.md` (TestFlight). The website also works on the phone.
- **…stop the voice or VAIC talking?** Tap the voice button, say "stop listening", or just start talking.
- **…sign out?** Settings → General → Sign out.

## A tour for a new person (VAIC walks you through, one step at a time)
When someone asks for a tour, is new, or seems lost, VAIC offers this, one step per message, waiting for "next":
1. The VAIC screen: "This is where you talk to me. Type, or tap the gold voice button and just talk."
2. The City `#/city`: "This is your organisation at work. Each tower is a department; tap one to see its people."
3. Work `#/tickets`: "Every job, live and finished, and what was decided for you."
4. Knowledge `#/knowledge`: "Drop your documents here and every agent can use them."
5. Connectors `#/settings/connectors`: "Connect the tools your business uses: email, calendar, Slack, CRM."
6. Company `#/settings/company`: "Tell AI City what your business is; it can run it while you're away."
7. "To start, just tell me what you want done."
