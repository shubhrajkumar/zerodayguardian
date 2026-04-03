from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
import hashlib
import random
from typing import Any

from sqlalchemy.orm import Session

from models import LabMissionState, UserEvent, UserXpEvent


@dataclass(frozen=True)
class SandboxLab:
    id: str
    title: str
    description: str
    objective: str
    practice_environment: str
    steps: list[str]
    recommended_tools: list[str]
    challenge_hint: str
    allowed_commands: list[str]
    tips: list[str]
    level: str
    track: str
    estimated_minutes: int
    objectives: list[str]
    step_hints: list[str]
    scoring: dict[str, Any]
    mentor_focus: str
    scenario_type: str
    vulnerability_class: str
    operator_role: str
    attack_narrative: str
    realtime_signals: list[str]
    timer_minutes: int
    branch_outcomes: list[dict]


def _seed_for(user_id: str, lab_id: str, day_key: str) -> int:
    raw = f"{user_id}:{lab_id}:{day_key}".encode("utf-8")
    return int(hashlib.sha256(raw).hexdigest()[:12], 16)


def _day_key() -> str:
    today = date.today()
    return f"{today.year}-{today.month:02d}-{today.day:02d}"


def _random_ip(rng: random.Random, base: str) -> str:
    return f"{base}.{rng.randint(10, 240)}"


def _token_snippet(rng: random.Random) -> str:
    alphabet = "abcdef0123456789"
    return "".join(rng.choice(alphabet) for _ in range(18))


def _campaign_id(rng: random.Random) -> str:
    return f"camp-{rng.randint(120, 980)}-{rng.choice(['alpha', 'delta', 'omega'])}"


