from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from db import SessionLocal
from models import DailyProgress, DayLabState, SkillGraphNode, User, UserEvent, UserSkillScore, UserStreak, UserXpEvent
from schemas import (
    DayLabDetailResponse,
    DayLabLearnCardResponse,
    DayLabMissionAssetResponse,
    DayLabModuleResponse,
    DayLabOverviewItem,
    DayLabOverviewResponse,
    DayLabStateResponse,
    DayLabSubmitRequest,
    DayLabSubmitResponse,
    DayLabTaskResponse,
    SandboxLabsResponse,
    SandboxRunRequest,
    SandboxRunResponse,
    SandboxMissionListResponse,
)
from services.day_labs import FOCUS_META, PROGRAM_SEEDS, build_day_overview, get_day_module
from services.lab_validation import build_mentor_guidance, difficulty_band, validate_submission
from services.sandbox_labs import (
    build_daily_missions,
    build_weekly_missions,
    list_sandbox_labs,
    run_sandbox_command,
    try_complete_missions,
)
from services.security import InMemoryRateLimiter, build_rate_limit_key, require_jwt_user

router = APIRouter()
rate_limiter = InMemoryRateLimiter(limit=80, window_seconds=300)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def resolve_user_id(db: Session, user: dict) -> str | None:
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


def to_state_response(day_number: int, row: DayLabState | None, unlocked: bool) -> DayLabStateResponse:
    return DayLabStateResponse(
        day=day_number,
        unlocked=unlocked if row is None else bool(row.unlocked),
        completed=False if row is None else bool(row.completed),
        current_task_index=0 if row is None else int(row.current_task_index),
        score=0 if row is None else int(row.score),
        xp_earned=0 if row is None else int(row.xp_earned),
        attempts=0 if row is None else int(row.attempts),
        completed_task_ids=[] if row is None else list(row.completed_task_ids or []),
        terminal_log=[] if row is None else list(row.terminal_log or []),
        last_feedback=None if row is None else row.last_feedback,
        difficulty_band="standard",
    )


def ensure_state(db: Session, user_id: str, day_number: int) -> DayLabState:
    row = db.query(DayLabState).filter(DayLabState.user_id == user_id, DayLabState.day_number == day_number).first()
    if row:
        return row
    unlocked = 1 if day_number == 1 else 0
    row = DayLabState(user_id=user_id, day_number=day_number, unlocked=unlocked, terminal_log=[f"[day-{day_number}] lab ready"])
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def unlock_if_previous_complete(db: Session, user_id: str, day_number: int) -> bool:
    if day_number == 1:
        return True
    previous = db.query(DayLabState).filter(DayLabState.user_id == user_id, DayLabState.day_number == day_number - 1).first()
    return bool(previous and previous.completed)


def get_attempt_map(db: Session, user_id: str, day_number: int) -> dict[str, int]:
    rows = (
        db.query(UserEvent)
        .filter(UserEvent.user_id == user_id, UserEvent.event_type == "day_lab_submit", UserEvent.surface == "day_lab")
        .all()
    )
    attempt_map: dict[str, int] = {}
    day_key = str(day_number)
    for row in rows:
        metadata = row.event_metadata if isinstance(row.event_metadata, dict) else {}
        if str(metadata.get("day")) != day_key:
            continue
        task_id = str(metadata.get("task_id") or "").strip()
        if not task_id:
            continue
        attempt_map[task_id] = attempt_map.get(task_id, 0) + 1
    return attempt_map


def get_persisted_day_stage(db: Session, user_id: str, day_number: int, completed_task_count: int, is_completed: bool, current_task_id: str | None) -> str:
    if is_completed:
        return "completed"
    row = (
        db.query(UserEvent)
        .filter(
            UserEvent.user_id == user_id,
            UserEvent.surface == "day_lab_ui",
            UserEvent.target == f"day-{day_number}",
        )
        .order_by(UserEvent.created_at.desc())
        .first()
    )
    if row and isinstance(row.event_metadata, dict):
        metadata = row.event_metadata
        stage = str(row.event_metadata.get("stage") or row.event_metadata.get("current_stage") or "").strip().lower()
        event_task_id = str(metadata.get("task_id") or "").strip() or None
        if stage == "learn" and completed_task_count == 0:
            return "learn"
        if stage == "task":
            return "task"
        if stage in {"execute", "quiz"} and current_task_id and event_task_id == current_task_id:
            return "execute"
    return "learn" if completed_task_count == 0 else "task"


