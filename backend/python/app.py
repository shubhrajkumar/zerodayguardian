import json
import logging
import os
import time
import uuid
from pathlib import Path
from datetime import datetime
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from sqlalchemy import text
from db import Base, SessionLocal, engine
from models import (
    AuthSession,
    DayLabState,
    GrowthDebugEvent,
    GrowthInsightShare,
    GrowthNotificationPreference,
    GrowthReferral,
    LearningPath,
    LabMissionState,
    ModuleLesson,
    PathModule,
    Recommendation,
    RewardsCatalog,
    ScanReport,
    ThreatEvent,
    User,
    UserLessonProgress,
    UserModuleProgress,
    UserPathEnrollment,
    UserReward,
    UserSkillScore,
    UserStreak,
    UserXpEvent,
    SkillGraphNode,
)
from schemas import (
    OsintIntelRequest,
    OsintIntelResponse,
    OsintRunResponse,
    OsintStatusResponse,
    ScanHistoryResponse,
    ScanReportResponse,
    ScanRequest,
    ThreatDetectRequest,
    ThreatDetectResponse,
    UserCreate,
    UserEventCreate,
    UserEventResponse,
    UserResponse,
    RecommendationResponse,
    EnrollmentCreate,
    EnrollmentResponse,
    LearningPathDetailResponse,
    LearningPathResponse,
    LessonProgressResponse,
    LessonProgressUpdate,
    ModuleLessonResponse,
    PathModuleResponse,
    RewardAwardRequest,
    RewardResponse,
    SkillScoreResponse,
    SkillScoreUpdate,
)
from routes.users import router as users_router
from routes.progress import router as progress_router
from routes.missions import router as missions_router
from routes.ai import router as ai_router
from routes.adaptive import router as adaptive_router
from routes.labs import router as labs_router
from routes.mission_control import router as mission_control_router
from routes.firebase_resources import router as firebase_resources_router
from osint_monitor.config import MonitorSettings, validate_monitor_settings
from osint_monitor.service import OsintMonitorService
from services.cache import TTLCache
from services.intel import OsintIntelService
from services.recommendations import build_recommendations, record_user_event
from services.scan import run_scan
from services.security import InMemoryRateLimiter, build_rate_limit_key, require_jwt_user
from services.threat import detect_threat


def load_env() -> None:
    current = Path(__file__).resolve()
    candidates = [
        current.parents[2] / ".env",
        current.parents[1] / ".env",
    ]
    for env_path in candidates:
        if env_path.exists():
            load_dotenv(env_path, override=False)


load_env()
IS_VERCEL = os.getenv("VERCEL", "").strip().lower() in {"1", "true"}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    if os.getenv("PY_SKIP_CREATE_TABLES", "").strip().lower() in {"1", "true", "yes"}:
        return
    Base.metadata.create_all(bind=engine)


def _ensure_sqlite_column(conn, table_name: str, column_name: str, column_type: str) -> None:
    columns = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
    existing = {row[1] for row in columns}
    if column_name in existing:
        return
    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))


