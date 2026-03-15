import os
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from db import Base, SessionLocal, engine
from models import ScanReport, ThreatEvent, User
from schemas import (
    ScanHistoryResponse,
    ScanReportResponse,
    ScanRequest,
    ThreatDetectRequest,
    ThreatDetectResponse,
    UserCreate,
    UserResponse,
)
from services.scan import run_scan
from services.threat import detect_threat


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)


app = FastAPI(title="ZeroDay Guardian Security API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("PY_CORS_ORIGINS", "*").split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    create_tables()


@app.get("/pyapi/health")
def health():
    return {"ok": True}


@app.post("/pyapi/users", response_model=UserResponse)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    existing = None
    if payload.external_id:
        existing = db.query(User).filter(User.external_id == payload.external_id).first()
    if not existing:
        existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        if payload.external_id and existing.external_id != payload.external_id:
            existing.external_id = payload.external_id
            db.commit()
            db.refresh(existing)
        return existing
    user = User(email=payload.email, name=payload.name, external_id=payload.external_id)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.get("/pyapi/users/{user_id}", response_model=UserResponse)
def get_user(user_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.post("/pyapi/scan", response_model=ScanReportResponse)
def scan_target(payload: ScanRequest, db: Session = Depends(get_db)):
    report = run_scan(payload.url)
    scan = ScanReport(
        user_id=payload.user_id,
        target_url=report["target_url"],
        final_url=report.get("final_url"),
        status_code=report.get("status_code"),
        score=report["score"],
        summary=report.get("summary"),
        findings=report.get("findings"),
        headers=report.get("headers"),
        latency_ms=report.get("latency_ms"),
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return ScanReportResponse(
        id=scan.id,
        user_id=scan.user_id,
        target_url=scan.target_url,
        final_url=scan.final_url,
        status_code=scan.status_code,
        score=scan.score,
        summary=scan.summary,
        findings=scan.findings or [],
        headers=scan.headers or {},
        latency_ms=scan.latency_ms,
        created_at=str(scan.created_at),
    )


@app.get("/pyapi/scan/history", response_model=ScanHistoryResponse)
def scan_history(user_id: str | None = None, limit: int = 8, db: Session = Depends(get_db)):
    query = db.query(ScanReport).order_by(ScanReport.created_at.desc())
    if user_id:
        query = query.filter(ScanReport.user_id == user_id)
    rows = query.limit(max(1, min(30, limit))).all()
    return {
        "items": [
            {
                "id": row.id,
                "target_url": row.target_url,
                "score": row.score,
                "created_at": str(row.created_at),
            }
            for row in rows
        ]
    }


@app.get("/pyapi/scan/report/{report_id}", response_model=ScanReportResponse)
def scan_report(report_id: str, db: Session = Depends(get_db)):
    row = db.query(ScanReport).filter(ScanReport.id == report_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Report not found")
    return ScanReportResponse(
        id=row.id,
        user_id=row.user_id,
        target_url=row.target_url,
        final_url=row.final_url,
        status_code=row.status_code,
        score=row.score,
        summary=row.summary,
        findings=row.findings or [],
        headers=row.headers or {},
        latency_ms=row.latency_ms,
        created_at=str(row.created_at),
    )


@app.post("/pyapi/threat/detect", response_model=ThreatDetectResponse)
def threat_detect(payload: ThreatDetectRequest, db: Session = Depends(get_db)):
    result = detect_threat(payload.metrics.dict())
    event = ThreatEvent(
        user_id=payload.user_id,
        input_metrics=payload.metrics.dict(),
        risk_level=result["risk_level"],
        reasons=result["reasons"],
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return ThreatDetectResponse(
        id=event.id,
        user_id=event.user_id,
        risk_level=event.risk_level,
        reasons=event.reasons or [],
        suspicious=result["suspicious"],
        metrics=payload.metrics,
    )