def build_day_terminal_output(module: dict, task, answer: str, accepted: bool) -> list[str]:
    title = str(module.get("title") or "day lab")
    focus = str(module.get("focus") or "foundation")
    day_number = int(module.get("day") or 0)
    normalized = answer.strip()
    if not normalized:
        return ["[terminal] No operator input captured."]

    if not accepted:
        return [
            f"$ {normalized}",
            "[validator] Submission rejected.",
            "[hint] Refine the action so it matches the current task and expected evidence.",
        ]

    if getattr(task, "expected_type", "") == "terminal":
        command = normalized.splitlines()[0].strip()
        first_token = command.split(" ")[0].lower() if command else "command"
        if focus == "foundation":
            if day_number == 1 and first_token in {"pwd", "ls", "whoami"}:
                signal = "whoami => analyst | pwd => /home/analyst/day1 | ls => incident-notes.md triage/ evidence/"
            elif day_number == 2 and first_token in {"pwd", "ls", "whoami"}:
                signal = "pwd => /home/operator/day-lab | whoami => analyst | ls => notes.txt tools/"
            elif day_number == 3 and first_token in {"ip", "ss"}:
                signal = "ip a => eth0 up 10.10.14.7/24 | ss -tulpn => sshd and local web service visible"
            elif day_number == 4 and first_token == "curl":
                signal = "HTTP/1.1 200 OK | server headers captured for protocol inspection"
            else:
                signal = "context captured => shell identity and local workspace verified"
        elif focus == "intel":
            if day_number == 2 and first_token == "whois":
                signal = (
                    "WHOIS => registrar=NameBright | created=2024-11-14 | abuse_contact=abuse@registrar.example | "
                    "name_servers=ns1.target-dns.net, ns2.target-dns.net | status=clientTransferProhibited"
                )
            elif day_number == 2 and first_token in {"dig", "nslookup"}:
                signal = (
                    "DNS => ns1.target-dns.net | ns2.target-dns.net | api.target.example => 203.0.113.17 | "
                    "staging.target.example => 203.0.113.29 | mx1.target.example => 198.51.100.19"
                )
            elif first_token == "whois":
                signal = "WHOIS => registrar, creation date, and registrant signals captured"
            elif first_token in {"dig", "nslookup"}:
                signal = "DNS => A, MX, or NS records captured for verification"
            else:
                signal = "header metadata => response chain and target fingerprint captured for review"
        elif focus == "appsec":
            if day_number == 3 and first_token in {"dirsearch", "ffuf", "gobuster"}:
                signal = (
                    "dirsearch => 200 /login | 301 /admin/ | 403 /backup/ | 200 /admin/api/health | "
                    "302 /auth/reset | 200 /partner/sign-in"
                )
            elif day_number == 3 and first_token == "curl":
                signal = (
                    "curl probe => 302 /login -> /auth/session | x-powered-by header captured | "
                    "/admin returns redirect chain | /admin/api/health responds 200 with internal status marker"
                )
            elif day_number == 4 and first_token == "curl":
                signal = (
                    "curl probe => HTTP/1.1 200 OK | X-Powered-By: debug-app | no X-Frame-Options | "
                    "/admin/debug reachable | reflected q parameter observed in response body | login page still accepts weak admin pattern"
                )
            elif day_number == 4 and first_token == "nikto":
                signal = (
                    "nikto => /admin/debug exposed | missing X-Frame-Options and CSP headers | "
                    "verbose debug banner reveals framework details | weak auth path remains visible on /login"
                )
            elif day_number == 5 and first_token == "curl":
                signal = (
                    "controlled chain => POST /login returns 302 /admin -> /dashboard | "
                    "Set-Cookie: session=sim-admin | /search reflects user input | /admin/debug reachable for staging telemetry"
                )
            elif day_number == 5 and first_token in {"ffuf", "gobuster"}:
                signal = (
                    "route pressure => 200 /admin | 200 /admin/debug | 302 /login | "
                    "200 /search?q=test confirms reflected parameter handling"
                )
            elif day_number == 7 and first_token in {"dirsearch", "ffuf", "gobuster"}:
                signal = (
                    "chain recon => 200 /login | 200 /admin | 200 /admin/debug | "
                    "302 /auth/session | 200 /search?q=test"
                )
            elif day_number == 7 and first_token == "curl":
                signal = (
                    "chain proof => /login accepts weak admin flow | /admin/debug returns 200 | "
                    "Set-Cookie: session=sim-admin | reflected search parameter still active"
                )
            elif day_number == 14 and first_token in {"ffuf", "dirsearch", "gobuster"}:
                signal = (
                    "multi-vector web map => 200 /partner/login | 302 /partner/dashboard | "
                    "200 /api/order/approve | 403 /internal/metrics/ui"
                )
            elif day_number == 14 and first_token in {"nmap", "nc"}:
                signal = (
                    "network pivot => 10.10.22.17:8443 open | tls service presents internal metrics banner | "
                    "partner session cookie accepted by upstream reverse proxy path"
                )
            elif day_number == 14 and first_token == "curl":
                signal = (
                    "logic chain => /partner/login issues session_partner token | internal metrics path reachable from same trust zone | "
                    "POST /api/order/approve honors client-side role=approver flag when session is valid"
                )
            elif first_token == "curl":
                signal = "application response => status, headers, and route behavior observed safely"
            elif first_token == "nikto":
                signal = "surface audit => common exposure checks simulated against the staging target"
            else:
                signal = "content discovery => high-signal route candidates identified for review"
        elif focus == "defense":
            if day_number == 6 and first_token == "journalctl":
                signal = (
                    "journalctl => auth failed for admin x11 | session issued role=admin from 10.10.14.22 | "
                    "egress connection established to 198.51.100.24:443"
                )
            elif day_number == 6 and first_token == "grep":
                signal = (
                    "grep timeline => auth failure burst | session cookie minted for admin | "
                    "network beacon seen three minutes later"
                )
            elif day_number == 6 and first_token in {"tail", "jq"}:
                signal = (
                    "telemetry stream => elevated session, outbound alert, and preserved timestamps aligned for incident triage"
                )
            elif day_number == 8 and first_token == "curl":
                signal = (
                    "decision support => /login weak admin flow still reachable | /admin/debug returns 200 | "
                    "session issuance remains possible if exploit branch is chosen"
                )
            elif day_number == 8 and first_token == "journalctl":
                signal = (
                    "decision support => auth failure burst | suspicious admin session | outbound beacon active | "
                    "containment branch would reduce dwell time immediately"
                )
            elif day_number == 8 and first_token in {"grep", "tail", "jq"}:
                signal = (
                    "risk evidence => route exposure, auth anomalies, and beacon telemetry aligned for branch comparison"
                )
            elif day_number == 9 and first_token == "journalctl":
                signal = (
                    "incident timeline => 09:09 auth failures | 09:12 admin session created | "
                    "09:14 egress beacon to 198.51.100.24 | 09:16 suspicious process start"
                )
            elif day_number == 9 and first_token == "grep":
                signal = (
                    "auth trace => repeated admin failures followed by successful token issuance and preserved event IDs"
                )
            elif day_number == 9 and first_token in {"tail", "jq"}:
                signal = (
                    "response panel => egress alerts, session evidence, and host telemetry aligned for containment and recovery"
                )
            elif day_number == 11 and first_token == "journalctl":
                signal = (
                    "partial signal => auth anomalies on web stack | privileged token recently issued | "
                    "cloud console access observed within the same decision window"
                )
            elif day_number == 11 and first_token == "grep":
                signal = (
                    "partial signal => beacon indicators and session artifacts overlap but attribution remains incomplete"
                )
            elif day_number == 11 and first_token in {"tail", "jq", "curl"}:
                signal = (
                    "scenario evolution => one signal clarified, two remain ambiguous, attacker adaptation window still open"
                )
            elif day_number == 12 and first_token in {"ssh", "wmic", "net"}:
                signal = (
                    "lateral check => APP-01 accepts the deployment credential from WKSTN-04 | "
                    "interactive access remains constrained but pivot viability is confirmed"
                )
            elif day_number == 12 and first_token == "smbclient":
                signal = (
                    "share access => \\\\APP-01\\deploy mounted | backup artifacts visible | "
                    "svc_backup reference recovered from scheduled task material"
                )
            elif day_number == 12 and first_token == "crackmapexec":
                signal = (
                    "credential sweep => deployment credential valid on APP-01 | FILE-02 denied | "
                    "APP tier now represents the highest-value lateral route"
                )
            elif day_number == 13 and first_token in {"find", "grep", "tar"}:
                signal = (
                    "sensitive path => /srv/finance/exports/finance_export_2026_q1.csv | "
                    "/srv/legal/legal-archive.zip | sync profile references outbound target 198.51.100.44"
                )
            elif day_number == 13 and first_token in {"scp", "rsync", "curl"}:
                signal = (
                    "exfil simulation => transfer logic targets finance_export_2026_q1.csv over the outbound sync route | "
                    "compression window is short, but the path is credible and high-impact"
                )
            elif day_number == 13 and first_token in {"lsof", "tcpdump", "journalctl", "jq"}:
                signal = (
                    "defense read => sync process bound to 198.51.100.44:443 | "
                    "archive access preceded outbound bytes | containment window still open if action is immediate"
                )
            elif day_number == 15 and first_token in {"curl", "journalctl", "grep"}:
                signal = (
                    "battle state => partner session still active | exposed credential path remains valid | "
                    "defensive control plane can burn one route or isolate one tier"
                )
            elif day_number == 15 and first_token in {"nmap", "ss"}:
                signal = (
                    "battle state => internal command node reachable through segmented exception | "
                    "one control action can close the route but spends the final reserve"
                )
            elif day_number == 15 and first_token == "jq":
                signal = (
                    "resource board => offense leverage medium | defense integrity medium-high | "
                    "reserve actions remaining=1 | next commitment decides board advantage"
                )
            elif first_token == "journalctl":
                signal = "journal stream => suspicious auth and service events isolated"
            elif first_token == "jq":
                signal = "JSON telemetry => alert fields normalized into triage-ready evidence"
            else:
                signal = "log sweep => suspicious event trail isolated for triage"
        elif focus == "cloud":
            if first_token == "aws":
                signal = "cloud inventory => IAM and public exposure posture surfaced for review"
            elif first_token == "kubectl":
                signal = "cluster posture => namespace and workload permissions enumerated safely"
            elif first_token == "trivy":
                signal = "image posture => vulnerability summary generated for the training image"
            else:
                signal = "container/runtime posture => configuration boundary surfaced for review"
        elif focus == "hunt":
            if first_token == "yara":
                signal = "pattern match => suspicious file artifacts flagged for hunt validation"
            elif first_token == "jq":
                signal = "timeline field extraction => candidate indicators aligned for hypothesis testing"
            else:
                signal = "hunt signal => candidate evidence extracted for hypothesis testing"
        else:
            if day_number == 10 and first_token in {"curl", "journalctl", "grep"}:
                signal = (
                    "arena signal => /admin/debug reachable | privileged session risk confirmed | "
                    "beacon telemetry active | decisive control window narrowing"
                )
            elif first_token == "nmap":
                signal = "exposure map => scoped services and ports recorded for the final deliverable"
            elif first_token == "git":
                signal = "artifact state => repository evidence and commit context captured"
            else:
                signal = "capstone signal => technical proof point recorded for the final deliverable"
        return [
            f"$ {command}",
            "[range] Safe training execution completed.",
            f"[signal] {signal}",
            f"[lab] {title} advanced with a validated operator step.",
        ]

    return [
        f"[analysis] {normalized}",
        "[validator] Submission accepted.",
        f"[lab] {title} progressed with validated reasoning.",
    ]


