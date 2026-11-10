---
name: release-notes
description: "Turn merged changes, tickets or a changelog into release notes customers understand: what's new, what changed, what to do."
---
# Release notes

- Read the merged pull requests, tickets or changelog for the release; leave out internal refactors, tests and dependency bumps unless a customer would notice.
- Group as New, Improved, Fixed and (if any) Action needed. Action needed goes first when it exists.
- One line per item, written from the customer's side: what they can now do, not what the code does. "You can now export invoices as CSV", not "Added CSV serializer".
- Name the screen or setting where it lives. Add a short how-to only for big features.
- Breaking changes: what breaks, who is affected, the date, and the exact step to stay working.
- No hype words, no internal names, no ticket numbers in the customer version; keep an internal version with links if the owner wants one.
