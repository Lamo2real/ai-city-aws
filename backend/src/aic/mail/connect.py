"""``connect_account`` (§2.1, §2.2): called by ``add_connector`` when the owner names a mail or calendar
provider. It only creates the row and puts the sign-in card on the bus: nothing is connected until the owner
taps "Sign in" (or submits the app-password form) themselves. The authorization URL never reaches a model."""

from __future__ import annotations

from typing import Any

from .accounts import PROVIDERS, AccountStore, public

_NAMES = {"google": "Google", "microsoft": "Microsoft", "imap": "your mail provider"}


async def connect_account(d: Any, a: dict[str, Any]) -> str:
    provider = str(a.get("provider", ""))
    if provider not in PROVIDERS:
        return "provider must be google, microsoft or imap."
    label = str(a.get("label") or provider.capitalize()).strip()[:40] or provider.capitalize()
    store = AccountStore(d.ledger.table, d.ledger.now)
    if any(x.get("provider") == provider and x.get("label", "").lower() == label.lower() for x in await store.all()):
        return (
            f"There's already a {provider} account labelled {label!r}. Ask the owner for another label "
            "(for example 'work' or 'personal') if this is a different account."
        )
    acct = await store.create(provider, label)
    await d.bus.put({"type": "connect.signin", "account_id": acct["id"], "provider": provider, "label": label})
    await d.bus.put({"type": "mail.account", "account": public(acct)})
    if provider == "imap":
        return (
            f'An "Add the app password for {label}" card is now in the chat. The owner fills it in there; never '
            "ask for the password in chat."
        )
    return (
        f'A "Sign in to {_NAMES[provider]} ({label})" button is now in the chat. The owner taps it; nothing else to do.'
    )
