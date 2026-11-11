---
id: marketing.compliance.sweden-cookies-and-meta-pixel
department: marketing
domain: compliance
title: 'Sweden: cookies need prior active consent, and the Meta Pixel has already produced fines'
summary: Swedish regulators require prior, active consent with rejecting as easy as accepting and check that cookies do not fire after rejection; IMY fined Apoteket SEK 37 million over the Meta Pixel, so load pixels only after consent and audit what they send.
type: policy
audience: both
confidence: established
volatility: evergreen
as_of: '2026-11-11'
review_by: '2028-11-11'
platforms:
- meta
- ga4
objectives: []
sources:
- https://www.pts.se/internet-och-telefoni/kakor-cookies/
- https://cookieinformation.com/blog/blog-swedish-dpa-imy-dark-patterns-april-2025/
- https://www.consentmo.com/blog-posts/sweden-warns-major-companies-over-cookie-banner-failures-avoid-these-common-gdpr-mistakes
- https://www.imy.se/en/news/
- https://www.imy.se/globalassets/dokument/beslut/2024/beslut-tillsyn-avanza.pdf
- https://www.imy.se/nyheter/ny-rapport-imy-vagleder-om-platsbaserad-direktkommunikation-till-mobiltelefoner/
related:
- marketing.compliance.eu-cookie-consent-and-pending-reforms
- marketing.meta-ads.sensitive-data-sources
- marketing.meta-ads.capi-emq-and-conversion-lift
seed_version: 1
---

**When to use this:** When setting up cookie banners, analytics or ad pixels for a Swedish site.

## Sweden: cookies need prior active consent, and regulators check banners technically

**[DURABLE, Sweden; PTS page read on primary]** The Swedish Post and Telecom Authority (PTS), which supervises the cookie rule in the Electronic Communications Act (2022:482), states that a site must ask for consent before using cookies and that consent must be voluntary, specific, informed and actively given. Only necessary cookies are exempt, and statistics cookies that a site owner merely considers necessary do not qualify. **It must be as easy to say no as yes.** Pre-ticked choices, continued browsing, cookie walls and an "I understand" notice are not consent, and withdrawal must be available at any time ([PTS](https://www.pts.se/internet-och-telefoni/kakor-cookies/)). **[DURABLE, Sweden; secondary]** The Swedish Authority for Privacy Protection (IMY) polices the GDPR side. In April 2025 it criticised cookie banners at ATG (accept highlighted, reject hidden behind a second step), Aller Media (pre-ticked non-essential categories, multi-step reject, legitimate interest claimed without explanation) and Warner Music (no clear purposes, recipients or storage period, and a false statement that declining impairs the site). No fines were issued. IMY's reported position is that accept and reject must take equal effort and have equal prominence, that the banner must state purposes, recipients and retention, that a consent-platform vendor's default template does not relieve the site owner of responsibility, and that it verifies whether cookies fire after rejection ([Cookie Information, 2 May 2025](https://cookieinformation.com/blog/blog-swedish-dpa-imy-dark-patterns-april-2025/); [Consentmo](https://www.consentmo.com/blog-posts/sweden-warns-major-companies-over-cookie-banner-failures-avoid-these-common-gdpr-mistakes)). **[INFERENCE]** The Swedish banner standard in practice is "reject all" on the first layer with equal prominence, nothing pre-ticked, purposes, recipients and retention stated, and no analytics before consent.

## Sweden: the Meta Pixel has already produced fines

**[DURABLE, Sweden; IMY news read on primary]** On 3 July 2025 IMY fined Apoteket **SEK 37 million** and Apohem SEK 8 million for using the Meta Pixel in a way that transferred sensitive personal data to Meta; earlier Meta Pixel decisions exist for Avanza, Länsförsäkringar, Apotea and Kry. No new IMY cookie or pixel decision was found for 2026, and IMY's stated 2026 priorities are AI in the public sector, children and young people, and crime prevention. On 10 November 2026 IMY published guidance on location-based direct communication to mobile phones ([IMY](https://www.imy.se/en/news/); [IMY decision, Avanza](https://www.imy.se/globalassets/dokument/beslut/2024/beslut-tillsyn-avanza.pdf); [IMY](https://www.imy.se/nyheter/ny-rapport-imy-vagleder-om-platsbaserad-direktkommunikation-till-mobiltelefoner/)). **[INFERENCE]** The pixel cases turned on what data the pixel sent (including advanced matching and automatic events) combined with a sensitive context such as pharmacy, health or finance. For any Swedish advertiser the lesson is to load the pixel only after consent, audit which parameters and form fields it captures, and disable automatic advanced matching unless deliberately configured; for health and finance this aligns with Meta's own data-source restrictions in section 4.