def _lab_catalog(user_id: str) -> dict[str, SandboxLab]:
    lateral_ctx = _lab_context(user_id, "lateral-movement")
    c2_ctx = _lab_context(user_id, "c2-trace")

    return {
        "lateral-movement": SandboxLab(
            id="lateral-movement",
            title="Lateral Movement Containment Drill",
            description="Trace lateral movement inside a segmented lab network and document containment actions.",
            objective="Map east-west movement clues, validate access paths, and issue a containment note.",
            practice_environment=f"Isolated lab segment {lateral_ctx['segment']}.0/24 with {lateral_ctx['host']} and {lateral_ctx['jump']}.",
            steps=[
                "Map the internal segment to identify pivot candidates.",
                "Inspect SMB exposure to confirm credential reuse risk.",
                "Attempt a controlled pivot and capture evidence.",
                "Produce a containment and remediation summary.",
            ],
            recommended_tools=["nmap", "smbclient", "netstat", "ssh"],
            challenge_hint="Prove the lateral path, then lock down the exposure with a single containment action.",
            allowed_commands=[
                "help",
                "status",
                "next",
                "map segment",
                "inspect smb",
                f"pivot {lateral_ctx['jump']}",
                "dump creds",
                "report lateral",
                "complete",
            ],
            tips=[
                "Lateral movement starts with weak segmentation and shared credentials.",
                "Containment should isolate the pivot host and rotate affected credentials.",
            ],
            level="advanced",
            track="offense-defense",
            estimated_minutes=16,
            objectives=[
                "Confirm pivot candidate",
                "Validate credential reuse risk",
                "Execute controlled pivot",
                "Write containment note",
            ],
            step_hints=[
                "Start with a segment map to discover the pivot host.",
                "SMB share exposure hints at credential reuse.",
                "Pivoting is simulated; focus on evidence capture.",
            ],
            scoring={"maxPoints": 180, "commandPoints": 22, "completionBonus": 42, "badges": ["Lateral Tracker", "Containment Lead"]},
            mentor_focus="Guide the learner through lateral-movement reasoning and evidence-based containment.",
            scenario_type="lateral-movement-simulation",
            vulnerability_class="credential-reuse-and-segmentation-gap",
            operator_role="incident-response-operator",
            attack_narrative="A staged attacker is moving laterally from a compromised workstation to a jump server.",
            realtime_signals=["pivot-path", "smb-exposure", "credential-reuse", "containment-ready"],
            timer_minutes=16,
            branch_outcomes=[
                {"id": "segmentation-fix", "title": "Segmentation Fix", "condition": "Report the pivot path and segment break.", "reward": "Boost containment score."},
                {"id": "credential-reset", "title": "Credential Reset", "condition": "Prioritize credential rotation in the report.", "reward": "Unlock response badge."},
            ],
        ),
        "api-token-exposure": SandboxLab(
            id="api-token-exposure",
            title="API Token Exposure Mission",
            description="Investigate a simulated API for credential leakage and scope misuse.",
            objective="Identify exposed token paths and propose a containment plus hardening plan.",
            practice_environment="Simulated API tier: api-sim.local with gateway and debug surfaces.",
            steps=[
                "Inspect gateway logs and boundary exposure.",
                "Validate token leakage in debug responses.",
                "Assess token scope and replay risk.",
                "Deliver a containment and remediation summary.",
            ],
            recommended_tools=["curl", "jwt-inspector", "gateway logs", "schema diff"],
            challenge_hint="Prove one leak path and one privilege boundary fix.",
            allowed_commands=[
                "help",
                "status",
                "next",
                "inspect gateway",
                "check debug endpoint",
                "trace token scope",
                "report api-risk",
                "complete",
            ],
            tips=[
                "Token leaks are boundary problems more than storage problems.",
                "Containment starts with rotation and scope reduction.",
            ],
            level="advanced",
            track="defensive-api",
            estimated_minutes=17,
            objectives=[
                "Identify leak source",
                "Confirm scope overreach",
                "Pick containment action",
                "Write remediation summary",
            ],
            step_hints=[
                "Start with the gateway boundary for exposure clues.",
                "Scope analysis confirms how far leaked tokens can go.",
                "Finish with rotation, revocation, and response minimization.",
            ],
            scoring={"maxPoints": 190, "commandPoints": 24, "completionBonus": 44, "badges": ["API Watcher", "Token Guardian"]},
            mentor_focus="Guide token leak validation and least-privilege reasoning.",
            scenario_type="api-credential-exposure",
            vulnerability_class="token-overexposure",
            operator_role="api-security-analyst",
            attack_narrative="A staging API release appears to leak tokens through a debug path.",
            realtime_signals=["debug-surface", "token-leak", "scope-overreach", "revocation-needed"],
            timer_minutes=17,
            branch_outcomes=[
                {"id": "revocation-now", "title": "Revocation Now", "condition": "Rotate tokens immediately after leak confirmation.", "reward": "Boost containment score."},
                {"id": "least-privilege", "title": "Least Privilege", "condition": "Lead with scope reduction in the report.", "reward": "Boost architecture score."},
            ],
        ),
        "phishing-sandbox": SandboxLab(
            id="phishing-sandbox",
            title="Phishing Containment Sandbox",
            description="Triages phishing samples and delivers a safe containment plan.",
            objective="Identify phishing indicators, extract malicious links, and write the triage response.",
            practice_environment="Isolated mail sandbox with simulated inbox samples.",
            steps=[
                "Inspect sender identity and alignment.",
                "Extract suspicious links safely.",
                "Assess urgency and credential harvesting intent.",
                "Deliver a containment + prevention summary.",
            ],
            recommended_tools=["email header review", "link analyzer", "sandbox preview"],
            challenge_hint="Detect one hidden lure and add a preventive control.",
            allowed_commands=[
                "help",
                "status",
                "next",
                "analyze sample-1",
                "extract urls sample-1",
                "analyze sample-2",
                "report phishing",
                "complete",
            ],
            tips=[
                "Sender alignment failures often signal phishing.",
                "Always pair containment with prevention controls.",
            ],
            level="intermediate",
            track="defensive-email",
            estimated_minutes=14,
            objectives=[
                "Classify high-risk sample",
                "Extract suspicious links",
                "Clear low-risk sample",
                "Write containment note",
            ],
            step_hints=[
                "Start with the high-risk sample to protect users.",
                "Extract links before opening attachments.",
                "Close with one containment + one prevention action.",
            ],
            scoring={"maxPoints": 160, "commandPoints": 20, "completionBonus": 38, "badges": ["Phish Triage", "Inbox Defender"]},
            mentor_focus="Coach the learner through phishing triage logic and safe reporting.",
            scenario_type="credential-harvest-phish",
            vulnerability_class="brand-impersonation",
            operator_role="email-threat-analyst",
            attack_narrative="Finance received an urgent invoice email that may be credential harvesting.",
            realtime_signals=["sender-mismatch", "urgent-language", "malicious-links", "mail-alignment"],
            timer_minutes=14,
            branch_outcomes=[
                {"id": "rapid-containment", "title": "Rapid Containment", "condition": "Quarantine the high-risk sample first.", "reward": "Boost response confidence."},
                {"id": "false-positive-guard", "title": "False Positive Guard", "condition": "Explain why sample-2 is low risk.", "reward": "Improve analyst trust."},
            ],
        ),
        "incident-hunt": SandboxLab(
            id="incident-hunt",
            title="Incident Hunt Correlation",
            description="Correlate endpoint, identity, and proxy signals to confirm an incident.",
            objective="Prioritize the highest-risk signal and deliver an IR-ready summary.",
            practice_environment="Simulated SOC telemetry: endpoint-sim, auth-sim, proxy-sim.",
            steps=[
                "Review the initial alert for severity.",
                "Correlate identity evidence for lateral risk.",
                "Correlate proxy evidence for beaconing.",
                "Write the incident handoff summary.",
            ],
            recommended_tools=["jq", "grep", "timeline review", "SIEM filter"],
            challenge_hint="Correlate two signals before deciding containment.",
            allowed_commands=[
                "help",
                "status",
                "next",
                "review alert-7",
                "correlate identity",
                "correlate proxy",
                "contain host-24",
                "report handoff",
                "complete",
            ],
            tips=[
                "Correlate at least two signals before escalation.",
                "Containment should preserve evidence and prevent spread.",
            ],
            level="pro",
            track="defensive-detection",
            estimated_minutes=20,
            objectives=[
                "Validate primary alert",
                "Correlate identity evidence",
                "Correlate network evidence",
                "Write incident summary",
            ],
            step_hints=[
                "Start with the alert context to avoid noise.",
                "Identity + proxy evidence builds confidence.",
                "Contain only after evidence meets threshold.",
            ],
            scoring={"maxPoints": 210, "commandPoints": 26, "completionBonus": 52, "badges": ["IR Navigator", "Signal Correlator"]},
            mentor_focus="Guide correlation, evidence-weighting, and handoff quality.",
            scenario_type="multi-signal-incident-response",
            vulnerability_class="phishing-led-compromise-chain",
            operator_role="incident-response-lead",
            attack_narrative="A possible compromise spans endpoint execution, identity pressure, and beaconing.",
            realtime_signals=["endpoint-alert", "identity-anomaly", "proxy-beacon", "containment-ready"],
            timer_minutes=20,
            branch_outcomes=[
                {"id": "fast-ir", "title": "Fast IR", "condition": "Contain after two signals confirm.", "reward": "Boost IR readiness."},
                {"id": "evidence-first", "title": "Evidence First", "condition": "Correlate proxy + identity before containment.", "reward": "Boost confidence score."},
            ],
        ),
        "c2-trace": SandboxLab(
            id="c2-trace",
            title="Command-and-Control Trace",
            description="Trace a simulated C2 beacon and propose a takedown plan.",
            objective="Follow beacon signals, identify infrastructure, and plan isolation.",
            practice_environment=f"Simulated DNS + proxy telemetry with beacon artifacts tied to {c2_ctx['c2_domain']}.",
            steps=[
                "Inspect the beacon pattern.",
                "Trace DNS and infrastructure clues.",
                "Decode the C2 profile and risk.",
                "Write a containment and eradication plan.",
            ],
            recommended_tools=["dns lookup", "proxy logs", "threat intel notes"],
            challenge_hint="Confirm infrastructure and block quickly without breaking legit traffic.",
            allowed_commands=[
                "help",
                "status",
                "next",
                "inspect beacon",
                "trace dns",
                "decode c2",
                "block indicator",
                "report c2",
                "complete",
            ],
            tips=[
                "Beaconing often appears as periodic low-noise traffic.",
                "Containment should include blocklists and endpoint isolation.",
            ],
            level="advanced",
            track="defensive-hunt",
            estimated_minutes=18,
            objectives=[
                "Confirm beacon signature",
                "Trace infrastructure",
                "Decode C2 profile",
                "Write eradication plan",
            ],
            step_hints=[
                "Start with beacon interval evidence.",
                "Use DNS trail to confirm the C2 host.",
                "Close with blocking and endpoint isolation.",
            ],
            scoring={"maxPoints": 185, "commandPoints": 24, "completionBonus": 46, "badges": ["Beacon Hunter", "C2 Breaker"]},
            mentor_focus="Coach signal isolation, infrastructure tracing, and clear eradication steps.",
            scenario_type="c2-infrastructure-trace",
            vulnerability_class="command-and-control-beaconing",
            operator_role="threat-hunt-operator",
            attack_narrative="Beaconing traffic is leaving the environment through an unknown relay.",
            realtime_signals=["beacon-pattern", "dns-trace", "c2-profile", "block-ready"],
            timer_minutes=18,
            branch_outcomes=[
                {"id": "infra-lock", "title": "Infrastructure Lock", "condition": "Confirm DNS + relay before blocking.", "reward": "Boost containment accuracy."},
                {"id": "rapid-block", "title": "Rapid Block", "condition": "Block immediately after beacon confirmation.", "reward": "Boost response speed."},
            ],
        ),
    }


