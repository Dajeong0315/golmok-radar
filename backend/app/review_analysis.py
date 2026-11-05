from __future__ import annotations

import re
from dataclasses import dataclass


TOPICS = {
    "menu": ("메뉴·맛", ("맛", "메뉴", "커피", "디저트", "음료")),
    "price": ("가격", ("가격", "비싸", "저렴", "가성비")),
    "service": ("응대", ("친절", "불친절", "응대", "서비스")),
    "wait": ("대기", ("대기", "기다", "빠르", "느리", "오래")),
    "cleanliness": ("청결", ("깨끗", "청결", "더럽")),
    "space": ("공간·분위기", ("분위기", "좌석", "공간", "인테리어", "시끄", "조용")),
}
SERVICE_TOPICS = {
    "quality": ("서비스·결과", ("결과", "실력", "정확", "전문", "만족", "효과", "품질")),
    "price": TOPICS["price"], "service": TOPICS["service"],
    "wait": TOPICS["wait"], "cleanliness": TOPICS["cleanliness"],
    "space": TOPICS["space"],
}
RETAIL_TOPICS = {
    "product": ("상품·품질", ("상품", "제품", "품질", "재질", "디자인", "종류")),
    "price": TOPICS["price"], "service": TOPICS["service"],
    "stock": ("재고·구색", ("재고", "품절", "구색", "선택", "다양")),
    "wait": TOPICS["wait"], "space": TOPICS["space"],
}
POSITIVE = ("좋아", "좋았", "맛있", "친절", "깨끗", "만족", "훌륭", "추천", "빠르", "편안", "예쁘", "저렴")
NEGATIVE = ("별로", "맛없", "불친절", "더럽", "비싸", "느리", "오래", "시끄", "불편", "아쉽")

PERSONAL_PATTERNS = (
    (re.compile(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b"), "[이메일 제거]"),
    (re.compile(r"(?<!\d)(?:01[016789]|0\d{1,2})[-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)"), "[전화번호 제거]"),
    (re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE), "[링크 제거]"),
    (re.compile(r"(?<!\w)@[A-Za-z0-9_.-]{2,}"), "[계정명 제거]"),
)


@dataclass(frozen=True)
class Evidence:
    review_index: int
    snippet: str
    sentiment: str


@dataclass(frozen=True)
class TopicStats:
    topic_key: str
    label: str
    mentions: int
    positive: int
    negative: int
    neutral: int
    evidence: tuple[Evidence, ...]


def sanitize_review_text(text: str) -> str:
    sanitized = text.strip()
    for pattern, replacement in PERSONAL_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)
    return sanitized


def classify_sentiment(text: str) -> str:
    positive_text = text
    for token in NEGATIVE:
        positive_text = positive_text.replace(token, "")
    positive = sum(token in positive_text for token in POSITIVE)
    negative = sum(token in text for token in NEGATIVE)
    if positive > negative:
        return "positive"
    if negative > positive:
        return "negative"
    return "neutral"


def topics_for_industry(industry_code: str) -> dict:
    if industry_code.startswith("CS200"):
        return SERVICE_TOPICS
    if industry_code.startswith("CS300"):
        return RETAIL_TOPICS
    return TOPICS


def analyze_reviews(reviews: list[str], industry_code: str = "CS100010") -> dict[str, TopicStats]:
    result: dict[str, TopicStats] = {}
    for topic_key, (label, keywords) in topics_for_industry(industry_code).items():
        evidence: list[Evidence] = []
        counts = {"positive": 0, "negative": 0, "neutral": 0}
        for index, raw in enumerate(reviews, start=1):
            text = raw.strip()
            if not text or not any(keyword in text for keyword in keywords):
                continue
            sentiment = classify_sentiment(text)
            counts[sentiment] += 1
            if len(evidence) < 3:
                evidence.append(Evidence(index, text[:80], sentiment))
        result[topic_key] = TopicStats(
            topic_key=topic_key,
            label=label,
            mentions=sum(counts.values()),
            positive=counts["positive"],
            negative=counts["negative"],
            neutral=counts["neutral"],
            evidence=tuple(evidence),
        )
    return result


def negative_rate(stats: TopicStats) -> float | None:
    if stats.mentions == 0:
        return None
    return round(stats.negative / stats.mentions, 3)


def positive_rate(stats: TopicStats) -> float | None:
    if stats.mentions == 0:
        return None
    return round(stats.positive / stats.mentions, 3)


def build_insights(own: dict[str, TopicStats], nearby: dict[str, TopicStats]) -> list[dict[str, str]]:
    insights: list[dict[str, str]] = []
    for key in own:
        own_stats = own[key]
        nearby_stats = nearby[key]
        own_negative = negative_rate(own_stats)
        nearby_negative = negative_rate(nearby_stats)
        own_positive = positive_rate(own_stats)
        nearby_positive = positive_rate(nearby_stats)
        if own_stats.mentions >= 2 and nearby_stats.mentions >= 2:
            if own_negative is not None and nearby_negative is not None and own_negative >= nearby_negative + 0.2:
                insights.append({
                    "topic_key": key,
                    "kind": "caution",
                    "observation": f"{own_stats.label}의 부정 언급 비중이 내 가게 {own_negative:.0%}, 주변 비교군 {nearby_negative:.0%}입니다.",
                    "action_idea": f"{own_stats.label} 관련 부정 리뷰 원문을 운영 체크리스트로 묶고 2주 뒤 같은 기준으로 다시 확인해 보세요.",
                })
            elif own_positive is not None and nearby_positive is not None and own_positive >= nearby_positive + 0.2:
                insights.append({
                    "topic_key": key,
                    "kind": "strength",
                    "observation": f"{own_stats.label}의 긍정 언급 비중이 내 가게 {own_positive:.0%}, 주변 비교군 {nearby_positive:.0%}입니다.",
                    "action_idea": f"{own_stats.label}에서 반복되는 긍정 표현을 유지할 운영 기준으로 문서화해 보세요.",
                })
    return insights[:4]
