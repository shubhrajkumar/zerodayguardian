import uuid
from sqlalchemy import Column, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON
from sqlalchemy.sql import func
from db import Base

JSON_TYPE = JSONB().with_variant(JSON, "sqlite")


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    external_id = Column(String(128), unique=True, nullable=True)
    email = Column(String(255), unique=True, nullable=False)
    name = Column(String(120), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ScanReport(Base):
    __tablename__ = "scan_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    target_url = Column(Text, nullable=False)
    final_url = Column(Text, nullable=True)
    status_code = Column(String(12), nullable=True)
    score = Column(Float, nullable=False, default=0.0)
    summary = Column(Text, nullable=True)
    findings = Column(JSON_TYPE, nullable=False, default=list)
    headers = Column(JSON_TYPE, nullable=True)
    latency_ms = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ThreatEvent(Base):
    __tablename__ = "threat_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    input_metrics = Column(JSON_TYPE, nullable=False, default=dict)
    risk_level = Column(String(16), nullable=False, default="low")
    reasons = Column(JSON_TYPE, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