def _lab_context(user_id: str, lab_id: str) -> dict[str, str]:
    day_key = _day_key()
    rng = random.Random(_seed_for(user_id, lab_id, day_key))
    return {
        "segment": f"10.{rng.randint(18, 78)}.{rng.randint(10, 120)}",
        "host": f"workstation-{rng.randint(2, 18)}",
        "jump": f"jump-{rng.randint(1, 4)}",
        "api_token": _token_snippet(rng),
        "token_scope": rng.choice(["config:write", "secrets:read", "deploy:write"]),
        "phish_domain": f"secure-{rng.randint(200, 899)}.billing-auth.net",
        "campaign": _campaign_id(rng),
        "c2_domain": f"cdn-{rng.randint(100, 999)}.stream-cache.net",
        "beacon_ip": _random_ip(rng, f"172.{rng.randint(16, 31)}"),
    }


def list_sandbox_labs(db: Session, user_id: str) -> list[dict[str, Any]]:
    catalog = _lab_catalog(user_id)
    labs = []
    for lab in catalog.values():
        state = get_or_create_state(db, user_id, lab.id)
        labs.append(
            {
                "id": lab.id,
                "title": lab.title,
                "description": lab.description,
                "objective": lab.objective,
                "practice_environment": lab.practice_environment,
                "steps": lab.steps,
                "recommended_tools": lab.recommended_tools,
                "challenge_hint": lab.challenge_hint,
                "allowed_commands": lab.allowed_commands,
                "tips": lab.tips,
                "level": lab.level,
                "track": lab.track,
                "estimated_minutes": lab.estimated_minutes,
                "objectives": lab.objectives,
                "step_hints": lab.step_hints,
                "scoring": lab.scoring,
                "mentor_focus": lab.mentor_focus,
                "scenario_type": lab.scenario_type,
                "vulnerability_class": lab.vulnerability_class,
                "operator_role": lab.operator_role,
                "attack_narrative": lab.attack_narrative,
                "realtime_signals": lab.realtime_signals,
                "timer_minutes": lab.timer_minutes,
                "branch_outcomes": lab.branch_outcomes,
                "mode": "simulation",
                "verified": False,
                "separation_notice": "Labs use safe simulated outputs. Use Dashboard and OSINT modules for verified scans.",
                "state": {
                    "score": int(state.score or 0),
                    "xp_earned": int(state.xp_earned or 0),
                    "attempts": int(state.attempts or 0),
                    "completed": bool(state.completed),
                    "completed_objectives": list(state.completed_objectives or []),
                    "last_feedback": state.last_feedback,
                    "updated_at": str(state.updated_at) if state.updated_at else None,
                },
            }
        )
    return labs


