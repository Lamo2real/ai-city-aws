---
name: invoicing-and-payments
description: "Send invoices, collect payments and chase overdue ones, using the owner's one Stripe account or the accounting system; money moves only on the owner's yes."
---
# Invoicing and payments

- Invoice from **Stripe** (`sell-with-stripe`) or **Xero** with the owner's details, the customer's legal details, VAT number when B2B, line items, VAT, due date and payment instructions.
- Draft first; send only after the owner's yes.
- Chase overdue invoices politely at 3, 10 and 30 days (drafts for the owner's yes).
- Payouts, transfers and supplier payments are prepared, never executed, until the owner's explicit yes; adding bank accounts or cards is the owner's job in the provider's app.
- Match every payment received to its invoice.
