---
name: sell-with-stripe
description: "Sell anything online with the owner's one Stripe account: a product and price per item, payment links or Checkout, tagged per app, however many products there are."
---
# Sell with Stripe (one account for everything)

The owner has **one** Stripe account. Every product, app, site, game or service the city sells uses it, whether that is one product or hundreds. Never create a second Stripe account and never ask the owner for a different one.

## For each thing sold
1. Search Stripe (the **Stripe** connector) for an existing product first; reuse it rather than making a duplicate.
2. Create a **Product** with a clear name, description and image, and `metadata`: `app` (the app or site it is sold in), `department`, `sku` if the owner uses them.
3. Create a **Price**: one-time or recurring, currency (the owner's default, often SEK or EUR), tax behaviour (`exclusive` or `inclusive`, as the owner sells).
4. The simplest way to take money: a **Payment Link** for that price. Put the link in the site, app, email, ad or post.
5. Inside an app the city builds (IT): Stripe Checkout or Payment Element, with the server-side secret key stored as a deployment secret (GitHub Actions secret or the host's secret store; the owner pastes it there once), a webhook for `checkout.session.completed`, and test mode first.
6. Many products: keep them in one catalogue, distinguished by `metadata.app`; reports filter on it.

## Always
- Test mode first; switch to live only with the owner's yes.
- Prices, discounts and refunds come from the owner or the knowledge base; never invent them. Refunds only after the owner's yes.
- Report the product ids, price ids and payment links you created.