def ensure_sqlite_schema() -> None:
    if engine.dialect.name != "sqlite":
        return
    with engine.connect() as conn:
        _ensure_sqlite_column(conn, "user_events", "event_metadata", "TEXT")
        _ensure_sqlite_column(conn, "growth_referrals", "referral_metadata", "TEXT")
        _ensure_sqlite_column(conn, "growth_notification_preferences", "preference_metadata", "TEXT")
        _ensure_sqlite_column(conn, "day_lab_states", "current_task_index", "INTEGER DEFAULT 0")
        _ensure_sqlite_column(conn, "day_lab_states", "unlocked", "INTEGER DEFAULT 0")
        _ensure_sqlite_column(conn, "day_lab_states", "completed", "INTEGER DEFAULT 0")
        _ensure_sqlite_column(conn, "day_lab_states", "score", "INTEGER DEFAULT 0")
        _ensure_sqlite_column(conn, "day_lab_states", "xp_earned", "INTEGER DEFAULT 0")
        _ensure_sqlite_column(conn, "day_lab_states", "attempts", "INTEGER DEFAULT 0")
        _ensure_sqlite_column(conn, "day_lab_states", "completed_task_ids", "TEXT")
        _ensure_sqlite_column(conn, "day_lab_states", "terminal_log", "TEXT")
        _ensure_sqlite_column(conn, "day_lab_states", "last_feedback", "TEXT")
        _ensure_sqlite_column(conn, "day_lab_states", "updated_at", "DATETIME")
        _ensure_sqlite_column(conn, "daily_progress", "missions_completed", "INTEGER DEFAULT 0")
        _ensure_sqlite_column(conn, "daily_progress", "xp_earned", "INTEGER DEFAULT 0")
        _ensure_sqlite_column(conn, "daily_progress", "streak_day", "INTEGER DEFAULT 0")
        _ensure_sqlite_column(conn, "user_streaks", "current_streak", "INTEGER DEFAULT 0")
        _ensure_sqlite_column(conn, "user_streaks", "best_streak", "INTEGER DEFAULT 0")
        _ensure_sqlite_column(conn, "user_streaks", "last_activity_date", "DATE")
        _ensure_sqlite_column(conn, "user_streaks", "updated_at", "DATETIME")
        conn.execute(text("UPDATE user_events SET event_metadata = metadata WHERE event_metadata IS NULL AND metadata IS NOT NULL"))
        conn.execute(text("UPDATE growth_referrals SET referral_metadata = metadata WHERE referral_metadata IS NULL AND metadata IS NOT NULL"))
        conn.execute(text("UPDATE growth_notification_preferences SET preference_metadata = metadata WHERE preference_metadata IS NULL AND metadata IS NOT NULL"))
        conn.commit()


app = FastAPI(title="ZeroDay Guardian Security API", version="0.1.0")
intel_cache = TTLCache(ttl_seconds=int(os.getenv("PY_OSINT_CACHE_TTL_SECONDS", "900")))
recommendations_cache = TTLCache(ttl_seconds=int(os.getenv("PY_RECOMMENDATIONS_CACHE_TTL_SECONDS", "120")))
intel_service = OsintIntelService()
intel_rate_limiter = InMemoryRateLimiter(
    limit=int(os.getenv("PY_OSINT_RATE_LIMIT", "30")),
    window_seconds=int(os.getenv("PY_OSINT_RATE_LIMIT_WINDOW_SECONDS", "300")),
)
osint_settings = MonitorSettings()
osint_logger = logging.getLogger("osint_monitor")
if not any(isinstance(handler, logging.FileHandler) and getattr(handler, "baseFilename", "") == str(osint_settings.log_file) for handler in osint_logger.handlers):
    try:
        osint_settings.log_file.parent.mkdir(parents=True, exist_ok=True)
        handler = logging.FileHandler(osint_settings.log_file, encoding="utf-8")
    except OSError:
        handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"))
    osint_logger.setLevel(logging.INFO)
    osint_logger.addHandler(handler)
osint_monitor = OsintMonitorService(osint_settings)


def _resolve_cors_origins() -> tuple[list[str], str | None]:
    default_value = "" if os.getenv("NODE_ENV", "production") == "production" else "http://localhost:8080,http://127.0.0.1:8080"
    raw = [origin.strip() for origin in os.getenv("PY_CORS_ORIGINS", default_value).split(",")]
    origins = [origin for origin in raw if origin and origin != "*"]
    if not origins and default_value:
        return ["http://localhost:8080", "http://127.0.0.1:8080"], None
    if any(origin == "*" for origin in raw):
        return origins, ".*"
    return origins, None


cors_origins, cors_origin_regex = _resolve_cors_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_logger = logging.getLogger("zdg.pyapi")
if not api_logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"))
    api_logger.setLevel(logging.INFO)
    api_logger.addHandler(handler)


