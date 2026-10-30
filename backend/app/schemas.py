from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class TradeAreaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str
    district_name: str
    area_type_name: str
    latitude: float
    longitude: float
    data_status: dict[str, bool] | None = None


class MetricAreaValue(BaseModel):
    trade_area_code: str
    status: str
    value: int | float | None
    reason: str | None = None


class ComparisonMetric(BaseModel):
    metric_key: str
    label: str
    unit: str
    values: list[MetricAreaValue]


class ComparisonResponse(BaseModel):
    comparison_id: str
    quarter_code: str
    quarter_label: str
    trade_areas: list[TradeAreaOut]
    metrics: list[ComparisonMetric]


class EvidenceArea(BaseModel):
    trade_area_code: str
    trade_area_name: str
    status: str
    value: int | float | None
    reason: str | None = None
    filter: dict[str, str]
    numerator: int | None = None
    denominator: int | None = None


class EvidenceResponse(BaseModel):
    metric_key: str
    label: str
    unit: str
    dataset_name: str
    provider: str
    source_file: str
    fetched_at: str | None
    quarter_code: str
    formula: str | None
    rounding: str | None
    areas: list[EvidenceArea]


class ChecklistItem(BaseModel):
    category: str
    question: str


class ChecklistResponse(BaseModel):
    notice: str
    items: list[ChecklistItem]


class RecommendationRequest(BaseModel):
    business: Literal["cafe", "food", "retail", "service"]
    demand: Literal["neighborhood", "office", "destination", "nightlife"]
    risk: Literal["lean", "balanced", "growth", "unknown"]
    operation: Literal["solo", "partner", "team", "community"]
    strength: Literal["product", "hospitality", "branding", "numbers"]
    competition: Literal["avoid", "validated", "differentiate", "traffic"]


class RecommendationReason(BaseModel):
    metric_key: str
    label: str
    unit: str
    value: float
    percentile: float
    fit_percentile: float
    weight: float
    direction: str
    explanation: str


class RecommendationCandidate(BaseModel):
    rank: int
    score: float
    trade_area: TradeAreaOut
    reasons: list[RecommendationReason]
    cautions: list[str]
    data_completeness: str


class RecommendationResponse(BaseModel):
    status: Literal["available", "unsupported_business"]
    message: str
    quarter_code: str
    quarter_label: str
    weights_version: str
    candidate_pool_size: int
    diversity_rule: str
    candidates: list[RecommendationCandidate]


class AreaReportInsight(BaseModel):
    metric_key: str
    label: str
    value: float | None
    unit: str
    percentile: float | None
    summary: str


class AreaReportResponse(BaseModel):
    quarter_code: str
    quarter_label: str
    comparison_count: int
    trade_area: TradeAreaOut
    strengths: list[AreaReportInsight]
    cautions: list[AreaReportInsight]
    characteristics: list[AreaReportInsight]
    notice: str


class RentBenchmarkMetric(BaseModel):
    metric_key: str
    label: str
    value: float
    unit: str
    table_id: str
    item_id: str


class RentBenchmarkResponse(BaseModel):
    status: Literal["available", "mapping_required"]
    trade_area: TradeAreaOut
    provider: str
    dataset_name: str
    update_cycle: str
    is_live_listing: bool
    source_period: str | None = None
    source_region: str | None = None
    building_type: str | None = None
    mapping_scope: Literal["administrative_context"] | None = None
    confidence: Literal["contextual"] | None = None
    metrics: list[RentBenchmarkMetric] = Field(default_factory=list)
    message: str
    disclaimer: str
    source_url: str
    api_docs_url: str


class SupportProgramQuery(BaseModel):
    stage: Literal["pre_startup", "existing"]
    region: str
    age: int | None = None
    years_in_business: int | None = None


class SupportProgramCandidate(BaseModel):
    program_id: str
    title: str
    application_end: str
    source_url: str
    reasons: list[str]
    needs_confirmation: list[str]


class SupportProgramResponse(BaseModel):
    status: Literal["available", "configuration_required"]
    provider: str
    checked_at: str
    message: str
    required_setting: str | None
    candidates: list[SupportProgramCandidate]
    source_url: str
    disclaimer: str


class ReviewAnalysisRequest(BaseModel):
    own_shop_name: str
    comparison_scope: str
    period_label: str
    own_reviews: list[str]
    nearby_reviews: list[str]


class ReviewEvidence(BaseModel):
    review_index: int
    snippet: str
    sentiment: Literal["positive", "negative", "neutral"]


class ReviewTopicSide(BaseModel):
    mentions: int
    positive: int
    negative: int
    neutral: int
    evidence: list[ReviewEvidence]


class ReviewTopicComparison(BaseModel):
    topic_key: str
    label: str
    own: ReviewTopicSide
    nearby: ReviewTopicSide


class ReviewInsight(BaseModel):
    topic_key: str
    kind: Literal["strength", "caution"]
    observation: str
    action_idea: str


class ReviewAnalysisResponse(BaseModel):
    status: Literal["available", "insufficient_sample"]
    source: Literal["user_provided"]
    own_shop_name: str
    comparison_scope: str
    period_label: str
    own_sample_count: int
    nearby_sample_count: int
    topics: list[ReviewTopicComparison]
    insights: list[ReviewInsight]
    notice: str

