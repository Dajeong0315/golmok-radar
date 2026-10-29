from app.review_analysis import analyze_reviews, build_insights, classify_sentiment


def test_keyword_sentiment_is_deterministic() -> None:
    assert classify_sentiment("커피가 맛있고 직원도 친절해요") == "positive"
    assert classify_sentiment("가격이 비싸고 대기가 오래 걸려요") == "negative"
    assert classify_sentiment("공간에 좌석이 있어요") == "neutral"


def test_topics_keep_count_and_traceable_review_indices() -> None:
    result = analyze_reviews(["커피가 맛있어요", "가격이 비싸요", "주차 가능"])
    assert result["menu"].mentions == 1
    assert result["menu"].evidence[0].review_index == 1
    assert result["price"].negative == 1
    assert result["service"].mentions == 0


def test_insight_separates_observation_from_action_idea() -> None:
    own = analyze_reviews(["응대가 불친절해요", "서비스가 불친절해요"])
    nearby = analyze_reviews(["응대가 친절해요", "서비스가 친절해요"])
    insights = build_insights(own, nearby)
    assert insights[0]["kind"] == "caution"
    assert "내 가게 100%" in insights[0]["observation"]
    assert "2주 뒤" in insights[0]["action_idea"]
