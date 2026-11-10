"""``connect_account`` (§2.1, §2.2): called by ``add_connector`` when the owner names a mail or calendar
provider. It only creates the row and puts the sign-in card on the bus: nothing is connected until the owner
taps "Sign in" (or submits the app-password form) themselves. The authorization URL never reaches a model."""

from __future__ import annotations

from typing import Any

from .accounts import APP_PASSWORD_HELP, APP_PASSWORD_PRESET, PROVIDERS, AccountStore, oauth_enabled, public

_NAMES = {"google": "Google", "microsoft": "Microsoft", "imap": "your mail provider"}


def _pending(accounts: list[dict[str, Any]], provider: str, preset: str) -> dict[str, Any] | None:
    """The account a card is already waiting on for this provider (and preset), if any."""
    return next(
        (
            x
            for x in accounts
            if x.get("status") == "signing_in"
            and x.get("provider") == provider
            and str(x.get("preset") or "") == preset
        ),
        None,
    )


async def connect_account(d: Any, a: dict[str, Any]) -> str:
    provider = str(a.get("provider", ""))
    if provider not in PROVIDERS:
        return "provider must be google, microsoft or imap."
    if provider == "microsoft" and not oauth_enabled("microsoft"):
        # Microsoft turned off app passwords for Outlook mail, so an app-password card could never connect.
        return (
            "Outlook and Microsoft 365 connect only by signing in with Microsoft: Microsoft has turned off app "
            "passwords for Outlook mail. Microsoft sign-in isn't switched on in the city yet; it needs a one-time "
            "Microsoft app registration by the owner (docs/RUNBOOK.md, “Mail and calendar: the owner's one-time setup”). Nothing was added and no card "
            "is shown. Tell the owner that plainly, once, and don't try another way to connect Outlook (no app "
            "password, no MCP server)."
        )
    label = str(a.get("label") or provider.capitalize()).strip()[:40] or provider.capitalize()
    store = AccountStore(d.ledger.table, d.ledger.now)
    accounts = await store.all()
    preset = APP_PASSWORD_PRESET.get(provider, "") if not oauth_enabled(provider) else ""
    kind = "imap" if preset else provider
    # One request, one card: asking again (in the same turn or later) shows the card already waiting.
    if provider != "imap" and (waiting := _pending(accounts, kind, preset)):
        await d.bus.put(_card(waiting))
        return (
            f"The card for {waiting.get('label') or label} is already in the chat, waiting for the owner. Nothing new "
            "was added. Tell them to use that card."
        )
    if any(x.get("provider") == kind and x.get("label", "").lower() == label.lower() for x in accounts):
        return (
            f"There's already a {provider} account labelled {label!r}. Ask the owner for another label "
            "(for example 'work' or 'personal') if this is a different account."
        )
    if preset:
        # Sign-in isn't switched on here: the same mailbox by app password, the servers filled in.
        help_ = APP_PASSWORD_HELP[provider]
        acct = await store.create("imap", label)
        acct = await store.update(acct["id"], {"preset": preset}) or acct
        await d.bus.put(_card(acct))
        await d.bus.put({"type": "mail.account", "account": public(acct)})
        return (
            f'An "Add the app password for {label}" card is now in the chat, with the {preset.split(" (")[0]} servers '
            f"filled in. Tell the owner in one or two sentences: {help_} Never ask for the password in chat."
        )
    acct = await store.create(provider, label)
    await d.bus.put(_card(acct))
    await d.bus.put({"type": "mail.account", "account": public(acct)})
    if provider == "imap":
        return (
            f'An "Add the app password for {label}" card is now in the chat. The owner fills it in there; never '
            "ask for the password in chat."
        )
    return (
        f'A "Sign in to {_NAMES[provider]} ({label})" button is now in the chat. The owner taps it; nothing else to do.'
    )


def _card(acct: dict[str, Any]) -> dict[str, Any]:
    """The ``connect.signin`` bus event for an account (the HUD keys the card by account id, so it is never doubled)."""
    e = {"type": "connect.signin", "account_id": acct["id"], "provider": acct["provider"], "label": acct.get("label")}
    if acct.get("preset"):
        e["preset"] = acct["preset"]
    return e
