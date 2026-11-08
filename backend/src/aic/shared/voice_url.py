"""A short-lived address for AIC's real-time voice (decision 120): a SigV4 presigned WebSocket URL to AIC's own
AgentCore runtime (``/runtimes/<arn>/ws``), signed by the API's role, as AgentCore documents for browsers. It lasts
five minutes (AgentCore's maximum), only opens the connection, and names AIC's warm session so the voice runs next
to AIC's warm clients.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote, urlencode, urlparse

EXPIRES_S = 300


@dataclass
class VoiceUrlDeps:
    session: Any
    """A boto3 session (the API role's credentials)."""
    region: str
    runtime_arn: str
    session_id: Callable[[], str]


def presigned_voice_url(d: VoiceUrlDeps) -> str:
    from botocore.auth import SigV4QueryAuth
    from botocore.awsrequest import AWSRequest

    host = f"bedrock-agentcore.{d.region}.amazonaws.com"
    query = urlencode({"X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": d.session_id()})
    url = f"https://{host}/runtimes/{quote(d.runtime_arn, safe='')}/ws?{query}"
    creds = d.session.get_credentials()
    if creds is None:
        raise RuntimeError("no AWS credentials")
    req = AWSRequest(method="GET", url=url, headers={"host": urlparse(url).hostname or host})
    SigV4QueryAuth(creds.get_frozen_credentials(), "bedrock-agentcore", d.region, expires=EXPIRES_S).add_auth(req)
    return str(req.url).replace("https://", "wss://", 1)