def get_or_create_state(db: Session, user_id: str, lab_id: str) -> LabMissionState:
    row = db.query(LabMissionState).filter(LabMissionState.user_id == user_id, LabMissionState.lab_id == lab_id).first()
    if row:
        return row
    row = LabMissionState(user_id=user_id, lab_id=lab_id, terminal_log=[f"[{lab_id}] lab initialized"])
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _command_outputs(lab_id: str, ctx: dict[str, str]) -> dict[str, str]:
    if lab_id == "lateral-movement":
        return {
            "help": "Commands: status, next, map segment, inspect smb, pivot jump-1/2/3/4, dump creds, report lateral, complete",
            "status": f"Segment {ctx['segment']}.0/24 active. Pivot host: {ctx['jump']}.",
            "next": "Next step: map the internal segment for pivot candidates.",
            "map segment": f"Discovered hosts: {ctx['host']} ({ctx['segment']}.32), {ctx['jump']} ({ctx['segment']}.54)\nOpen ports: 445/tcp, 3389/tcp\nRisk: lateral path possible via SMB.",
            "inspect smb": f"SMB shares on {ctx['jump']}:\n- HR-share (rw)\n- IT-admin (rw)\nObservation: shared credentials likely reused across segment.",
            f"pivot {ctx['jump']}": f"Simulated pivot to {ctx['jump']} succeeded.\nEvidence: session token {ctx['api_token']}... captured for analysis.",
            "dump creds": f"Credential artifacts:\n- NTLM hash fragment: {ctx['api_token'][:8]}****\n- Reuse indicator: same hash on {ctx['host']}\nAction: rotate impacted credentials.",
            "report lateral": "Containment summary:\n- Isolate pivot host\n- Reset shared credentials\n- Add SMB hardening policy\n- Monitor east-west traffic for repeat beacon.",
            "complete": "Lateral movement scenario closed. Document the containment action and notify the response lead.",
        }
    if lab_id == "api-token-exposure":
        return {
            "help": "Commands: status, next, inspect gateway, check debug endpoint, trace token scope, report api-risk, complete",
            "status": "Gateway + debug surfaces active. Look for token leakage and scope misconfigurations.",
            "next": "Next step: inspect the gateway boundary.",
            "inspect gateway": "Gateway inspection:\n- Authorization header forwarded to debug service\n- Response contains internal role labels\nRisk: boundary leakage possible.",
            "check debug endpoint": f"Debug endpoint:\n- Token fragment leaked: {ctx['api_token']}...\n- Token owner: deploy-bot\nRisk: HIGH\nFix: remove debug echo, rotate token.",
            "trace token scope": f"Scope review:\n- Token scope: {ctx['token_scope']}\n- Replay window: 45 minutes\nRisk: HIGH\nFix: shorten TTL, reduce scope.",
            "report api-risk": "API Risk Report:\n- Debug path exposed token fragment\n- Scope too broad for service role\n- Gateway leaked internal context\nNext: revoke, rotate, and enforce least privilege.",
            "complete": "API token exposure scenario closed. Track remediation and schedule validation.",
        }
    if lab_id == "phishing-sandbox":
        return {
            "help": "Commands: status, next, analyze sample-1, extract urls sample-1, analyze sample-2, report phishing, complete",
            "status": f"Two samples loaded. Campaign tag: {ctx['campaign']}.",
            "next": "Next step: analyze the high-risk sample.",
            "analyze sample-1": f"Sample-1:\n- From: billing@{ctx['phish_domain']}\n- Urgency language + invoice lure\n- DMARC fail\nRisk: HIGH\nAction: quarantine and block sender.",
            "extract urls sample-1": f"URLs extracted:\n- https://{ctx['phish_domain']}/login\n- http://cdn-{ctx['campaign']}.assets.net/track\nAction: block domains and search mail logs.",
            "analyze sample-2": "Sample-2:\n- Internal sender\n- DKIM aligned\n- Link to intranet.local\nRisk: LOW\nAction: mark safe after validation.",
            "report phishing": "Triage summary:\n- 1 high-risk phishing sample\n- 1 low-risk internal sample\nControls: enforce DMARC, sandbox links, user awareness alert.",
            "complete": "Phishing containment scenario closed. Provide final containment notes.",
        }
    if lab_id == "incident-hunt":
        return {
            "help": "Commands: status, next, review alert-7, correlate identity, correlate proxy, contain host-24, report handoff, complete",
            "status": "Incident signals active. Alert-7 flagged unusual process behavior.",
            "next": "Next step: review the primary alert.",
            "review alert-7": "Alert-7:\n- Suspicious PowerShell execution\n- Endpoint: host-24\n- Parent: winword.exe\nRisk: HIGH",
            "correlate identity": "Identity correlation:\n- User login from two geos within 18 minutes\n- MFA bypass attempt detected\nConfidence: elevated",
            "correlate proxy": f"Proxy correlation:\n- Beaconing to {ctx['c2_domain']}\n- Interval: 15 minutes\nConfidence: high",
            "contain host-24": "Containment action:\n- Isolate host-24 from network\n- Preserve memory image\n- Reset impacted user credentials",
            "report handoff": "Incident summary:\n- PowerShell execution + MFA anomaly + proxy beaconing\n- Containment initiated\n- Escalate to IR lead with evidence bundle",
            "complete": "Incident hunt closed. Monitor for reactivation and validate containment success.",
        }
    return {
        "help": "Commands: status, next, inspect beacon, trace dns, decode c2, block indicator, report c2, complete",
        "status": "Beacon telemetry loaded. Trace the C2 infrastructure safely.",
        "next": "Next step: inspect the beacon pattern.",
        "inspect beacon": f"Beacon pattern:\n- Interval: 60s\n- Destination: {ctx['beacon_ip']}\nRisk: MEDIUM",
        "trace dns": f"DNS trace:\n- {ctx['c2_domain']} -> {ctx['beacon_ip']}\n- TTL: 120s\nEvidence: staged relay",
        "decode c2": "C2 profile:\n- Low-noise HTTPS beacons\n- User-agent mimics backup agent\nAction: isolate affected hosts.",
        "block indicator": f"Indicator blocked:\n- Domain: {ctx['c2_domain']}\n- IP: {ctx['beacon_ip']}\nAction: validate for collateral impact.",
        "report c2": "C2 summary:\n- Beacon confirmed via DNS + proxy\n- Blocked indicators\n- Isolation + eradication steps documented",
        "complete": "C2 trace closed. Continue monitoring for secondary beacons.",
    }


