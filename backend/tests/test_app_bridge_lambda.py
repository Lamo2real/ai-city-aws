"""The app-bridge Lambda's own wiring: the Gateway client comes from AIC_GATEWAY_URL, signed with its role."""

from types import SimpleNamespace

from aic.lambdas.app_bridge import app_call_deps
from aic.shared.gateway import GatewayClient


def test_without_a_gateway_url_connector_reads_have_no_gateway() -> None:
    city = SimpleNamespace(ledger=object(), session=object(), region="eu-north-1")
    d = app_call_deps(city, {})
    assert d.ledger is city.ledger and d.gateway is None


def test_with_a_gateway_url_the_client_points_at_it() -> None:
    city = SimpleNamespace(ledger=object(), session=object(), region="eu-north-1")
    d = app_call_deps(city, {"AIC_GATEWAY_URL": "https://gw.example/mcp"})
    assert isinstance(d.gateway, GatewayClient) and d.gateway.url == "https://gw.example/mcp"