def upsert_skill_score(db: Session, user_id: str, focus: str, score_delta: int):
    skill_key = FOCUS_META.get(focus, {}).get("skill_key")
    if not skill_key:
        return
    node = db.query(SkillGraphNode).filter(SkillGraphNode.key == skill_key).first()
    if not node:
        return
    row = db.query(UserSkillScore).filter(UserSkillScore.user_id == user_id, UserSkillScore.skill_id == node.id).first()
    if not row:
        row = UserSkillScore(user_id=user_id, skill_id=node.id, score=0.0, confidence=0.4)
        db.add(row)
    row.score = min(100.0, float(row.score or 0.0) + max(2.0, score_delta / 10))
    row.confidence = min(0.98, float(row.confidence or 0.4) + 0.04)
    row.last_assessed_at = datetime.utcnow()


def update_daily_learning_state(db: Session, user_id: str, xp_delta: int):
    today = date.today()
    daily = db.query(DailyProgress).filter(DailyProgress.user_id == user_id, DailyProgress.day == today).first()
    if not daily:
        daily = DailyProgress(user_id=user_id, day=today, missions_completed=0, xp_earned=0, streak_day=0)
        db.add(daily)

    streak = db.query(UserStreak).filter(UserStreak.user_id == user_id).first()
    if not streak:
        streak = UserStreak(user_id=user_id, current_streak=0, best_streak=0)
        db.add(streak)

    first_activity_today = int(daily.missions_completed or 0) == 0
    if first_activity_today:
        previous_day = today - timedelta(days=1)
        if streak.last_activity_date == previous_day:
            streak.current_streak = int(streak.current_streak or 0) + 1
        elif streak.last_activity_date == today:
            streak.current_streak = max(1, int(streak.current_streak or 0))
        else:
            streak.current_streak = 1
        streak.best_streak = max(int(streak.best_streak or 0), int(streak.current_streak or 0))
        streak.last_activity_date = today
        daily.streak_day = int(streak.current_streak or 0)
    else:
        daily.streak_day = max(int(daily.streak_day or 0), int(streak.current_streak or 0))

    daily.missions_completed = int(daily.missions_completed or 0) + 1
    daily.xp_earned = int(daily.xp_earned or 0) + max(0, int(xp_delta))
    return daily, streak