def _command_objective_map(lab: SandboxLab) -> dict[str, str]:
    mapping: dict[str, str] = {}
    if lab.id == "lateral-movement":
        pivot_cmd = next((cmd for cmd in lab.allowed_commands if cmd.startswith("pivot ")), "pivot host")
        mapping.update({
            "map segment": lab.objectives[0],
            "inspect smb": lab.objectives[1],
            pivot_cmd: lab.objectives[2],
            "report lateral": lab.objectives[3],
        })
    elif lab.id == "api-token-exposure":
        mapping.update({
            "inspect gateway": lab.objectives[0],
            "check debug endpoint": lab.objectives[1],
            "trace token scope": lab.objectives[2],
            "report api-risk": lab.objectives[3],
        })
    elif lab.id == "phishing-sandbox":
        mapping.update({
            "analyze sample-1": lab.objectives[0],
            "extract urls sample-1": lab.objectives[1],
            "analyze sample-2": lab.objectives[2],
            "report phishing": lab.objectives[3],
        })
    elif lab.id == "incident-hunt":
        mapping.update({
            "review alert-7": lab.objectives[0],
            "correlate identity": lab.objectives[1],
            "correlate proxy": lab.objectives[2],
            "report handoff": lab.objectives[3],
        })
    else:
        mapping.update({
            "inspect beacon": lab.objectives[0],
            "trace dns": lab.objectives[1],
            "decode c2": lab.objectives[2],
            "report c2": lab.objectives[3],
        })
    return mapping