@app.middleware("http")
async def request_observability(request: Request, call_next):
    request_id = request.headers.get("X-Request-Id") or f"py-{uuid.uuid4().hex[:16]}"
    request.state.request_id = request_id
    started_at = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
        api_logger.exception("Unhandled API exception request_id=%s method=%s path=%s duration_ms=%s", request_id, request.method, request.url.path, duration_ms)
        raise
    duration_ms = round((time.perf_counter() - started_at) * 1000, 2)
    response.headers["X-Request-Id"] = request_id
    response.headers["X-Response-Time"] = f"{duration_ms}ms"
    if duration_ms > 1200:
        api_logger.warning("Slow Python API request request_id=%s method=%s path=%s status=%s duration_ms=%s", request_id, request.method, request.url.path, response.status_code, duration_ms)
    else:
        api_logger.info("Python API request request_id=%s method=%s path=%s status=%s duration_ms=%s", request_id, request.method, request.url.path, response.status_code, duration_ms)
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    request_id = getattr(request.state, "request_id", "")
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation failed",
            "code": "validation_failed",
            "message": "Request validation failed",
            "request_id": request_id,
            "details": exc.errors(),
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", "")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": str(exc.detail or "Request failed"),
            "code": "http_error",
            "message": str(exc.detail or "Request failed"),
            "request_id": request_id,
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "")
    api_logger.exception("Fatal Python API error request_id=%s path=%s", request_id, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error": "We hit a temporary backend issue",
            "code": "internal_error",
            "message": "Your data is safe. Please retry in a moment while the Python service recovers.",
            "request_id": request_id,
            "retryable": True,
        },
    )


@app.on_event("startup")
def startup():
    create_tables()
    ensure_sqlite_schema()
    api_logger.info(
        "Python API startup complete port=%s database=%s cors=%s",
        os.getenv("PY_API_PORT", "8000"),
        os.getenv("PY_DATABASE_URL", os.getenv("DATABASE_URL", "sqlite:///./local.db")),
        ",".join(cors_origins) if cors_origins else "*",
    )
    for warning in validate_monitor_settings(osint_settings):
        print(f"[OSINT Monitor Warning] {warning}")
    if IS_VERCEL:
        api_logger.info("Skipping OSINT monitor background worker on Vercel serverless runtime")
    else:
        osint_monitor.start()


@app.on_event("shutdown")
def shutdown():
    osint_monitor.stop()


