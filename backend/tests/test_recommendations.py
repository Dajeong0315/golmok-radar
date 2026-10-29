from app.recommendations import CandidateScore, combined_rules, percentile, select_diverse
from app.models import TradeArea


def area(code: str, district: str, area_type: str) -> TradeArea:
    return TradeArea(code=code, name=code, district_code="", district_name=district, area_type_code="", area_type_name=area_type, x_epsg5181=0, y_epsg5181=0, longitude=0, latitude=0)


def test_percentile_uses_midrank_for_ties() -> None:
    assert percentile(10, [10, 10, 20]) == 25.0
    assert percentile(20, [10, 10, 20]) == 100.0
    assert percentile(10, [10]) == 50.0


def test_combined_rules_are_versioned_and_directional() -> None:
    rules = combined_rules("office", "lean", "avoid")
    assert any(rule.metric_key == "weekday_sales_ratio" and rule.direction == 1 for rule in rules)
    assert any(rule.metric_key == "store_count" and rule.direction == -1 and rule.weight == 5 for rule in rules)


def test_select_diverse_can_promote_different_district_with_small_bonus() -> None:
    candidates = [
        CandidateScore(area("a", "광진구", "골목상권"), 90, []),
        CandidateScore(area("b", "광진구", "골목상권"), 89, []),
        CandidateScore(area("c", "성동구", "발달상권"), 88, []),
    ]
    assert [item.area.code for item in select_diverse(candidates, 2)] == ["a", "c"]