def _derive_feedback(lab: SandboxLab, command: str, objective_index: int, completed: bool) -> dict[str, Any]:
    high_risk = lab.level in {"advanced", "pro"}
    risk_level = "HIGH" if high_risk and command not in {"help", "status", "next"} else "MEDIUM" if command not in {"help", "status", "next"} else "LOW"
    status = "mission-cleared" if completed else "guidance-ready" if command in {"help", "status", "next"} else "investigating"
    evidence_count = 0 if command in {"help", "status", "next"} else max(1, objective_index + 1)
    mistakes: list[str] = []
    better_approach: list[str] = []
    if command in {"help", "status", "next"}:
        mistakes.append("No evidence-producing action has been taken yet.")
        better_approach.append("Run the next mission action instead of staying in orientation mode.")
    elif not completed:
        mistakes.append("The mission is still mid-chain, so the path is not proven yet.")
        better_approach.append("Use the next action to convert the current clue into a validated objective clear.")
    return {
        "status": status,
        "riskLevel": risk_level,
        "confidence": 92 if completed else 78 if command not in {"help", "status", "next"} else 66,
        "evidenceCount": evidence_count,
        "operatorAction": "Finalize the containment notes and move to the next mission." if completed else "Capture this signal and move to the next objective.",
        "realtimeSignals": lab.realtime_signals[: max(1, objective_index + 1)],
        "mistakes": mistakes,
        "betterApproach": better_approach,
        "nextAction": lab.allowed_commands[min(len(lab.allowed_commands) - 1, objective_index + 3)] if not completed and len(lab.allowed_commands) > 3 else "complete" if completed else "help",
        "urgency": "resolved" if completed else "active",
        "scenarioType": lab.scenario_type,
        "vulnerabilityClass": lab.vulnerability_class,
        "operatorRole": lab.operator_role,
        "branchOutcome": lab.branch_outcomes[0] if lab.branch_outcomes else None,
    }


def _build_mission_state(lab: SandboxLab, completed_objectives: list[str], completed: bool) -> dict[str, Any]:
    total_steps = max(1, len(lab.objectives or lab.steps or ["Mission step"]))
    step_index = min(len(completed_objectives) + 1, total_steps)
    current_objective = "Mission cleared" if completed else (next((item for item in (lab.objectives or lab.steps) if item not in completed_objectives), (lab.objectives or lab.steps or ["Mission step"])[-1]))
    next_action = "complete" if completed else next(
        (command for command, objective in _command_objective_map(lab).items() if objective == current_objective),
        (lab.allowed_commands[3] if len(lab.allowed_commands) > 3 else lab.allowed_commands[0]),
    )
    expected_outcome = "Mission closes with full scoring and reward payout." if completed else (
        f"Clear '{current_objective}' and unlock step {min(step_index + 1, total_steps)}/{total_steps}."
    )
    available_actions = [cmd for cmd in lab.allowed_commands if cmd not in {"help", "status"}][:4]
    return {
        "step_index": step_index,
        "total_steps": total_steps,
        "current_objective": current_objective,
        "next_action": next_action,
        "expected_outcome": expected_outcome,
        "cleared_objectives": list(completed_objectives),
        "available_actions": available_actions,
    }