@app.get("/pyapi/health")
def health():
    return {
        "ok": True,
        "service": "zeroday-guardian-pyapi",
        "port": int(os.getenv("PY_API_PORT", "8000")),
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/health")
def root_health():
    return {
        "ok": True,
        "service": "zeroday-guardian-pyapi",
        "port": int(os.getenv("PY_API_PORT", "8000")),
        "timestamp": datetime.utcnow().isoformat(),
    }


def enforce_rate_limit(request: Request, user: dict = Depends(require_jwt_user)) -> dict:
    intel_rate_limiter.check(build_rate_limit_key(request, user))
    return user


def resolve_user_id(db: Session, user: dict, requested_user_id: str | None) -> str | None:
    if requested_user_id:
        return requested_user_id
    external_id = str(user.get("sub") or "").strip()
    email = str(user.get("email") or "").strip().lower()
    if external_id:
        match = db.query(User).filter(User.external_id == external_id).first()
        if match:
            return match.id
    if email:
        match = db.query(User).filter(User.email == email).first()
        if match:
            return match.id
    return None


def ensure_user_id(db: Session, user: dict, requested_user_id: str | None = None) -> str | None:
    resolved = resolve_user_id(db, user, requested_user_id)
    if resolved:
        return resolved

    email = str(user.get("email") or "").strip().lower()
    if not email:
        return None

    external_id = str(requested_user_id or user.get("sub") or "").strip() or None
    name = str(user.get("name") or user.get("preferred_username") or email).strip() or email

    existing = None
    if external_id:
        existing = db.query(User).filter(User.external_id == external_id).first()
    if not existing:
        existing = db.query(User).filter(User.email == email).first()
    if existing:
        if external_id and existing.external_id != external_id:
            existing.external_id = external_id
            db.commit()
            db.refresh(existing)
        return existing.id

    db_user = User(email=email, name=name, external_id=external_id)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user.id


@app.post("/pyapi/users", response_model=UserResponse)
def create_user(payload: UserCreate, db: Session = Depends(get_db), user: dict = Depends(enforce_rate_limit)):
    if payload.external_id and payload.external_id != user.get("sub"):
        raise HTTPException(status_code=403, detail="External id mismatch")
    if str(payload.email).strip().lower() != str(user.get("email") or "").strip().lower():
        raise HTTPException(status_code=403, detail="Email mismatch")
    existing = None
    external_id = str(payload.external_id or user.get("sub") or "").strip() or None
    if external_id:
        existing = db.query(User).filter(User.external_id == external_id).first()
    if not existing:
        existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        if external_id and existing.external_id != external_id:
            existing.external_id = external_id
            db.commit()
            db.refresh(existing)
        return existing
    db_user = User(email=payload.email, name=payload.name, external_id=external_id)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@app.get("/pyapi/users/{user_id}", response_model=UserResponse)
def get_user(user_id: str, db: Session = Depends(get_db), user: dict = Depends(enforce_rate_limit)):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


@app.post("/pyapi/scan", response_model=ScanReportResponse)
def scan_target(payload: ScanRequest, db: Session = Depends(get_db), user: dict = Depends(enforce_rate_limit)):
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
def scan_history(user_id: str | None = None, limit: int = 8, db: Session = Depends(get_db), user: dict = Depends(enforce_rate_limit)):
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
def scan_report(report_id: str, db: Session = Depends(get_db), user: dict = Depends(enforce_rate_limit)):
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
def threat_detect(payload: ThreatDetectRequest, db: Session = Depends(get_db), user: dict = Depends(enforce_rate_limit)):
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
        verified=bool(result.get("verified", True)),
        checked_signals=result.get("checked_signals", []),
        triggered_signals=result.get("triggered_signals", []),
        advice=result.get("advice", []),
        ai_used=bool(result.get("ai_used", False)),
        analysis_mode=str(result.get("analysis_mode", "verified_signal_only")),
        provider=str(result.get("provider", "python")),
        confidence=float(result.get("confidence", 0.72)),
        risk_score=int(result.get("risk_score", 0)),
        cache_hit=bool(result.get("cache_hit", False)),
    )


@app.post("/pyapi/osint/intel", response_model=OsintIntelResponse)
def osint_intel(payload: OsintIntelRequest, user: dict = Depends(enforce_rate_limit)):
    cache_key = f"{payload.query.strip().lower()}::{str(payload.notes or '').strip().lower()}"
    if not payload.force_refresh:
        cached = intel_cache.get(cache_key)
        if cached:
            return {**cached, "cache_hit": True}

    report = intel_service.analyze(payload.query, payload.notes)
    intel_cache.set(cache_key, report)
    return {**report, "cache_hit": False}


@app.get("/pyapi/osint/status", response_model=OsintStatusResponse)
def osint_status(user: dict = Depends(enforce_rate_limit)):
    return osint_monitor.status()


@app.post("/pyapi/osint/run", response_model=OsintRunResponse)
def osint_run(user: dict = Depends(enforce_rate_limit)):
    return osint_monitor.run_cycle()


app.include_router(users_router, prefix="/pyapi/users", tags=["users"])
app.include_router(progress_router, prefix="/pyapi/progress", tags=["progress"])
app.include_router(missions_router, prefix="/pyapi/missions", tags=["missions"])
app.include_router(ai_router, prefix="/pyapi/ai", tags=["ai"])
app.include_router(adaptive_router, prefix="/pyapi/adaptive", tags=["adaptive"])
app.include_router(labs_router, prefix="/pyapi/labs", tags=["labs"])
app.include_router(mission_control_router, prefix="/pyapi/mission-control", tags=["mission-control"])
app.include_router(firebase_resources_router, prefix="/pyapi", tags=["firebase-resources"])


