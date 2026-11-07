"""Credentials for one account: an OAuth access token from the AgentCore Identity token vault (Google,
Microsoft), or an IMAP app password from Secrets Manager. Never logged, never returned to a model (§1)."""

from __future__ import annotations

import asyncio
import json
import os
import time
from dataclasses import dataclass, field
from typing import Any

from .accounts import Account, mail_config

CACHE_SECONDS = 300


class NeedsSignIn(RuntimeError):
    """The vault has no usable token for this account: the owner must sign in (again)."""


@dataclass
class Tokens:
    identity: Any
    """A boto3 ``bedrock-agentcore`` client."""
    secrets: Any
    """A boto3 ``secretsmanager`` client."""
    workload: str = "aic-prod-mail"
    _cache: dict[str, tuple[float, Any]] = field(default_factory=dict)

    @classmethod
    def from_env(cls, session: Any) -> Tokens:
        return cls(
            session.client("bedrock-agentcore"),
            session.client("secretsmanager"),
            os.environ.get("AIC_MAIL_WORKLOAD", "aic-prod-mail"),
        )

    def _cached(self, key: str) -> Any:
        hit = self._cache.get(key)
        return hit[1] if hit and hit[0] > time.monotonic() else None

    def _workload_token(self, account_id: str) -> str:
        r = self.identity.get_workload_access_token_for_user_id(workloadName=self.workload, userId=account_id)
        return str(r["workloadAccessToken"])

    async def access_token(self, a: Account) -> str:
        """The account's OAuth access token (AgentCore refreshes it). Raises NeedsSignIn."""
        key = f"oauth:{a['id']}"
        if tok := self._cached(key):
            return str(tok)
        cfg = mail_config()

        def fetch() -> dict[str, Any]:
            return dict(
                self.identity.get_resource_oauth2_token(
                    workloadIdentityToken=self._workload_token(a["id"]),
                    resourceCredentialProviderName=cfg["providers"][a["provider"]],
                    scopes=cfg["scopes"][a["provider"]],
                    oauth2Flow="USER_FEDERATION",
                )
            )

        r = await asyncio.to_thread(fetch)
        tok = r.get("accessToken")
        if not tok:
            raise NeedsSignIn(f"{a.get('label', 'This account')} needs the owner to sign in again.")
        self._cache[key] = (time.monotonic() + CACHE_SECONDS, tok)
        return str(tok)

    async def start_signin(self, a: Account, return_url: str, state: str) -> tuple[str | None, str | None]:
        """(authorization URL, session URI), or (None, None) when the vault already holds a token."""
        cfg = mail_config()

        def ask() -> dict[str, Any]:
            return dict(
                self.identity.get_resource_oauth2_token(
                    workloadIdentityToken=self._workload_token(a["id"]),
                    resourceCredentialProviderName=cfg["providers"][a["provider"]],
                    scopes=cfg["scopes"][a["provider"]],
                    oauth2Flow="USER_FEDERATION",
                    resourceOauth2ReturnUrl=return_url,
                    forceAuthentication=True,
                    customState=state,
                )
            )

        r = await asyncio.to_thread(ask)
        return r.get("authorizationUrl"), r.get("sessionUri")

    async def complete_signin(self, a: Account, session_uri: str) -> None:
        await asyncio.to_thread(
            self.identity.complete_resource_token_auth,
            userIdentifier={"userId": a["id"]},
            sessionUri=session_uri,
        )
        self._cache.pop(f"oauth:{a['id']}", None)

    async def imap_password(self, a: Account) -> str:
        key = f"imap:{a['id']}"
        if pw := self._cached(key):
            return str(pw)
        r = await asyncio.to_thread(self.secrets.get_secret_value, SecretId=f"aic/prod/mail/{a['id']}")
        pw = json.loads(r["SecretString"])["password"]
        self._cache[key] = (time.monotonic() + CACHE_SECONDS, pw)
        return str(pw)

    def forget(self, account_id: str) -> None:
        self._cache.pop(f"oauth:{account_id}", None)
        self._cache.pop(f"imap:{account_id}", None)
