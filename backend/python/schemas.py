from typing import Any, List, Literal, Optional
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
    verified: bool = True
    checked_signals: List[str] = []
    triggered_signals: List[str] = []
    advice: List[str] = []
    ai_used: bool = False
    analysis_mode: str = "verified_signal_only"
    provider: str = "python"
    confidence: float = 0.72
    risk_score: int = 0
    cache_hit: bool = False


class OsintRunResponse(BaseModel):
    sources_checked: int
    scraped_items: int
    detections: int
    new_alerts: int
    source_failures: int
    skipped_sources: int
    started_at: str
    finished_at: str


class OsintStatusResponse(BaseModel):
    enabled: bool
    interval_seconds: int
    telegram_configured: bool
    source_count: int
    max_sources_per_cycle: int
    max_alerts_per_cycle: int
    storage: dict
    last_cycle: Optional[dict] = None
    thread_running: bool


class OsintIntelRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=255)
    notes: Optional[str] = Field(default=None, max_length=500)
    force_refresh: bool = False


class OsintIntelResponse(BaseModel):
    query: str
    normalized_query: str
    target_type: str
    verified: bool
    risk_level: str
    risk_score: int
    reasons: List[str]
    bullets: List[str]
    checked_signals: List[str] = []
    verified_signals: List[str] = []
    data: dict[str, Any]
    ai_used: bool = False
    analysis_mode: str = "verified_multi_signal"
    minimal_ai_eligible: bool = False
    cache_hit: bool = False


class UserEventCreate(BaseModel):
    event_type: str = Field(..., min_length=2, max_length=64)
    surface: str = Field(..., min_length=2, max_length=64)
    target: Optional[str] = Field(default=None, max_length=500)
    metadata: dict[str, Any] = Field(default_factory=dict)
    user_id: Optional[str] = None


class UserEventResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    event_type: str
    surface: str
    target: Optional[str] = None
    metadata: dict[str, Any]
    created_at: Optional[str] = None


class RecommendationItem(BaseModel):
    title: str
    reason: str
    action: str
    priority: int = 1


class RecommendationResponse(BaseModel):
    user_id: Optional[str] = None
    generated_at: str
    recommendations: List[RecommendationItem]
    signals: dict[str, Any] = Field(default_factory=dict)


class LearningPathResponse(BaseModel):
    id: str
    slug: str
    title: str
    description: Optional[str] = None
    difficulty: Optional[str] = None
    track: Optional[str] = None
    version: int
    is_active: bool = True


class ModuleLessonResponse(BaseModel):
    id: str
    title: str
    content_ref: Optional[str] = None
    lesson_type: Optional[str] = None
    order_index: int = 0
    estimated_minutes: Optional[int] = None
    is_active: bool = True


class PathModuleResponse(BaseModel):
    id: str
    path_id: str
    title: str
    summary: Optional[str] = None
    order_index: int = 0
    estimated_minutes: Optional[int] = None
    is_active: bool = True
    lessons: List[ModuleLessonResponse] = []


class LearningPathDetailResponse(BaseModel):
    path: LearningPathResponse
    modules: List[PathModuleResponse]


class EnrollmentCreate(BaseModel):
    path_id: str
    user_id: Optional[str] = None


class EnrollmentResponse(BaseModel):
    id: str
    user_id: str
    path_id: str
    status: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    last_activity_at: Optional[str] = None


class LessonProgressUpdate(BaseModel):
    lesson_id: str
    status: str = Field(default="started", max_length=24)
    score: Optional[float] = None
    attempts: Optional[int] = None
    user_id: Optional[str] = None


class LessonProgressResponse(BaseModel):
    id: str
    user_id: str
    lesson_id: str
    status: str
    score: Optional[float] = None
    attempts: int
    last_activity_at: Optional[str] = None
    completed_at: Optional[str] = None


class RewardAwardRequest(BaseModel):
    reward_id: str
    source: Optional[str] = None
    points: Optional[int] = None
    user_id: Optional[str] = None


class RewardResponse(BaseModel):
    id: str
    reward_id: str
    title: str
    description: Optional[str] = None
    icon: Optional[str] = None
    points: int
    awarded_at: Optional[str] = None
    source: Optional[str] = None


class SkillScoreUpdate(BaseModel):
    skill_key: str
    score: float
    confidence: float = 0.5
    user_id: Optional[str] = None


