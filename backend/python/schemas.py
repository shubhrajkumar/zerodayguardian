from typing import Any, List, Optional
from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    email: str
    name: Optional[str] = None
    external_id: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    external_id: Optional[str] = None
    email: str
    name: Optional[str] = None

    class Config:
        from_attributes = True


class ScanRequest(BaseModel):
    url: str = Field(..., min_length=3)
    user_id: Optional[str] = None


class ScanFinding(BaseModel):
    id: str
    severity: str
    title: str
    description: str
    recommendation: str


class ScanReportResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    target_url: str
    final_url: Optional[str] = None
    status_code: Optional[str] = None
    score: float
    summary: Optional[str] = None
    findings: List[ScanFinding]
    headers: Optional[dict] = None
    latency_ms: Optional[float] = None
    created_at: Optional[str] = None


class ScanHistoryItem(BaseModel):
    id: str
    target_url: str
    score: float
    created_at: str


class ScanHistoryResponse(BaseModel):
    items: List[ScanHistoryItem]


class ThreatMetrics(BaseModel):
    requests_per_min: float = 0
    error_rate: float = 0
    failed_logins: float = 0
    anomaly_score: float = 0
    notes: Optional[str] = None


class ThreatDetectRequest(BaseModel):
    user_id: Optional[str] = None
    metrics: ThreatMetrics


class ThreatDetectResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    risk_level: str
    reasons: List[str]
    suspicious: bool
    metrics: ThreatMetrics
