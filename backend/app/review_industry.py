"""Conservative mapping from official store industries to Kakao place categories.

The two taxonomies have no shared codes. A match is a review sampling filter,
not a claim that the official store count and Kakao place inventory are equal.
"""

from __future__ import annotations

import re

import httpx

from .schemas import ReviewPlaceRef


ALIASES: dict[str, tuple[str, ...]] = {
    "CS100001": ("한식",), "CS100002": ("중식", "중국음식"),
    "CS100003": ("일식", "일본음식"), "CS100004": ("양식", "이탈리안", "프렌치"),
    "CS100005": ("제과", "베이커리", "빵집"),
    "CS100006": ("패스트푸드", "햄버거"), "CS100007": ("치킨",),
    "CS100008": ("분식",), "CS100009": ("호프", "주점", "맥주"),
    "CS100010": ("카페", "커피전문점", "커피숍"),
    "CS200001": ("보습학원", "교습학원"),
    "CS200006": ("내과", "외과", "정형외과", "소아과", "의원"),
    "CS200007": ("치과",), "CS200008": ("한의원",),
    "CS300001": ("슈퍼마켓", "마트"), "CS300002": ("편의점",),
    "CS300011": ("의류", "옷가게"), "CS300018": ("약국", "의약품"),
}
AMBIGUOUS = {"일반", "기타", "서비스", "판매", "제품", "전문", "점포"}
EXCLUSIONS: dict[str, tuple[str, ...]] = {
    "CS200006": ("치과", "한의원"),
    "CS300011": ("유아",),
}


def category_terms(industry_code: str, industry_name: str) -> tuple[str, ...]:
    if industry_code in ALIASES:
        return ALIASES[industry_code]
    name = re.sub(r"[^가-힣A-Za-z0-9]", "", industry_name)
    for suffix in ("판매점", "판매", "전문점", "음식점", "사무소", "서비스", "점"):
        if name.endswith(suffix):
            name = name[:-len(suffix)]
            break
    return (name,) if len(name) >= 2 and name not in AMBIGUOUS else ()


def category_matches(industry_code: str, industry_name: str, category: str) -> bool:
    category_path = re.sub(r"\s+", "", category)
    terms = category_terms(industry_code, industry_name)
    if not category_path or not terms:
        return False
    if any(term in category_path for term in EXCLUSIONS.get(industry_code, ())):
        return False
    return any(term in category_path for term in terms)


def verified_kakao_place(place: ReviewPlaceRef, rest_api_key: str) -> ReviewPlaceRef:
    """Search near a supplied place and require the same Kakao ID and coordinates."""
    if not place.name:
        raise ValueError("장소 이름이 없어 카카오 장소를 다시 확인할 수 없습니다.")
    response = httpx.get(
        "https://dapi.kakao.com/v2/local/search/keyword.json",
        headers={"Authorization": f"KakaoAK {rest_api_key}"},
        params={
            "query": place.name, "x": place.longitude, "y": place.latitude,
            "radius": 200, "sort": "distance", "size": 15,
        }, timeout=10,
    )
    response.raise_for_status()
    match = next((item for item in response.json().get("documents", []) if str(item.get("id")) == place.id), None)
    if match is None:
        raise ValueError("선택한 카카오 장소 ID를 다시 확인할 수 없습니다. 검색부터 다시 진행해 주세요.")
    latitude, longitude = float(match["y"]), float(match["x"])
    if abs(latitude - place.latitude) > 0.0003 or abs(longitude - place.longitude) > 0.0004:
        raise ValueError("선택한 장소의 좌표가 카카오 검색 결과와 다릅니다.")
    return ReviewPlaceRef(
        id=place.id, latitude=latitude, longitude=longitude,
        name=str(match.get("place_name") or ""), category=str(match.get("category_name") or ""),
    )
