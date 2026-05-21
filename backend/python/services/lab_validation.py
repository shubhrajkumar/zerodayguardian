from __future__ import annotations

import re
from typing import Any


GENERIC_BYPASS_PATTERNS = {
    "i don't know",
    "idk",
    "skip",
    "pass",
    "next",
    "show answer",
    "solution please",
    "answer please",
    "hint only",
    "test",
    "asdf",
}

COMMAND_HINTS = {
    "terminal": "Use a real Kali/Linux command that fits the task instead of a generic sentence.",
    "analysis": "Name the verified signal and why it matters.",
    "brief": "Write like an analyst: target, verified observation, and risk.",
    "containment": "Describe one concrete defensive action first.",
    "remediation": "Write one fix that an engineer can apply directly.",
    "workflow": "Explain the action, the evidence, and the decision.",
}

COMMAND_PREFIXES = (
    "pwd",
    "ls",
    "ip",
    "ss",
    "curl",
    "whois",
    "dig",
    "nslookup",
    "grep",
    "jq",
    "cat",
    "journalctl",
    "tail",
    "nikto",
    "ffuf",
    "dirsearch",
    "gobuster",
    "aws",
    "kubectl",
    "docker",
    "trivy",
    "python",
    "python3",
    "git",
    "nmap",
    "yara",
    "ssh",
    "smbclient",
    "wmic",
    "net",
    "crackmapexec",
)


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def anti_bypass_check(answer: str) -> str | None:
    normalized = normalize_text(answer)
    if not normalized:
        return "Empty answers are not valid in this lab."
    if len(normalized) < 4:
        return "Answer is too short to prove operator intent."
    if normalized in GENERIC_BYPASS_PATTERNS or any(item in normalized for item in GENERIC_BYPASS_PATTERNS):
        return "Generic bypass text is blocked. Submit a real operator action or analyst-quality answer."
    return None


def _matches_terms(answer: str, accepted_terms: list[list[str]]) -> bool:
    normalized = normalize_text(answer)
    for group in accepted_terms:
        if any(term in normalized for term in group):
            return True
    return False


def _matches_required_groups(answer: str, accepted_terms: list[list[str]], required_groups: int = 2) -> bool:
    normalized = normalize_text(answer)
    matched_groups = 0
    for group in accepted_terms:
        if any(term in normalized for term in group):
            matched_groups += 1
    return matched_groups >= min(required_groups, len(accepted_terms))


def _looks_like_command(answer: str) -> bool:
    normalized = answer.strip().lower()
    if not normalized:
        return False
    if any(normalized.startswith(prefix) for prefix in COMMAND_PREFIXES):
        return True
    return bool(re.match(r"^[a-z0-9_\-]+(\s+[-./:=a-z0-9_]+)*$", normalized))


def build_hint(task: Any, attempt_count: int) -> str:
    fallback = COMMAND_HINTS.get(getattr(task, "expected_type", "workflow"), "Keep the answer tied to a real operator action.")
    base_hint = getattr(task, "hint", "") or fallback
    accepted_terms = getattr(task, "accepted_terms", []) or []
    anchor = accepted_terms[0][0] if accepted_terms and accepted_terms[0] else ""
    if attempt_count <= 1:
        return base_hint
    if attempt_count == 2:
        return f"{base_hint} Focus on '{anchor}' if you are unsure where to start." if anchor else base_hint
    return f"Hint tier 3: start from '{anchor}' and include the evidence you expect to see." if anchor else f"{base_hint} Add the evidence you expect to see."


def difficulty_band(attempt_count: int, success_count: int) -> str:
    if success_count >= 2 and attempt_count <= 2:
        return "accelerated"
    if attempt_count >= 4:
        return "guided"
    return "standard"


