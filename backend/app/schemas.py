from __future__ import annotations

from pydantic import BaseModel, ConfigDict


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