class SkillScoreResponse(BaseModel):
    skill_key: str
    label: str
    category: Optional[str] = None
    score: float
    confidence: float
    last_assessed_at: Optional[str] = None


class MissionListItem(BaseModel):
    id: str
    title: str
    module_id: str
    module_title: Optional[str] = None
    path_id: Optional[str] = None
    path_title: Optional[str] = None
    lesson_type: Optional[str] = None
    estimated_minutes: Optional[int] = None


class MissionCompleteRequest(BaseModel):
    lesson_id: str
    status: str = Field(default="completed", max_length=24)
    score: Optional[float] = None
    attempts: Optional[int] = None
    user_id: Optional[str] = None


class ProgressSummaryResponse(BaseModel):
    enrolled_paths: int
    lessons_completed: int
    modules_completed: int
    rewards_count: int
    xp_total: int
    streak: dict[str, Any]


class DailyProgressUpdate(BaseModel):
    day: str = Field(..., min_length=8, max_length=10)
    missions_completed: int = Field(default=0, ge=0)
    xp_earned: int = Field(default=0, ge=0)
    streak_day: int = Field(default=0, ge=0)
    user_id: Optional[str] = None


class DailyProgressResponse(BaseModel):
    id: str
    user_id: str
    day: str
    missions_completed: int
    xp_earned: int
    streak_day: int
    updated_at: Optional[str] = None


class ProgramStartRequest(BaseModel):
    day: int = Field(..., ge=1, le=60)
    user_id: Optional[str] = None


class ProgramStartResponse(BaseModel):
    day: int
    updated_at: Optional[str] = None


class AiProcessRequest(BaseModel):
    task_type: str = Field(..., max_length=64)
    input: str = Field(..., min_length=3, max_length=2000)
    context: Optional[str] = Field(default=None, max_length=1000)
    max_bullets: int = Field(default=4, ge=1, le=6)


class AiProcessResponse(BaseModel):
    task_type: str
    summary: str
    bullets: List[str]
    signals: List[str]
    ai_used: bool
    cache_hit: bool = False


class AdaptiveRecommendationResponse(BaseModel):
    user_id: Optional[str] = None
    generated_at: str
    behavior: dict[str, Any]
    learning: dict[str, Any]
    recommendations: List[RecommendationItem]


class DayLabTaskResponse(BaseModel):
    id: str
    title: str
    instruction: str
    expected_type: str
    hint: str
    success_message: str
    interaction_type: str = "text"
    options: List[dict[str, str]] = []
    validation_focus: List[str] = []
    score: int = 0
    xp: int = 0
    completed: bool = False
    attempt_count: int = 0


class DayLabLearnCardResponse(BaseModel):
    id: str
    eyebrow: str
    title: str
    detail: str
    proof_point: str
    action_label: str


class DayLabMissionAssetResponse(BaseModel):
    id: str
    label: str
    value: str
    tone: str = "neutral"


class DayLabModuleResponse(BaseModel):
    day: int
    title: str
    objective: str
    scenario: str
    mentor_intro: str = ""
    example_story: str = ""
    scenario_tagline: str = ""
    operator_role: str = ""
    threat_level: str = ""
    focus: str
    difficulty: str
    estimated_minutes: int
    environment: str
    mission_brief: str = ""
    learn_points: List[str] = []
    learn_cards: List[DayLabLearnCardResponse] = []
    mission_assets: List[DayLabMissionAssetResponse] = []
    console_boot_lines: List[str] = []
    completion_badge: str = ""
    primary_action_label: str = "Start task"
    success_criteria: List[str] = []
    tasks: List[DayLabTaskResponse]
    solution_explanation: List[str]
    debrief_points: List[str] = []
    next_steps: List[str]
    kali_tools: List[str]


class DayLabStateResponse(BaseModel):
    day: int
    unlocked: bool
    completed: bool
    current_task_index: int
    score: int
    xp_earned: int
    attempts: int
    completed_task_ids: List[str]
    terminal_log: List[str]
    last_feedback: Optional[str] = None
    difficulty_band: str = "standard"


class DayLabOverviewItem(BaseModel):
    day: int
    title: str
    focus: str
    difficulty: str
    unlocked: bool
    completed: bool
    score: int
    xp_earned: int


