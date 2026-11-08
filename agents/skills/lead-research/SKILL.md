---
name: lead-research
description: "Find N sales leads fast: the person, their role and public work email, the company, its size, recent news and who it is hiring (engineers listed apart), with the hiring owner per role and a source for every field. Returns a table and a CSV."
---
# Lead research

The owner asks for a number of leads ("get me 2 leads for X"). Return exactly that many, with exactly the fields asked for, then stop. Fast beats exhaustive: no long write-up.

## 1. Read the brief
- Who: industry, region, company size, role or seniority, any trigger ("hiring engineers", "just raised"). Missing details: take the sensible default (Sweden first if the owner's knowledge base says so, else wherever the brief points) and say which default you used.
- How many: the number asked for; 5 if none was given.
- Which fields: the default set below unless the owner named fields. If the owner asked for one piece of information, return that piece only.

Default fields per lead: first name, last name, role, company, company website, company size (employee range), public work email, recent news (last 6 months), open roles, engineering roles, hiring owner(s).

## 2. Find companies, then people
Use what is switched on, cheapest first:
1. **Apollo.io** or **Crunchbase** connector for companies and contacts that match; **HubSpot** (or the CRM that is on) first, so leads the owner already has are skipped.
2. **Tavily** or **Firecrawl** for web search and reading pages; without them, your own web search and fetch.
3. Public sources: the company's own site (team, about, press, contact pages), public LinkedIn company and profile pages as they appear in search results, news sites, the Swedish company registers (Bolagsverket, Allabolag.se) for size and revenue.

Pick the person the brief names (a role) or the one who would buy: founder or CEO for small companies, the head of the relevant function for larger ones.

## 3. Hiring: where jobs are posted
For each company look in all of these until you have a clear answer:
- The company's careers page, including **Teamtailor** (`<company>.teamtailor.com`, `career.<domain>`) and **Jobylon** pages.
- **Arbetsförmedlingen Platsbanken** through its open JobTech API: `https://jobsearch.api.jobtechdev.se/search?q=<company>` (JSON, no login).
- **LinkedIn Jobs** public job pages and **Indeed** listings, as reached from search results.

Report: hiring yes or no; every open role with its link and posting date; an **engineering roles** list (software, data, AI/ML, DevOps, IT, hardware); and per role the **likely hiring owner** (the recruiter named in the ad, else HR or Talent lead, the CTO, IT manager or Head of AI/Data, whoever fits) with the evidence ("named as contact in the Teamtailor ad", "Head of Engineering on the team page").

## 4. Email, only when it is public or verifiable
- Use it if the person's address is published (company site, press release, a public profile, a public filing), or a **Hunter** or **Apollo** lookup returns it as verified.
- Give how it was found and a confidence: `published`, `verified` (a verifier said deliverable) or `pattern` (the company's known pattern, checked with a verifier). Never present an unverified guess as an email: write `not found publicly`.

## 5. Keep going until every field is filled
Try the next source when one comes up empty. A field you still cannot fill is `not found publicly`, with what you tried in the notes ("careers page, Platsbanken, LinkedIn Jobs: no open roles"). Never invent a value.

## The line (the owner's: "as long as it's legal")
- Public pages and official APIs only. Never log in as someone else, never get round a login, paywall, rate limit or CAPTCHA, never use leaked or breached data. Respect robots.txt and site terms.
- No logged-in LinkedIn scraping (its terms forbid it and it gets the owner's account banned): public pages from search results, or the owner's own LinkedIn connector when one is on.
- Business contact details only: the person's name, role, employer and work email. Not home addresses, birth dates, private phone numbers or personal ID numbers, even where Swedish lookup sites (Ratsit, Merinfo, Hitta, Eniro) publish them: a sales lead is about the person's job, not their private life.
- Fill only the fields the owner asked for. A source link for every field.

## 6. Deliver
In `report_to_manager`, put in the summary:
1. One Markdown table, one row per lead: Name, Role, Company, Size, Email (confidence), Hiring (engineering roles), Hiring owner, News.
2. Right after it, the same leads as one fenced block marked `csv` (header row first; columns `first_name,last_name,role,company,website,company_size,size_source,email,email_source,email_confidence,news,open_roles,engineering_roles,hiring_owner,hiring_owner_evidence,sources`; separate list items with ` | `; quote any value containing a comma). The city saves that block to the owner's knowledge base as a CSV file:
   ````
   ```csv
   first_name,last_name,role,company,...
   Ada,Berg,CTO,Kassa AB,...
   ```
   ````
3. One line on defaults you took and fields not found.

Don't add leads to the CRM or draft outreach unless the owner asked; offer it as the next step.
