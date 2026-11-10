"""Mail and calendar connectors (``docs/MAIL_CALENDAR.md``): several accounts per provider, tokens in the
AgentCore Identity vault (one vault user per account), IMAP app passwords in Secrets Manager."""

from __future__ import annotations

from .connect import connect_account

__all__ = ["connect_account"]
