---
id: research.data-sources.public-data-sources
department: research
domain: data-sources
title: 'Research: Public data sources'
summary: 'Public data sources: free official registers first. Sweden; EU and international; Source summary table.'
type: benchmark
audience: both
confidence: established
volatility: fast-moving
as_of: '2026-11-11'
review_by: '2027-02-11'
platforms:
- official-registers
objectives:
- evidence
sources:
- https://bolagsverket.se/apierochoppnadata/hamtaforetagsinformation/vardefulladatamangder.5294.html
- https://bolagsverket.se/apierochoppnadata.2531.html
- https://www.scb.se/en/services/open-data-api/pxwebapi/
- https://www.vinnova.se/om-oss/om-webbplatsen/oppna-data/
- https://ec.europa.eu/eurostat/api/dissemination`
- https://ec.europa.eu/eurostat/api/comext/dissemination`
- https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-introduction
- https://ec.europa.eu/eurostat/help/copyright-notice
- https://www.oecd.org/en/about/terms-conditions.html
- https://www.oecd.org/en/data/insights/data-explainers/2024/09/api.html
- https://api.worldbank.org/v2/`
- https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation
- https://www.epo.org/en/searching-for-patents/technical/espacenet
- https://www.wipo.int/web/patent-analytics
related:
- research.market.market-analysis-and-forecasting
- research.compliance.copyright-and-text-and-data-mining
seed_version: 1
---

**When to use this:** When you need official data: Swedish, EU and international registers and statistics, their access limits, licences and reuse terms.

**Source section:** 3. Public data sources: free official registers first

## 3. Public data sources: free official registers first

### 3.1 Sweden