@app.get("/pyapi/learning/paths", response_model=list[LearningPathResponse])
def list_learning_paths(db: Session = Depends(get_db), user: dict = Depends(enforce_rate_limit)):
    rows = db.query(LearningPath).filter(LearningPath.is_active == 1).order_by(LearningPath.created_at.desc()).limit(50).all()
    return [
        LearningPathResponse(
            id=row.id,
            slug=row.slug,
            title=row.title,
            description=row.description,
            difficulty=row.difficulty,
            track=row.track,
            version=row.version,
            is_active=bool(row.is_active),
        )
        for row in rows
    ]


@app.get("/pyapi/learning/paths/{path_id}", response_model=LearningPathDetailResponse)
def get_learning_path(path_id: str, db: Session = Depends(get_db), user: dict = Depends(enforce_rate_limit)):
    path = db.query(LearningPath).filter(LearningPath.id == path_id).first()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")
    modules = db.query(PathModule).filter(PathModule.path_id == path_id).order_by(PathModule.order_index.asc()).all()
    lessons = db.query(ModuleLesson).filter(ModuleLesson.module_id.in_([m.id for m in modules])).order_by(ModuleLesson.order_index.asc()).all() if modules else []
    lessons_by_module: dict[str, list[ModuleLessonResponse]] = {}
    for lesson in lessons:
        lessons_by_module.setdefault(lesson.module_id, []).append(
            ModuleLessonResponse(
                id=lesson.id,
                title=lesson.title,
                content_ref=lesson.content_ref,
                lesson_type=lesson.lesson_type,
                order_index=lesson.order_index,
                estimated_minutes=lesson.estimated_minutes,
                is_active=bool(lesson.is_active),
            )
        )
    return LearningPathDetailResponse(
        path=LearningPathResponse(
            id=path.id,
            slug=path.slug,
            title=path.title,
            description=path.description,
            difficulty=path.difficulty,
            track=path.track,
            version=path.version,
            is_active=bool(path.is_active),
        ),
        modules=[
            PathModuleResponse(
                id=module.id,
                path_id=module.path_id,
                title=module.title,
                summary=module.summary,
                order_index=module.order_index,
                estimated_minutes=module.estimated_minutes,
                is_active=bool(module.is_active),
                lessons=lessons_by_module.get(module.id, []),
            )
            for module in modules
        ],
    )


@app.post("/pyapi/learning/enrollments", response_model=EnrollmentResponse)
def create_enrollment(payload: EnrollmentCreate, db: Session = Depends(get_db), user: dict = Depends(enforce_rate_limit)):
    resolved_user_id = resolve_user_id(db, user, payload.user_id)
    if not resolved_user_id:
        raise HTTPException(status_code=400, detail="User id required")
    path = db.query(LearningPath).filter(LearningPath.id == payload.path_id, LearningPath.is_active == 1).first()
    if not path:
        raise HTTPException(status_code=404, detail="Learning path not found")
    existing = db.query(UserPathEnrollment).filter(UserPathEnrollment.user_id == resolved_user_id, UserPathEnrollment.path_id == payload.path_id).first()
    if existing:
        return EnrollmentResponse(
            id=existing.id,
            user_id=existing.user_id,
            path_id=existing.path_id,
            status=existing.status,
            started_at=str(existing.started_at) if existing.started_at else None,
            completed_at=str(existing.completed_at) if existing.completed_at else None,
            last_activity_at=str(existing.last_activity_at) if existing.last_activity_at else None,
        )
    enrollment = UserPathEnrollment(user_id=resolved_user_id, path_id=payload.path_id, status="active")
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return EnrollmentResponse(
        id=enrollment.id,
        user_id=enrollment.user_id,
        path_id=enrollment.path_id,
        status=enrollment.status,
        started_at=str(enrollment.started_at) if enrollment.started_at else None,
        completed_at=str(enrollment.completed_at) if enrollment.completed_at else None,
        last_activity_at=str(enrollment.last_activity_at) if enrollment.last_activity_at else None,
    )