def run_sandbox_command(db: Session, user_id: str, lab_id: str, command: str) -> dict[str, Any]:
    catalog = _lab_catalog(user_id)
    lab = catalog.get(lab_id)
    if not lab:
        return {
            "ok": False,
            "code": "unknown_lab",
            "output": "Mission not found. Select a valid lab before running commands.",
            "explanation": "Mission selection required.",
            "tips": ["Select a mission from the lab list first."],
            "evaluation": {"scoreDelta": 0, "maxPoints": 0, "clearedObjective": None, "badgeCandidate": None, "nextHint": None},
            "feedback": {
                "status": "mission-missing",
                "riskLevel": "LOW",
                "confidence": 40,
                "evidenceCount": 0,
                "operatorAction": "Pick a mission from the list and retry.",
                "realtimeSignals": ["mission-missing"],
                "mistakes": ["No mission is active."],
                "betterApproach": ["Select a mission before submitting actions."],
                "nextAction": "Select a mission from the list.",
                "urgency": "low",
                "scenarioType": "unknown",
                "vulnerabilityClass": "unknown",
                "operatorRole": "learner",
                "branchOutcome": None,
            },
            "state": {
                "score": 0,
                "xp_earned": 0,
                "attempts": 0,
                "completed": False,
                "completed_objectives": [],
                "last_feedback": None,
                "updated_at": None,
            },
            "mission": None,
            "separation_notice": "Labs use safe simulated outputs. Verified scans remain in Dashboard and OSINT modules.",
        }

    normalized = " ".join(command.strip().split())
    if normalized not in lab.allowed_commands:
        state = get_or_create_state(db, user_id, lab.id)
        return {
            "ok": False,
            "code": "command_not_allowed",
            "output": f"Command blocked in training mode: {normalized}",
            "explanation": "Use only the allowed commands for this mission.",
            "tips": ["Run `help` to view the allowed command list."],
            "evaluation": {"scoreDelta": 0, "maxPoints": int(lab.scoring.get("maxPoints", 140)), "clearedObjective": None, "badgeCandidate": None, "nextHint": lab.step_hints[0] if lab.step_hints else None},
            "feedback": {
                "status": "command-blocked",
                "riskLevel": "LOW",
                "confidence": 55,
                "evidenceCount": 0,
                "operatorAction": "Run `help` and select an allowed command.",
                "realtimeSignals": ["command-blocked"],
                "mistakes": [f"`{normalized}` is not in this mission's safe action list."],
                "betterApproach": ["Follow the next mission action and use one of the listed commands."],
                "nextAction": lab.allowed_commands[0] if lab.allowed_commands else "help",
                "urgency": "low",
                "scenarioType": lab.scenario_type,
                "vulnerabilityClass": lab.vulnerability_class,
                "operatorRole": lab.operator_role,
                "branchOutcome": None,
            },
            "state": {
                "score": int(state.score or 0),
                "xp_earned": int(state.xp_earned or 0),
                "attempts": int(state.attempts or 0),
                "completed": bool(state.completed),
                "completed_objectives": list(state.completed_objectives or []),
                "last_feedback": state.last_feedback,
                "updated_at": str(state.updated_at) if state.updated_at else None,
            },
            "mission": _build_mission_state(lab, list(state.completed_objectives or []), bool(state.completed)),
            "separation_notice": "Labs use safe simulated outputs. Verified scans remain in Dashboard and OSINT modules.",
        }

    state = get_or_create_state(db, user_id, lab.id)
    context = _lab_context(user_id, lab.id)
    outputs = _command_outputs(lab.id, context)
    output = outputs.get(normalized, "Command executed. Capture the evidence and move forward.")
    command_map = _command_objective_map(lab)
    cleared_objective = command_map.get(normalized)
    completed_objectives = list(state.completed_objectives or [])

    score_delta = 0
    completion_bonus = int(lab.scoring.get("completionBonus", 30))
    command_points = int(lab.scoring.get("commandPoints", 18))

    if cleared_objective and cleared_objective not in completed_objectives:
        completed_objectives.append(cleared_objective)
        score_delta = command_points

    is_complete_request = normalized == "complete"
    objectives_done = len(completed_objectives) >= len(lab.objectives)
    completed = bool(state.completed)
    completion_awarded = False

    if is_complete_request:
        if objectives_done:
            if not completed:
                completed = True
                completion_awarded = True
                score_delta = max(score_delta, completion_bonus)
        else:
            output = "Mission not ready to complete. Finish all objectives before closing the scenario."

    state.attempts = int(state.attempts or 0) + 1
    state.score = int(state.score or 0) + max(0, score_delta)
    state.xp_earned = int(state.xp_earned or 0) + max(0, int(score_delta * 0.6))
    state.completed = 1 if completed else 0
    state.completed_objectives = completed_objectives
    state.terminal_log = (list(state.terminal_log or []) + [f"$ {normalized}", output])[-40:]
    feedback = _derive_feedback(lab, normalized, max(0, len(completed_objectives) - 1), completed)
    state.last_feedback = feedback["status"]
    state.updated_at = datetime.utcnow()
    db.commit()

    db.add(
        UserEvent(
            user_id=user_id,
            event_type="sandbox_command",
            surface="labs",
            target=lab.id,
            event_metadata={
                "command": normalized,
                "score_delta": score_delta,
                "completed": completed,
            },
        )
    )
    if completion_awarded:
        db.add(
            UserEvent(
                user_id=user_id,
                event_type="sandbox_mission_complete",
                surface="labs",
                target=lab.id,
                event_metadata={"score_delta": score_delta, "lab_id": lab.id},
            )
        )
    if score_delta:
        db.add(UserXpEvent(user_id=user_id, source="sandbox_lab", points=int(score_delta), meta={"lab_id": lab.id, "command": normalized}))
    db.commit()

    evaluation = {
        "scoreDelta": score_delta,
        "maxPoints": int(lab.scoring.get("maxPoints", 140)),
        "clearedObjective": cleared_objective,
        "badgeCandidate": lab.scoring.get("badges", [None])[0] if completion_awarded else None,
        "nextHint": lab.step_hints[min(len(completed_objectives), len(lab.step_hints) - 1)] if lab.step_hints else None,
    }

    return {
        "ok": True,
        "code": "completed" if completed and is_complete_request else "training_ok" if normalized not in {"help", "status", "next"} else "info",
        "output": f"[SAFE SIMULATION OUTPUT]\n{output}",
        "explanation": "Safe training-range output generated for validated mission practice.",
        "tips": [
            "Range output is isolated for training-only execution.",
            "Use the dashboard modules for verified scans.",
        ],
        "evaluation": evaluation,
        "feedback": feedback,
        "state": {
            "score": int(state.score or 0),
            "xp_earned": int(state.xp_earned or 0),
            "attempts": int(state.attempts or 0),
            "completed": bool(state.completed),
            "completed_objectives": list(state.completed_objectives or []),
            "last_feedback": state.last_feedback,
            "updated_at": str(state.updated_at) if state.updated_at else None,
        },
        "mission": _build_mission_state(lab, completed_objectives, completed),
        "separation_notice": "Labs use safe simulated outputs. Verified scans remain in Dashboard and OSINT modules.",
    }


