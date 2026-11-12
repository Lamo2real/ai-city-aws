"""AWS throttling makes a start wait and retry, never fail the build (decision 288)."""

import random

from vaic.shared.hierarchy.dispatch import THROTTLE_MAX_SECONDS, throttle_delay, throttled


class ClientError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(f"An error occurred ({code})")
        self.response = {"Error": {"Code": code}}


def test_quota_and_rate_errors_count_as_throttling_and_others_do_not() -> None:
    for code in ("ThrottlingException", "ServiceQuotaExceededException", "TooManyRequestsException"):
        assert throttled(ClientError(code))
    assert throttled(RuntimeError("Rate exceeded"))
    assert not throttled(ClientError("AccessDeniedException"))
    assert not throttled(ValueError("bad payload"))


def test_the_delay_grows_with_jitter_and_stays_under_two_minutes() -> None:
    rnd = random.Random(7)  # noqa: S311 (jitter, not security)
    delays = [throttle_delay(n, rnd) for n in range(12)]
    assert all(1 <= x <= THROTTLE_MAX_SECONDS for x in delays)
    assert delays[0] <= 2 and delays[-1] >= THROTTLE_MAX_SECONDS // 2