@app.post("/pyapi/learning/progress/lesson", response_model=LessonProgressResponse)
def update_lesson_progress(payload: LessonProgressUpdate, db: Session = Depends(get_db), user: dict = Depends(enforce_rate_limit)):
    resolved_user_id = resolve_user_id(db, user, payload.user_id)
    if not resolved_user_id:
        raise HTTPException(status_code=400, detail="User id required")
    lesson = db.query(ModuleLesson).filter(ModuleLesson.id == payload.lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    progress = db.query(UserLessonProgress).filter(UserLessonProgress.user_id == resolved_user_id, UserLessonProgress.lesson_id == payload.lesson_id).first()
    if not progress:
        progress = UserLessonProgress(user_id=resolved_user_id, lesson_id=payload.lesson_id)
        db.add(progress)
    progress.status = payload.status
    if payload.score is not None:
        progress.score = payload.score
    if payload.attempts is not None:
        progress.attempts = payload.attempts
    progress.last_activity_at = datetime.utcnow()
    if payload.status == "completed":
        progress.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(progress)

    # update module progress
    module_id = lesson.module_id
    total_lessons = db.query(ModuleLesson).filter(ModuleLesson.module_id == module_id, ModuleLesson.is_active == 1).count()
    lesson_id_rows = db.query(ModuleLesson.id).filter(ModuleLesson.module_id == module_id, ModuleLesson.is_active == 1).all()
    lesson_ids = [row[0] for row in lesson_id_rows]
    completed_lessons = (
        db.query(UserLessonProgress)
        .filter(UserLessonProgress.user_id == resolved_user_id, UserLessonProgress.lesson_id.in_(lesson_ids))
        .filter(UserLessonProgress.status == "completed")
        .count()
    ) if lesson_ids else 0
    progress_pct = 0.0 if total_lessons == 0 else round((completed_lessons / total_lessons) * 100, 2)
    module_progress = db.query(UserModuleProgress).filter(UserModuleProgress.user_id == resolved_user_id, UserModuleProgress.module_id == module_id).first()
    if not module_progress:
        module_progress = UserModuleProgress(user_id=resolved_user_id, module_id=module_id)
        db.add(module_progress)
    module_progress.progress_pct = progress_pct
    module_progress.status = "completed" if progress_pct >= 100 else "in_progress"
    module_progress.last_activity_at = datetime.utcnow()
    if module_progress.status == "completed":
        module_progress.completed_at = datetime.utcnow()
    db.commit()

    return LessonProgressResponse(
        id=progress.id,
        user_id=progress.user_id,
        lesson_id=progress.lesson_id,
        status=progress.status,
        score=progress.score,
        attempts=progress.attempts,
        last_activity_at=str(progress.last_activity_at) if progress.last_activity_at else None,
        completed_at=str(progress.completed_at) if progress.completed_at else None,
    )


@app.post("/pyapi/rewards/award", response_model=RewardResponse)
def award_reward(payload: RewardAwardRequest, db: Session = Depends(get_db), user: dict = Depends(enforce_rate_limit)):
    resolved_user_id = resolve_user_id(db, user, payload.user_id)
    if not resolved_user_id:
        raise HTTPException(status_code=400, detail="User id required")
    reward = db.query(RewardsCatalog).filter(RewardsCatalog.id == payload.reward_id, RewardsCatalog.is_active == 1).first()
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    record = UserReward(user_id=resolved_user_id, reward_id=reward.id, source=payload.source)
    db.add(record)
    points = int(payload.points if payload.points is not None else reward.points or 0)
    if points:
        db.add(UserXpEvent(user_id=resolved_user_id, source=payload.source or "reward", points=points, meta={"reward_id": reward.id}))
    db.commit()
    db.refresh(record)
    return RewardResponse(
        id=record.id,
        reward_id=reward.id,
        title=reward.title,
        description=reward.description,
        icon=reward.icon,
        points=points,
        awarded_at=str(record.awarded_at) if record.awarded_at else None,
        source=record.source,
    )


@app.get("/pyapi/rewards", response_model=list[RewardResponse])
def list_rewards(db: Session = Depends(get_db), user: dict = Depends(enforce_rate_limit)):
    resolved_user_id = resolve_user_id(db, user, None)
    if not resolved_user_id:
        return []
    rows = (
        db.query(UserReward, RewardsCatalog)
        .join(RewardsCatalog, RewardsCatalog.id == UserReward.reward_id)
        .filter(UserReward.user_id == resolved_user_id)
        .order_by(UserReward.awarded_at.desc())
        .limit(50)
        .all()
    )
    responses: list[RewardResponse] = []
    for reward_row, catalog_row in rows:
        responses.append(
            RewardResponse(
                id=reward_row.id,
                reward_id=catalog_row.id,
                title=catalog_row.title,
                description=catalog_row.description,
                icon=catalog_row.icon,
                points=catalog_row.points,
                awarded_at=str(reward_row.awarded_at) if reward_row.awarded_at else None,
                source=reward_row.source,
            )
        )
    return responses


@app.post("/pyapi/skills/score", response_model=SkillScoreResponse)
def update_skill_score(payload: SkillScoreUpdate, db: Session = Depends(get_db), user: dict = Depends(enforce_rate_limit)):
    resolved_user_id = resolve_user_id(db, user, payload.user_id)
    if not resolved_user_id:
        raise HTTPException(status_code=400, detail="User id required")
    node = db.query(SkillGraphNode).filter(SkillGraphNode.key == payload.skill_key).first()
    if not node:
        raise HTTPException(status_code=404, detail="Skill not found")
    score = db.query(UserSkillScore).filter(UserSkillScore.user_id == resolved_user_id, UserSkillScore.skill_id == node.id).first()
    if not score:
        score = UserSkillScore(user_id=resolved_user_id, skill_id=node.id)
        db.add(score)
    score.score = float(payload.score)
    score.confidence = float(payload.confidence)
    score.last_assessed_at = datetime.utcnow()
    db.commit()
    return SkillScoreResponse(
        skill_key=node.key,
        label=node.label,
        category=node.category,
        score=score.score,
        confidence=score.confidence,
        last_assessed_at=str(score.last_assessed_at) if score.last_assessed_at else None,
    )


@app.post("/pyapi/events", response_model=UserEventResponse)
def record_event(payload: UserEventCreate, db: Session = Depends(get_db), user: dict = Depends(enforce_rate_limit)):
    resolved_user_id = ensure_user_id(db, user, payload.user_id)
    event = record_user_event(
        db=db,
        user_id=resolved_user_id,
        event_type=payload.event_type,
        surface=payload.surface,
        target=payload.target,
        metadata=payload.metadata,
    )
    return UserEventResponse(
        id=event.id,
        user_id=event.user_id,
        event_type=event.event_type,
        surface=event.surface,
        target=event.target,
        metadata=event.event_metadata or {},
        created_at=str(event.created_at),
    )


@app.get("/pyapi/recommendations", response_model=RecommendationResponse)
def recommendations(db: Session = Depends(get_db), user: dict = Depends(enforce_rate_limit)):
    resolved_user_id = resolve_user_id(db, user, None)
    cache_key = f"recs::{resolved_user_id or 'anon'}"
    cached = recommendations_cache.get(cache_key)
    if cached:
        return cached
    recs, signals = build_recommendations(db, resolved_user_id)
    payload = RecommendationResponse(
        user_id=resolved_user_id,
        generated_at=datetime.utcnow().isoformat(),
        recommendations=recs,
        signals=signals,
    )
    recommendations_cache.set(cache_key, payload)
    return payload


@app.get("/pyapi/recommendations/stream")
def recommendations_stream(db: Session = Depends(get_db), user: dict = Depends(enforce_rate_limit)):
    resolved_user_id = resolve_user_id(db, user, None)

    def event_stream():
        recs, signals = build_recommendations(db, resolved_user_id)
        payload = {
            "user_id": resolved_user_id,
            "generated_at": datetime.utcnow().isoformat(),
            "recommendations": recs,
            "signals": signals,
        }
        yield f"event: recommendations\nid: {int(time.time())}\ndata: {json.dumps(payload)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
