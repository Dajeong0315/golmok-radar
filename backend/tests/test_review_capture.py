from cryptography.fernet import Fernet
import pytest

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