def build_mentor_guidance(task: Any, attempt_count: int, success_count: int) -> str:
    band = difficulty_band(attempt_count, success_count)
    task_title = getattr(task, "title", "this task")
    validation_focus = " ".join(getattr(task, "validation_focus", []) or []).lower()
    if any(keyword in validation_focus for keyword in ("attack chain", "entry confirmation", "exploit proof", "impact reasoning", "foothold reasoning", "recon priority", "web vector", "network vector", "logic flaw", "final judgment")):
        if band == "accelerated":
            return f"ZORVIX chain read: '{task_title}' is strong. Keep the sequence tight and state why this path beats the alternatives."
        if band == "guided":
            return f"ZORVIX chain read: slow down. On '{task_title}', name the recon clue, the foothold, and the resulting impact in order."
        return f"ZORVIX chain read: for '{task_title}', explain how one validated step increases attacker leverage and sets up the next step."
    if any(keyword in validation_focus for keyword in ("branch decision", "risk evaluation", "decision consequence", "evidence support", "outcome reasoning")):
        if band == "accelerated":
            return f"ZORVIX decision read: '{task_title}' is sharp. State the chosen branch, the tradeoff, and why the outcome follows."
        if band == "guided":
            return f"ZORVIX decision read: slow down. For '{task_title}', say which branch you chose, what evidence supports it, and what consequence comes next."
        return f"ZORVIX decision read: compare the branches, justify the risk, and explain why your chosen path is worth more than the alternatives."
    if any(keyword in validation_focus for keyword in ("incident response", "timeline analysis", "recovery planning", "containment", "log analysis")):
        if band == "accelerated":
            return f"ZORVIX IR read: '{task_title}' is strong. Call the timeline, justify the control, and move into recovery with discipline."
        if band == "guided":
            return f"ZORVIX IR read: slow down. For '{task_title}', explain the incident sequence, the containment action, and why recovery is safe only after that."
        return f"ZORVIX IR read: prove the timeline first, then justify containment, then state the safest recovery move."
    if any(keyword in validation_focus for keyword in ("arena", "sigma", "apex", "omega", "opening move", "leverage judgment", "final judgment")):
        if band == "accelerated":
            return f"ZORVIX evaluator mode: '{task_title}' is sharp. Keep it cold, precise, and free of filler."
        if band == "guided":
            return f"ZORVIX evaluator mode: this is still soft. On '{task_title}', state the signal, the failure, and the optimal move with less decoration."
        return f"ZORVIX evaluator mode: for '{task_title}', make the judgment harder, shorter, and more defensible."
    if any(keyword in validation_focus for keyword in ("active threat", "uncertainty", "decision quality", "permanent decision", "risk acceptance", "thinking quality", "scenario evolution", "evidence analysis")):
        if band == "accelerated":
            return f"ZORVIX judgment: '{task_title}' shows disciplined thinking under uncertainty. Keep the reasoning sparse and the risk call explicit."
        if band == "guided":
            return f"ZORVIX judgment: your thinking is still too loose. On '{task_title}', anchor the signal, state the accepted risk, and predict the next evolution cleanly."
        return f"ZORVIX judgment: under uncertainty, show the signal you trusted, the risk you accepted, and why the scenario changes because of your choice."
    if any(keyword in validation_focus for keyword in ("data exfiltration", "sensitive path", "leak prevention", "timed action", "performance scoring", "optimal path")):
        if band == "accelerated":
            return f"ZORVIX exfil read: '{task_title}' is sharp. Name the data path, the leak or extraction route, and the best next move with zero filler."
        if band == "guided":
            return f"ZORVIX exfil read: slow down. For '{task_title}', say which data path matters, whether you are extracting or containing, and why the route is risky."
        return f"ZORVIX exfil read: explain the sensitive path, the transfer or containment logic, the risk level, and the optimal next step."
    if any(keyword in validation_focus for keyword in ("battle stage", "resource management", "cold evaluation", "performance scoring")):
        if band == "accelerated":
            return f"ZORVIX arena read: '{task_title}' is sharp. State the move, the resource cost, and the resulting board advantage with no filler."
        if band == "guided":
            return f"ZORVIX arena read: slow down. For '{task_title}', say what you spent, what you preserved, and why the board improved."
        return f"ZORVIX arena read: explain the stage, the resource tradeoff, the risk accepted, and why the final board state favored your side."
    if any(keyword in validation_focus for keyword in ("lateral movement", "pivot choice", "access validation", "credential path", "privilege escalation", "lateral consequence", "optimal path", "operator debrief")):
        if band == "accelerated":
            return f"ZORVIX lateral read: '{task_title}' is strong. Keep the chain crisp: source node, credential, pivot target, privilege gain."
        if band == "guided":
            return f"ZORVIX lateral read: slow down. For '{task_title}', name the source host, the credential or access point, the next node, and the privilege that changes."
        return f"ZORVIX lateral read: explain the movement path like an operator. Which node opens the route, which credential proves it, and what privilege is gained next?"
    if any(keyword in validation_focus for keyword in ("alert triage", "breach sequence", "incident reasoning", "containment", "telemetry", "log analysis")):
        if band == "accelerated":
            return f"Senior analyst view: '{task_title}' is already strong. Call the sequence, name the consequence, and move to containment without overexplaining."
        if band == "guided":
            return f"Senior analyst view: slow this down. For '{task_title}', state the alert, the evidence trail, and the first defensive action in that order."
        return f"Senior analyst view: on '{task_title}', explain what was detected, why it proves attacker progress, and what you contain first."
    if band == "accelerated":
        return f"Performance is strong. Keep '{task_title}' concise and move to the next step quickly."
    if band == "guided":
        return f"Slow down on '{task_title}'. Show one clear action and one clear piece of evidence."
    return f"Stay deliberate on '{task_title}'. Show the action, then the evidence, then the operator conclusion."


