from cryptography.fernet import Fernet
import httpx
import pytest

from app.review_industry import category_matches, category_terms, verified_kakao_place
from app.schemas import ReviewPlaceRef


def test_official_and_kakao_categories_use_explicit_or_conservative_matches() -> None:
    assert category_matches("CS100010", "커피-음료", "음식점 > 카페 > 디저트카페")
    assert category_matches("CS100010", "커피-음료", "음식점 > 카페 > 커피전문점 > 브랜드명")
    assert not category_matches("CS100010", "커피-음료", "음식점 > 한식")
    assert category_matches("CS200004", "컴퓨터학원", "교육 > 컴퓨터학원")
    assert not category_matches("CS200006", "일반의원", "병원 > 치과의원")
    assert not category_matches("CS300011", "일반의류", "쇼핑 > 유아의류")
    assert category_terms("CS300043", "전자상거래업") == ("전자상거래업",)


def test_kakao_rest_verification_requires_matching_id_and_coordinates(monkeypatch) -> None:
    place = ReviewPlaceRef(id="123", name="가게", latitude=37.55, longitude=127.04)

    def fake_get(_url, **kwargs):
        assert kwargs["params"]["query"] == "가게"
        assert kwargs["headers"]["Authorization"].startswith("KakaoAK ")
        return httpx.Response(200, json={"documents": [{
            "id": "123", "place_name": "가게", "category_name": "음식점 > 카페",
            "x": "127.04", "y": "37.55",
        }]}, request=httpx.Request("GET", "https://dapi.kakao.com"))

    monkeypatch.setattr("app.review_industry.httpx.get", fake_get)
    verified = verified_kakao_place(place, "test-key")
    assert verified.category == "음식점 > 카페"
    assert verified.id == "123"

    def wrong_id(_url, **_kwargs):
        return httpx.Response(200, json={"documents": []}, request=httpx.Request("GET", "https://dapi.kakao.com"))

    monkeypatch.setattr("app.review_industry.httpx.get", wrong_id)
    with pytest.raises(ValueError, match="ID"):
        verified_kakao_place(place, "test-key")