def maybe_award_day_lab_badges(db: Session, user_id: str):
    completed_days = db.query(DayLabState).filter(DayLabState.user_id == user_id, DayLabState.completed == 1).count()
    thresholds = {
        1: "rookie-operator",
        7: "week-one-finisher",
        30: "thirty-day-operator",
        60: "full-program-finisher",
    }
    badge_key = thresholds.get(completed_days)
    if not badge_key:
        return
    existing = (
        db.query(UserEvent)
        .filter(UserEvent.user_id == user_id, UserEvent.event_type == "day_lab_badge_unlock")
        .all()
    )
    if any((row.event_metadata or {}).get("badge") == badge_key for row in existing):
        return
    db.add(
        UserEvent(
            user_id=user_id,
            event_type="day_lab_badge_unlock",
            surface="day_lab",
            target=badge_key,
            event_metadata={"badge": badge_key, "completed_days": completed_days},
        )
    )


@router.get("/overview", response_model=DayLabOverviewResponse)
def lab_overview(request: Request, db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    user_id = resolve_user_id(db, user)
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    rows = db.query(DayLabState).filter(DayLabState.user_id == user_id).all()
    state_map = {row.day_number: row for row in rows}
    for seed in PROGRAM_SEEDS:
        if seed.day not in state_map:
            state_map[seed.day] = ensure_state(db, user_id, seed.day)
    items = [DayLabOverviewItem(**item) for item in build_day_overview(state_map)]
    recommended_day = next((item.day for item in items if item.unlocked and not item.completed), 60)
    streak_completed = sum(1 for item in items if item.completed)
    return DayLabOverviewResponse(
        items=items,
        recommended_day=recommended_day,
        streak_message=f"You have completed {streak_completed} interactive lab day{'s' if streak_completed != 1 else ''}.",
    )


@router.get("/day/{day_number}", response_model=DayLabDetailResponse)
def get_day_lab(day_number: int, request: Request, db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    if day_number < 1 or day_number > 60:
        raise HTTPException(status_code=404, detail="Day not found")
    user_id = resolve_user_id(db, user)
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")

    row = ensure_state(db, user_id, day_number)
    unlocked = unlock_if_previous_complete(db, user_id, day_number)
    if unlocked and not row.unlocked:
        row.unlocked = 1
        db.commit()
        db.refresh(row)
    if not row.unlocked and day_number != 1:
        raise HTTPException(status_code=403, detail="Complete the previous day to unlock this lab")

    module = get_day_module(day_number)
    completed_ids = set(row.completed_task_ids or [])
    attempt_map = get_attempt_map(db, user_id, day_number)
    current_task = next((task for task in module["tasks"] if task.id not in completed_ids), None)
    mentor_guidance = build_mentor_guidance(current_task, attempt_map.get(current_task.id, 0) if current_task else 0, len(completed_ids)) if current_task else "Lab complete. Move to the next day."
    current_stage = get_persisted_day_stage(db, user_id, day_number, len(completed_ids), bool(row.completed), current_task.id if current_task else None)
    state = to_state_response(day_number, row, unlocked=True)
    state.difficulty_band = difficulty_band(sum(attempt_map.values()), len(completed_ids))
    return DayLabDetailResponse(
        module=DayLabModuleResponse(
            day=module["day"],
            title=module["title"],
            objective=module["objective"],
            scenario=module["scenario"],
            scenario_tagline=module["scenario_tagline"],
            operator_role=module["operator_role"],
            threat_level=module["threat_level"],
            focus=module["focus"],
            difficulty=module["difficulty"],
            estimated_minutes=module["estimated_minutes"],
            environment=module["environment"],
            mission_brief=module["mission_brief"],
            learn_points=list(module["learn_points"]),
            mission_assets=[
                DayLabMissionAssetResponse(
                    id=str(item.get("id") or ""),
                    label=str(item.get("label") or ""),
                    value=str(item.get("value") or ""),
                    tone=str(item.get("tone") or "neutral"),
                )
                for item in module.get("mission_assets", [])
            ],
            console_boot_lines=list(module.get("console_boot_lines", [])),
            completion_badge=str(module.get("completion_badge", "")),
            primary_action_label=module["primary_action_label"],
            success_criteria=list(module["success_criteria"]),
            tasks=[
                DayLabTaskResponse(
                    id=task.id,
                    title=task.title,
                    instruction=task.instruction,
                    expected_type=task.expected_type,
                    hint=task.hint,
                    success_message=task.success_message,
                    interaction_type=getattr(task, "interaction_type", "text"),
                    options=list(getattr(task, "options", []) or []),
                    validation_focus=list(getattr(task, "validation_focus", []) or []),
                    score=int(getattr(task, "score", 0) or 0),
                    xp=int(getattr(task, "xp", 0) or 0),
                    completed=task.id in completed_ids,
                    attempt_count=attempt_map.get(task.id, 0),
                )
                for task in module["tasks"]
            ],
            learn_cards=[
                DayLabLearnCardResponse(
                    id=str(card.get("id") or ""),
                    eyebrow=str(card.get("eyebrow") or ""),
                    title=str(card.get("title") or ""),
                    detail=str(card.get("detail") or ""),
                    proof_point=str(card.get("proof_point") or ""),
                    action_label=str(card.get("action_label") or ""),
                )
                for card in module.get("learn_cards", [])
            ],
            solution_explanation=list(module["solution_explanation"]),
            debrief_points=list(module.get("debrief_points", [])),
            next_steps=list(module["next_steps"]),
            kali_tools=list(module["kali_tools"]),
        ),
        state=state,
        recommendation=f"Focus on task {min(len(module['tasks']), row.current_task_index + 1)} and keep the answer tied to a real operator action.",
        mentor_guidance=mentor_guidance,
        current_task_id=current_task.id if current_task else None,
        current_stage=current_stage,
    )


@router.post("/day/{day_number}/submit", response_model=DayLabSubmitResponse)
def submit_day_lab(day_number: int, payload: DayLabSubmitRequest, request: Request, db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    if day_number < 1 or day_number > 60:
        raise HTTPException(status_code=404, detail="Day not found")
    user_id = resolve_user_id(db, user)
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")

    row = ensure_state(db, user_id, day_number)
    if day_number != 1 and not unlock_if_previous_complete(db, user_id, day_number) and not row.unlocked:
        raise HTTPException(status_code=403, detail="Lab is locked")

    module = get_day_module(day_number)
    task = next((item for item in module["tasks"] if item.id == payload.task_id), None)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    completed_ids = list(row.completed_task_ids or [])
    if row.completed:
        raise HTTPException(status_code=409, detail="This lab is already complete")
    current_task = next((item for item in module["tasks"] if item.id not in completed_ids), None)
    if payload.task_id not in completed_ids and current_task and payload.task_id != current_task.id:
        raise HTTPException(status_code=409, detail=f"Complete '{current_task.title}' before unlocking later tasks")
    success_count = len(completed_ids)
    prior_attempt_map = get_attempt_map(db, user_id, day_number)
    attempt_count = prior_attempt_map.get(payload.task_id, 0) + 1
    result = validate_submission(task, payload.answer, attempt_count, success_count)
    terminal_log = list(row.terminal_log or [])
    row.attempts = int(row.attempts or 0) + 1
    terminal_log.append(f"$ {payload.answer.strip()}")
    terminal_log.append(result["feedback"])
    terminal_log.append(f"[mentor] {result['mentor_guidance']}")
    terminal_output = build_day_terminal_output(module, task, payload.answer, bool(result["accepted"]))
    terminal_log.extend(terminal_output)
    terminal_log = terminal_log[-20:]
    db.add(
        UserEvent(
            user_id=user_id,
            event_type="day_lab_submit",
            surface="day_lab",
            target=f"day:{day_number}",
            event_metadata={"day": day_number, "task_id": payload.task_id, "accepted": bool(result["accepted"])},
        )
    )

    task_completed = False
    unlocked_next_day = None
    if result["accepted"] and payload.task_id not in completed_ids:
        completed_ids.append(payload.task_id)
        row.score = int(row.score or 0) + int(result["score_delta"])
        row.xp_earned = int(row.xp_earned or 0) + int(result["xp_delta"])
        row.current_task_index = len(completed_ids)
        task_completed = True
        db.add(
            UserXpEvent(
                user_id=user_id,
                source="day_lab",
                points=int(result["xp_delta"]),
                meta={"day": day_number, "task_id": payload.task_id},
            )
        )
        db.add(
            UserEvent(
                user_id=user_id,
                event_type="day_lab_task_complete",
                surface="day_lab",
                target=f"day:{day_number}",
                event_metadata={"day": day_number, "task_id": payload.task_id, "score_delta": int(result["score_delta"])},
            )
        )
        upsert_skill_score(db, user_id, module["focus"], int(result["score_delta"]))
        update_daily_learning_state(db, user_id, int(result["xp_delta"]))

    row.completed_task_ids = completed_ids
    row.terminal_log = terminal_log
    row.last_feedback = result["feedback"]
    row.completed = 1 if len(completed_ids) >= len(module["tasks"]) else 0
    row.unlocked = 1
    row.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(row)

    if row.completed and day_number < 60:
        next_row = ensure_state(db, user_id, day_number + 1)
        if not next_row.unlocked:
            next_row.unlocked = 1
            db.add(
                UserEvent(
                    user_id=user_id,
                    event_type="day_lab_unlock",
                    surface="day_lab",
                    target=f"day:{day_number + 1}",
                    event_metadata={"day": day_number + 1, "unlocked_by": day_number},
                )
            )
            db.commit()
        unlocked_next_day = day_number + 1
    if row.completed:
        maybe_award_day_lab_badges(db, user_id)
        db.commit()

    state = to_state_response(day_number, row, unlocked=True)
    state.difficulty_band = result["difficulty_band"]
    next_task = next((item for item in module["tasks"] if item.id not in completed_ids), None)
    progress_percent = round((len(completed_ids) / max(1, len(module["tasks"]))) * 100)
    celebration = None
    if row.completed:
        celebration = f"Day {day_number} fully validated. Next day unlocked."
    elif task_completed:
        celebration = f"{task.title} cleared. Continue to {next_task.title if next_task else 'final review'}."
    return DayLabSubmitResponse(
        accepted=bool(result["accepted"]),
        task_id=payload.task_id,
        feedback=result["feedback"],
        score_delta=int(result["score_delta"]),
        xp_delta=int(result["xp_delta"]),
        task_completed=task_completed,
        lab_completed=bool(row.completed),
        unlocked_next_day=unlocked_next_day,
        hint=result["hint"],
        mentor_guidance=result["mentor_guidance"],
        retry_allowed=bool(result["retry_allowed"]),
        difficulty_band=result["difficulty_band"],
        progress_percent=progress_percent,
        next_task_title=next_task.title if next_task else None,
        celebration=celebration,
        terminal_output=terminal_output,
        state=state,
    )


@router.get("/sandbox", response_model=SandboxLabsResponse)
def sandbox_labs(request: Request, db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    user_id = resolve_user_id(db, user)
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    labs = list_sandbox_labs(db, user_id)
    return SandboxLabsResponse(labs=labs, generated_at=datetime.utcnow().isoformat())


@router.post("/sandbox/run", response_model=SandboxRunResponse)
def run_sandbox(payload: SandboxRunRequest, request: Request, db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    user_id = resolve_user_id(db, user)
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    result = run_sandbox_command(db, user_id, payload.lab_id, payload.command)
    if not result.get("ok"):
        result.setdefault("rewards", [])
        result.setdefault("completed_missions", [])
        return result
    rewards, completed_ids = try_complete_missions(db, user_id, payload.lab_id, bool(result.get("state", {}).get("completed")))
    result["rewards"] = rewards
    result["completed_missions"] = completed_ids
    return result


@router.get("/sandbox/missions/daily", response_model=SandboxMissionListResponse)
def sandbox_daily_missions(request: Request, db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    user_id = resolve_user_id(db, user)
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    missions = build_daily_missions(db, user_id)
    return SandboxMissionListResponse(scope="daily", scope_key=date.today().isoformat(), missions=missions)


@router.get("/sandbox/missions/weekly", response_model=SandboxMissionListResponse)
def sandbox_weekly_missions(request: Request, db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    user_id = resolve_user_id(db, user)
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    week = date.today().isocalendar()
    scope_key = f"{week.year}-W{week.week}"
    missions = build_weekly_missions(db, user_id)
    return SandboxMissionListResponse(scope="weekly", scope_key=scope_key, missions=missions)


@router.get("/sandbox/status")
def sandbox_status(request: Request, db: Session = Depends(get_db), user: dict = Depends(require_jwt_user)):
    rate_limiter.check(build_rate_limit_key(request, user))
    user_id = resolve_user_id(db, user)
    if not user_id:
        raise HTTPException(status_code=404, detail="User not found")
    labs = list_sandbox_labs(db, user_id)
    allowed_bins = sorted({cmd.split(" ")[0] for lab in labs for cmd in lab.get("allowed_commands", []) if cmd})
    return {
        "status": "ok",
        "sandbox": {
            "enabled": True,
            "ready": True,
            "message": "Sandbox ready. Allowlist and safe simulation outputs active.",
            "allowlistHosts": ["sandbox-range.local"],
            "allowlistCidrs": ["10.0.0.0/8", "172.16.0.0/12"],
            "allowedBins": allowed_bins,
            "image": "zorvix-safe-sim",
        },
    }
