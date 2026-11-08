from cryptography.fernet import Fernet
import pytest
from playwright.sync_api import Error as PlaywrightError
from types import SimpleNamespace

from app.review_capture import (
    MAX_PLACES_PER_RUN,
    MAX_REVIEWS_PER_PLACE,
    MAX_REVIEWS_PER_RUN,
    CaptureConfigurationError,
    CaptureTarget,
    PublicReviewBrowserCollector,
    cipher_from_key,
    validate_targets,
)


def test_capture_requires_a_valid_encryption_key() -> None:
    with pytest.raises(CaptureConfigurationError):
        cipher_from_key(None)
    cipher = cipher_from_key(Fernet.generate_key().decode("utf-8"))
    assert cipher.decrypt(cipher.encrypt(b"review")) == b"review"


def test_capture_limits_places_and_rejects_non_public_targets() -> None:
    assert (MAX_PLACES_PER_RUN, MAX_REVIEWS_PER_PLACE, MAX_REVIEWS_PER_RUN) == (10, 40, 400)
    valid = [CaptureTarget("naver", "https://m.place.naver.com/example", "A")]
    validate_targets(valid)
    with pytest.raises(ValueError):
        validate_targets([CaptureTarget("kakao", "http://place.map.kakao.com/1", "A")])
    with pytest.raises(ValueError):
        validate_targets([CaptureTarget("naver", f"https://example.com/{index}", str(index)) for index in range(MAX_PLACES_PER_RUN + 1)])


def test_distinct_visible_review_nodes_keep_identical_text() -> None:
    class Locator:
        def count(self):
            return 2

        def all_text_contents(self):
            return ["좋아요", "좋아요"]

    class Page:
        def locator(self, _selector):
            return Locator()

    collector = PublicReviewBrowserCollector(Fernet.generate_key().decode())
    assert collector._read_public_review_text(Page(), "kakao") == ["좋아요", "좋아요"]


def test_one_page_failure_does_not_stop_later_places(monkeypatch) -> None:
    class Page:
        def goto(self, url, **_kwargs):
            if url.endswith("/2"):
                raise PlaywrightError("simulated navigation failure")
            return SimpleNamespace(status=200)

    class Browser:
        closed = False

        def new_page(self):
            return Page()

        def close(self):
            self.closed = True

    browser = Browser()

    class Context:
        def __enter__(self):
            return SimpleNamespace(chromium=SimpleNamespace(launch=lambda **_kwargs: browser))

        def __exit__(self, *_args):
            return None

    monkeypatch.setattr("playwright.sync_api.sync_playwright", lambda: Context())
    monkeypatch.setattr(PublicReviewBrowserCollector, "_open_review_section", lambda *_args: None)
    monkeypatch.setattr(PublicReviewBrowserCollector, "_read_public_review_text", lambda *_args: ["친절해요"])
    collector = PublicReviewBrowserCollector(Fernet.generate_key().decode())
    targets = [CaptureTarget("kakao", f"https://place.map.kakao.com/{index}", label)
               for index, label in enumerate("ABC", start=1)]
    batch = collector.capture_with_failures(targets)
    assert [review.peer_label for review in batch.reviews] == ["A", "C"]
    assert batch.failed_labels == ["B"]
    assert browser.closed