[FAST-MOVING, 3 Feb 2025] Build Swedish company universes from the free official register data. Bolagsverket and SCB "värdefulla datamängder" (EU high-value datasets) have been free and available without an agreement, by REST API or bulk file, since 3 February 2025; the EU implementing regulation entered into force on 9 February 2023 and Sweden had a two-year derogation ([Bolagsverket, Värdefulla datamängder](https://bolagsverket.se/apierochoppnadata/hamtaforetagsinformation/vardefulladatamangder.5294.html)). Checked on the authority's own page.

[FAST-MOVING, 3 Feb 2025] The free Bolagsverket and SCB fields are organisation name and form, legal form (SCB), identity number, postal address, registration date, deregistration and its cause, ongoing liquidation or restructuring proceedings, business description, SNI industry codes (SCB), active status for F-tax, VAT and employer registration (SCB), advertising block (SCB), and all digitally filed annual reports ([Bolagsverket, Värdefulla datamängder](https://bolagsverket.se/apierochoppnadata/hamtaforetagsinformation/vardefulladatamangder.5294.html)).

[FAST-MOVING, 3 Feb 2025] Re-use of the free Bolagsverket and SCB data is allowed for commercial and non-commercial purposes, including modification and combination with other sources, subject to personal-data and secrecy law and any licence terms such as source attribution; more detailed company data remain behind Bolagsverket's paid APIs ([Bolagsverket, Värdefulla datamängder](https://bolagsverket.se/apierochoppnadata/hamtaforetagsinformation/vardefulladatamangder.5294.html)). Bolagsverket's open-data overview, updated 2 July 2026, says some open data is free and some requires an agreement ([Bolagsverket, API:er och öppna data](https://bolagsverket.se/apierochoppnadata.2531.html)).

[FAST-MOVING, October 2025] Pull Swedish official statistics through SCB's PxWebApi v2, released for the Statistical Database in October 2025 and due to replace v1. Limits are 150,000 data cells per extraction and 30 calls per 10 seconds per IP address, a limit shared by everyone behind the same office IP ([SCB, PxWebApi](https://www.scb.se/en/services/open-data-api/pxwebapi/)). Agents running in parallel from one address must share that budget.

[FAST-MOVING, 10 Nov 2026] Use Vinnova's open data for Swedish technology scouting and funding signals. The data cover funding calls and funded R&D projects, the licence is CC0 and the data are free to use (page updated 10 November 2026, [Vinnova, Öppna data](https://www.vinnova.se/om-oss/om-webbplatsen/oppna-data/)).

[FAST-MOVING, 10 Nov 2026] Vinnova recommends the shared GDP API (Gemensamma data-projektet), which has three endpoints for calls, applications and financed activities, with applications and financed activities from decision dates of 1 January 2010 onward. It needs an account and API key through gdphub.se, most data are also available as CSV without an account, and documentation sits at github.com/Gemensamma-data-projektet-GDP/Dokumentation ([Vinnova, Öppna data](https://www.vinnova.se/om-oss/om-webbplatsen/oppna-data/)).

[FAST-MOVING, 10 Nov 2026] Older Vinnova endpoints on data.vinnova.se are `/api/program/`, `/api/utlysningar/`, `/api/ansokningsomgangar/` and `/api/projekt/`; adding a diarienummer returns one record and adding a date returns records changed since then, and bulk sets sit on vinnova.entryscape.net. The GDP data name only the project leader and lack employer, ORCID, English organisation names and application keywords ([Vinnova, Öppna data](https://www.vinnova.se/om-oss/om-webbplatsen/oppna-data/)).

[INFERENCE] The Vinnova project leader's name is personal data even though the dataset is CC0, so GDPR still applies when an agent profiles individuals from it. Use the data at organisation and project level by default.

[INFERENCE] For a Swedish SaaS company the free Bolagsverket data are enough to build a competitor or customer universe by SNI code and to read digitally filed annual reports for revenue and headcount. Commercial register sites of the allabolag type repackage the same registers with convenience features; their terms and coverage were not checked.

[GAP] Not verified: the SCB data licence (commonly described as CC0) and API base URL; PRV's Swedish patent and trademark databases; dataportal.se; allabolag-type commercial registers; and the Vinnova API response format and update frequency.

### 3.2 EU and international

[DURABLE] Pull EU statistics through Eurostat's free APIs: a Statistics API returning JSON-stat 2.0, SDMX 2.1 and SDMX 3.0 APIs (SDMX-ML, SDMX-CSV, JSON-stat, TSV), a Catalogue API and an asynchronous API for large queries. The base is `https://ec.europa.eu/eurostat/api/dissemination`, and Comext and PRODCOM "DS-" datasets use `https://ec.europa.eu/eurostat/api/comext/dissemination` ([Eurostat, API introduction](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-introduction)).

[DURABLE] Snapshot every Eurostat extract. Eurostat datasets update twice daily, at 11:00 and 23:00 CET, and only the latest version is kept, so a figure pulled today can differ from the one pulled last quarter with no history to consult ([Eurostat, API introduction](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-introduction)).

[DURABLE] Eurostat data can be reused commercially with attribution. Reuse of statistical data, metadata and publications is authorised, including commercially, if the source is acknowledged and changes are indicated; editorial content is CC BY 4.0; the basis is the Commission Decision of 12 December 2011 ([Eurostat copyright notice](https://ec.europa.eu/eurostat/help/copyright-notice)). Checked on Eurostat's own page.

[DURABLE] Check Eurostat's exceptions per dataset before commercial reuse. Not covered are data marked as from sources other than Eurostat, publications partly owned by other organisations, data for countries outside the EU, EFTA and official candidate countries, trade data declared by Liechtenstein and Switzerland from 1995 in the listed classifications, and Austrian trade data at CN 8-digit level; third-party material and logos are excluded ([Eurostat copyright notice](https://ec.europa.eu/eurostat/help/copyright-notice)).

[FAST-MOVING, 1 July 2024] OECD content published from 1 July 2024 is mostly CC BY 4.0 and should be cited as OECD (year), title, URL; third-party-owned data can carry extra restrictions to be checked in the metadata or source tab ([OECD Terms and Conditions](https://www.oecd.org/en/about/terms-conditions.html)). The OECD publishes an explainer on programmatic retrieval from its Data Explorer ([OECD, API explainer](https://www.oecd.org/en/data/insights/data-explainers/2024/09/api.html)); endpoint details were not captured.

[DURABLE] OECD APIs are provided as-is with no stated numeric rate limit; the OECD may limit or suspend an IP address without notice if usage strains the service, and users must not interfere with usage monitoring ([OECD Terms and Conditions](https://www.oecd.org/en/about/terms-conditions.html)).

[DURABLE] The World Bank Indicators API offers nearly 16,000 time-series indicators, many going back more than 50 years, at base `https://api.worldbank.org/v2/` with no API key; version 1 is retired ([World Bank Data Help Desk](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation)).

[DURABLE] Use Espacenet for free patent research: worldwide coverage from 1782 to today, DOCDB simple families, INPADOC extended families and INPADOC legal-event data, with CPC classification guidance ([EPO, Espacenet](https://www.epo.org/en/searching-for-patents/technical/espacenet)). WIPO provides Guidelines for Preparing Patent Landscape Reports, a Patent Analytics Handbook, a Manual on Open Source Patent Analytics and the PATENTSCOPE database ([WIPO, Patent analytics](https://www.wipo.int/web/patent-analytics)).

[INFERENCE] Store an attribution line with each extract: "Source: Eurostat, [dataset code], extracted [date], changes: [none or description]" and "OECD (year), Title, URL". This turns the licence conditions into a field the repository can check.

[GAP] Not verified: EUIPO TMview and DesignView, data.europa.eu, EU CORDIS, OECD API endpoints, and the European Single Access Point timeline. No Nordic statistical office or register outside Sweden (Denmark, Norway, Finland, Iceland) was researched, so the notes support no specific statement about Nordic data sources beyond Sweden and Eurostat's EU and EFTA coverage.

### 3.3 Source summary table

[DURABLE] [FAST-MOVING, dates in rows] The table summarises the verified public data sources, with the date of the source page and its link in each row.

| Label | Source | What it gives | Access and limits | Reuse | Date of source | Link |
|---|---|---|---|---|---|---|
| [FAST-MOVING] | Bolagsverket and SCB high-value datasets | Company identity, legal form, SNI codes, status, filed annual reports | REST API or bulk file, no agreement | Commercial reuse allowed, subject to personal-data and secrecy law and licence terms | Free since 3 Feb 2025 | [Bolagsverket](https://bolagsverket.se/apierochoppnadata/hamtaforetagsinformation/vardefulladatamangder.5294.html) |
| [FAST-MOVING] | SCB PxWebApi v2 | Swedish official statistics | 150,000 cells per extraction; 30 calls per 10 seconds per IP | Licence not verified | Released Oct 2025 | [SCB](https://www.scb.se/en/services/open-data-api/pxwebapi/) |
| [FAST-MOVING] | Vinnova open data | Funding calls and funded R&D projects | GDP API with key via gdphub.se; CSV without account | CC0 | Page updated 10 Nov 2026 | [Vinnova](https://www.vinnova.se/om-oss/om-webbplatsen/oppna-data/) |
| [DURABLE] | Eurostat | EU statistics, Comext and PRODCOM | JSON-stat and SDMX APIs; updates 11:00 and 23:00 CET; no version history | Commercial reuse with attribution; listed exceptions | Not dated on page | [Eurostat API](https://ec.europa.eu/eurostat/web/user-guides/data-browser/api-data-access/api-introduction); [copyright notice](https://ec.europa.eu/eurostat/help/copyright-notice) |
| [FAST-MOVING] | OECD | International statistics | API as-is; no numeric limit stated; IP may be suspended | Mostly CC BY 4.0 for content from 1 Jul 2024 | Terms as read 11 Nov 2026 | [OECD terms](https://www.oecd.org/en/about/terms-conditions.html) |
| [DURABLE] | World Bank Indicators API | Nearly 16,000 indicators | No key; base api.worldbank.org/v2 | Not captured | Not dated on page | [World Bank](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation) |
| [DURABLE] | Espacenet (EPO) | Patents from 1782, families, legal events | Free | Not captured | Not dated on page | [EPO](https://www.epo.org/en/searching-for-patents/technical/espacenet) |