def build_daily_missions(db: Session, user_id: str) -> list[dict[str, Any]]:
    today_key = _day_key()
    rng = random.Random(_seed_for(user_id, "daily-missions", today_key))
    catalog = list(_lab_catalog(user_id).values())
    rng.shuffle(catalog)
    missions = []
    for idx, lab in enumerate(catalog[:3]):
        base_points = 28 if lab.level == "intermediate" else 34 if lab.level == "advanced" else 40 if lab.level == "pro" else 22
        mission_type = "speed" if idx == 0 else "branch" if idx == 1 else "precision"
        mission_id = f"daily:{today_key}:{lab.id}:{mission_type}"
        missions.append(
            {
                "id": mission_id,
                "title": "Rapid Recon Sprint" if idx == 0 else "Precision Branch Run" if idx == 1 else "High-Signal Finish",
                "detail": f"Complete {lab.title} and deliver the {mission_type} twist for bonus points.",
                "points": base_points + idx * 6,
                "target_lab_id": lab.id,
                "type": mission_type,
                "completed": _mission_completed(db, user_id, mission_id),
            }
        )
    return missions


def build_weekly_missions(db: Session, user_id: str) -> list[dict[str, Any]]:
    today = date.today()
    week_key = f"{today.isocalendar().year}-W{today.isocalendar().week}"
    rng = random.Random(_seed_for(user_id, "weekly-missions", week_key))
    catalog = list(_lab_catalog(user_id).values())
    rng.shuffle(catalog)
    missions = []
    for idx, lab in enumerate(catalog[:3]):
        base_points = 70 if lab.level in {"advanced", "pro"} else 55
        mission_id = f"weekly:{week_key}:{lab.id}:{idx}"
        missions.append(
            {
                "id": mission_id,
                "title": f"Weekly {lab.title}",
                "detail": f"Finish {lab.title} with full objectives and submit the completion command.",
                "points": base_points + idx * 8,
                "target_lab_id": lab.id,
                "type": "weekly",
                "completed": _mission_completed(db, user_id, mission_id),
            }
        )
    return missions


def _mission_completed(db: Session, user_id: str, mission_id: str) -> bool:
    row = (
        db.query(UserEvent)
        .filter(UserEvent.user_id == user_id, UserEvent.event_type == "sandbox_mission_reward", UserEvent.target == mission_id)
        .first()
    )
    return bool(row)


def try_complete_missions(db: Session, user_id: str, lab_id: str, completed: bool) -> tuple[list[dict[str, Any]], list[str]]:
    if not completed:
        return [], []
    rewards: list[dict[str, Any]] = []
    completed_ids: list[str] = []
    daily = build_daily_missions(db, user_id)
    weekly = build_weekly_missions(db, user_id)
    for mission in daily + weekly:
        if mission["target_lab_id"] != lab_id or mission["completed"]:
            continue
        db.add(
            UserEvent(
                user_id=user_id,
                event_type="sandbox_mission_reward",
                surface="labs",
                target=mission["id"],
                event_metadata={"lab_id": lab_id, "points": mission["points"], "scope": "daily" if mission in daily else "weekly"},
            )
        )
        db.add(UserXpEvent(user_id=user_id, source="sandbox_mission", points=int(mission["points"]), meta={"mission_id": mission["id"]}))
        rewards.append(
            {
                "id": mission["id"],
                "title": mission["title"],
                "detail": f"+{mission['points']} mission points awarded",
                "earnedAt": int(datetime.utcnow().timestamp() * 1000),
            }
        )
        completed_ids.append(mission["id"])
    db.commit()
    return rewards, completed_ids