def _validate_by_type(task: Any, answer: str) -> bool:
    expected_type = getattr(task, "expected_type", "workflow")
    normalized = normalize_text(answer)
    accepted_terms = getattr(task, "accepted_terms", []) or []

    if expected_type == "terminal":
        return _looks_like_command(answer) and _matches_terms(answer, accepted_terms)
    if expected_type == "quiz":
        return _matches_terms(answer, accepted_terms)
    if expected_type in {"workflow", "scenario", "detection", "verification", "report", "explanation"}:
        return _matches_required_groups(answer, accepted_terms, required_groups=1 if len(accepted_terms) == 1 else 2) and any(
            marker in normalized for marker in ("then", "after", "verify", "because", "evidence", "result", "risk", "action", "monitor")
        )
    if expected_type in {"analysis", "brief", "containment", "remediation", "decision", "hypothesis"}:
        return _matches_terms(answer, accepted_terms) and len(normalized.split(" ")) >= 4
    return _matches_terms(answer, accepted_terms) and any(
        marker in normalized for marker in ("verify", "because", "evidence", "signal", "result", "risk", "action")
    )


def validate_submission(task: Any, answer: str, attempt_count: int, success_count: int) -> dict[str, Any]:
    bypass_error = anti_bypass_check(answer)
    if bypass_error:
        return {
            "accepted": False,
            "feedback": bypass_error,
            "score_delta": 0,
            "xp_delta": 0,
            "hint": build_hint(task, attempt_count),
            "mentor_guidance": build_mentor_guidance(task, attempt_count, success_count),
            "retry_allowed": True,
            "difficulty_band": difficulty_band(attempt_count, success_count),
        }

    accepted = _validate_by_type(task, answer)
    return {
        "accepted": accepted,
        "feedback": getattr(task, "success_message", "Accepted.") if accepted else f"Not quite yet. {build_hint(task, attempt_count)}",
        "score_delta": int(getattr(task, "score", 0) if accepted else 0),
        "xp_delta": int(getattr(task, "xp", 0) if accepted else 0),
        "hint": None if accepted else build_hint(task, attempt_count),
        "mentor_guidance": build_mentor_guidance(task, attempt_count, success_count),
        "retry_allowed": not accepted,
        "difficulty_band": difficulty_band(attempt_count, success_count),
    }