class DayLabOverviewResponse(BaseModel):
    items: List[DayLabOverviewItem]
    recommended_day: int
    streak_message: str


class DayLabDetailResponse(BaseModel):
    module: DayLabModuleResponse
    state: DayLabStateResponse
    recommendation: str
    mentor_guidance: str = ""
    current_task_id: Optional[str] = None
    current_stage: str = "learn"


class DayLabSubmitRequest(BaseModel):
    task_id: str = Field(..., min_length=2, max_length=64)
    answer: str = Field(..., min_length=1, max_length=4000)


class DayLabSubmitResponse(BaseModel):
    accepted: bool
    task_id: str
    feedback: str
    score_delta: int
    xp_delta: int
    task_completed: bool
    lab_completed: bool
    unlocked_next_day: Optional[int] = None
    hint: Optional[str] = None
    mentor_guidance: str = ""
    retry_allowed: bool = True
    difficulty_band: str = "standard"
    progress_percent: int = 0
    next_task_title: Optional[str] = None
    celebration: Optional[str] = None
    terminal_output: List[str] = []
    state: DayLabStateResponse


class SandboxLabState(BaseModel):
    score: int
    xp_earned: int
    attempts: int
    completed: bool
    completed_objectives: List[str]
    last_feedback: Optional[str] = None
    updated_at: Optional[str] = None


class SandboxLabResponse(BaseModel):
    id: str
    title: str
    description: str
    objective: str
    practice_environment: str
    steps: List[str]
    recommended_tools: List[str]
    challenge_hint: str
    allowed_commands: List[str]
    tips: List[str]
    level: str
    track: str
    estimated_minutes: int
    objectives: List[str]
    step_hints: List[str]
    scoring: dict
    mentor_focus: str
    scenario_type: str
    vulnerability_class: str
    operator_role: str
    attack_narrative: str
    realtime_signals: List[str]
    timer_minutes: int
    branch_outcomes: List[dict]
    mode: str
    verified: bool
    separation_notice: Optional[str] = None
    state: Optional[SandboxLabState] = None


class SandboxLabsResponse(BaseModel):
    labs: List[SandboxLabResponse]
    generated_at: str


class SandboxRunRequest(BaseModel):
    lab_id: str = Field(..., min_length=2, max_length=80)
    command: str = Field(..., min_length=1, max_length=200)


class SandboxMissionFeedback(BaseModel):
    status: str
    riskLevel: str
    confidence: int
    evidenceCount: int
    operatorAction: str
    realtimeSignals: List[str]
    mistakes: List[str] = []
    betterApproach: List[str] = []
    nextAction: Optional[str] = None
    urgency: Optional[str] = None
    scenarioType: Optional[str] = None
    vulnerabilityClass: Optional[str] = None
    operatorRole: Optional[str] = None
    branchOutcome: Optional[dict] = None


class SandboxMissionStepState(BaseModel):
    step_index: int
    total_steps: int
    current_objective: str
    next_action: str
    expected_outcome: str
    cleared_objectives: List[str] = []
    available_actions: List[str] = []


class SandboxRunResponse(BaseModel):
    ok: bool
    code: str
    output: str
    explanation: str
    tips: List[str]
    evaluation: dict
    feedback: SandboxMissionFeedback
    state: SandboxLabState
    mission: Optional[SandboxMissionStepState] = None
    rewards: List[dict] = []
    completed_missions: List[str] = []
    separation_notice: Optional[str] = None


class SandboxMissionItem(BaseModel):
    id: str
    title: str
    detail: str
    points: int
    target_lab_id: str
    type: str
    completed: bool = False


class SandboxMissionListResponse(BaseModel):
    scope: str
    scope_key: str
    missions: List[SandboxMissionItem]


class MissionControlTask(BaseModel):
    id: str
    title: str
    detail: str
    reward: int
    action_type: str
    completed: bool = False
    route: Optional[str] = None
    cta_label: Optional[str] = None


class MissionControlChallenge(BaseModel):
    id: str
    title: str
    detail: str
    reward: int
    goal: int
    progress: int
    completed: bool = False


class MissionControlReward(BaseModel):
    id: str
    label: str
    detail: str
    xp: int = 0
    tone: str = "xp"
    awarded_at: int


class MissionControlBadge(BaseModel):
    id: str
    title: str
    detail: str
    icon: str
    earned: bool = True


