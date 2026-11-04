from cryptography.fernet import Fernet
import pytest

from app.review_capture import (
    MAX_PLACES_PER_RUN,
    CaptureConfigurationError,
    CaptureTarget,
    cipher_from_key,
    validate_targets,
)


def test_capture_requires_a_valid_encryption_key() -> None:
    with pytest.raises(CaptureConfigurationError):
        cipher_from_key(None)
    cipher = cipher_from_key(Fernet.generate_key().decode("utf-8"))
    assert cipher.decrypt(cipher.encrypt(b"review")) == b"review"


def test_capture_limits_places_and_rejects_non_public_targets() -> None:
    valid = [CaptureTarget("naver", "https://m.place.naver.com/example", "A")]
    validate_targets(valid)
    with pytest.raises(ValueError):
        validate_targets([CaptureTarget("kakao", "http://place.map.kakao.com/1", "A")])
    with pytest.raises(ValueError):
        validate_targets([CaptureTarget("naver", f"https://example.com/{index}", str(index)) for index in range(MAX_PLACES_PER_RUN + 1)])