class MissionControlHiddenChallenge(BaseModel):
    id: str
    title: str
    detail: str
    reward: int
    discovered: bool
    unlocked: bool
    completed: bool


class MissionControlHook(BaseModel):
    title: str
    detail: str
    cta_label: str
    target: str
    task_id: Optional[str] = None
    route: Optional[str] = None


class MissionControlRail(BaseModel):
    id: str
    level: str
    title: str
    objective: str
    mode: str
    payoff: str
    progress_label: str
    route: str


class MissionControlQuickAction(BaseModel):
    id: str
    title: str
    detail: str
    cta: str
    route: str
    action_type: str
    status: str = "ready"


class MissionControlReferral(BaseModel):
    code: str
    invite_count: int = 0
    signup_count: int = 0
    conversion_count: int = 0
    reward_points: int = 0
    share_url: str
    headline: str
    next_reward: str
    conversion_rate: int = 0


class MissionControlInsightCard(BaseModel):
    id: str
    title: str
    description: str
    cta: str
    share_text: str
    seo_title: str
    seo_description: str
    slug: str
    trend: str = "stable"
    proof_points: List[str] = []


class MissionControlNotificationSuggestion(BaseModel):
    id: str
    channel: str
    title: str
    detail: str
    send_window: str
    enabled: bool = True
    priority: str = "medium"
    trigger: str


class MissionControlNotificationPreferences(BaseModel):
    email_enabled: bool = True
    push_enabled: bool = True
    streak_alerts: bool = True
    referral_alerts: bool = True
    digest_enabled: bool = True
    preferred_window: str = "18:00-20:00"
    quiet_hours: str = "22:00-07:00"
    timezone: str = "UTC"


class MissionControlDebugEvent(BaseModel):
    id: str
    stage: str
    level: str
    message: str
    created_at: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)


class MissionControlDebugState(BaseModel):
    request_id: str
    generated_at: str
    auto_retry_ready: bool = True
    validation_state: str = "strict"
    error_capture: str = "enabled"
    recent_events: List[MissionControlDebugEvent] = []
    warnings: List[str] = []


class MissionControlResponse(BaseModel):
    tasks: List[MissionControlTask]
    challenge: MissionControlChallenge
    streak: int
    best_streak: int
    total_completed: int
    total_points: int
    momentum: int
    completed_days: int
    completed_sandbox_labs: int
    recent_rewards: List[MissionControlReward]
    badges: List[MissionControlBadge]
    unlocked_gates: dict[str, bool]
    hidden_challenges: List[MissionControlHiddenChallenge]
    streak_reminder: str
    curiosity_trigger: str
    next_mission_hook: MissionControlHook
    recommendations: List[RecommendationItem]
    rails: List[MissionControlRail]
    quick_actions: List[MissionControlQuickAction]
    referral: MissionControlReferral
    shareable_insights: List[MissionControlInsightCard]
    smart_notifications: List[MissionControlNotificationSuggestion]
    notification_preferences: MissionControlNotificationPreferences
    debug: MissionControlDebugState


class MissionActionRequest(BaseModel):
    action_type: Literal[
        "program_day_complete",
        "sandbox_mission_complete",
        "learn_track_started",
        "learn_track_completed",
        "mentor_open",
        "recommendation_reviewed",
        "command_center_opened",
        "mission_hidden_discovered",
        "mission_hidden_completed",
        "insight_shared",
        "referral_invite_sent",
        "referral_signup_completed",
        "notification_opened",
        "notification_preferences_updated",
    ]
    target: Optional[str] = Field(default=None, max_length=255)
    metadata: dict[str, Any] = Field(default_factory=dict)


class MissionControlPreferencesUpdate(BaseModel):
    email_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None
    streak_alerts: Optional[bool] = None
    referral_alerts: Optional[bool] = None
    digest_enabled: Optional[bool] = None
    preferred_window: Optional[str] = Field(default=None, min_length=3, max_length=32)
    quiet_hours: Optional[str] = Field(default=None, min_length=3, max_length=32)
    timezone: Optional[str] = Field(default=None, min_length=2, max_length=64)


class MissionActionResponse(BaseModel):
    ok: bool
    action_type: str
    points_awarded: int = 0
    reward: Optional[MissionControlReward] = None
    mission_control: MissionControlResponse
