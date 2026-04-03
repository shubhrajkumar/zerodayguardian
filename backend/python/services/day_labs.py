from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class DaySeed:
    day: int
    title: str
    focus: str


@dataclass(frozen=True)
class TaskDefinition:
    id: str
    title: str
    instruction: str
    expected_type: str
    hint: str
    success_message: str
    accepted_terms: list[list[str]]
    score: int
    xp: int
    interaction_type: str = "text"
    options: list[dict[str, str]] | None = None
    validation_focus: list[str] | None = None


PROGRAM_SEEDS: list[DaySeed] = [
    DaySeed(1, "Security mindset + CIA triad", "foundation"),
    DaySeed(2, "Reconnaissance fundamentals", "intel"),
    DaySeed(3, "Web attack surface discovery", "appsec"),
    DaySeed(4, "Vulnerability identification", "appsec"),
    DaySeed(5, "Controlled exploitation simulation", "appsec"),
    DaySeed(6, "Defense thinking under breach pressure", "defense"),
    DaySeed(7, "Full attack chain simulation", "appsec"),
    DaySeed(8, "Branching cyber decisions", "defense"),
    DaySeed(9, "Live incident response simulation", "defense"),
    DaySeed(10, "Elite challenge arena", "capstone"),
    DaySeed(11, "Active threat simulation", "defense"),
    DaySeed(12, "Lateral movement simulation", "defense"),
    DaySeed(13, "Data exfiltration vs defense", "defense"),
    DaySeed(14, "Multi-vector attack simulation", "appsec"),
    DaySeed(15, "Strategic cyber battle arena", "defense"),
    DaySeed(16, "Logging & SIEM", "defense"),
    DaySeed(17, "Detection basics", "defense"),
    DaySeed(18, "Incident response", "defense"),
    DaySeed(19, "Phishing defense", "defense"),
    DaySeed(20, "MFA & identity", "defense"),
    DaySeed(21, "Review", "defense"),
    DaySeed(22, "Web app test plan", "appsec"),
    DaySeed(23, "OWASP risks overview", "appsec"),
    DaySeed(24, "API security", "appsec"),
    DaySeed(25, "Access control", "appsec"),
    DaySeed(26, "File upload risks", "appsec"),
    DaySeed(27, "CSRF basics", "appsec"),
    DaySeed(28, "Review", "appsec"),
    DaySeed(29, "OSINT workflow deep dive", "intel"),
    DaySeed(30, "Threat intel triage", "intel"),
    DaySeed(31, "Breach response", "defense"),
    DaySeed(32, "Vulnerability management", "defense"),
    DaySeed(33, "Patch verification", "defense"),
    DaySeed(34, "Security monitoring", "defense"),
    DaySeed(35, "Review", "defense"),
    DaySeed(36, "Cloud basics", "cloud"),
    DaySeed(37, "Storage security", "cloud"),
    DaySeed(38, "Container security", "cloud"),
    DaySeed(39, "CI/CD security", "cloud"),
    DaySeed(40, "Secrets management", "cloud"),
    DaySeed(41, "Endpoint basics", "defense"),
    DaySeed(42, "Review", "cloud"),
    DaySeed(43, "Threat hunting workflow", "hunt"),
    DaySeed(44, "Anomaly detection", "hunt"),
    DaySeed(45, "Insider risk", "hunt"),
    DaySeed(46, "Ransomware response", "defense"),
    DaySeed(47, "Data loss prevention", "defense"),
    DaySeed(48, "Risk scoring", "defense"),
    DaySeed(49, "Review", "hunt"),
    DaySeed(50, "Portfolio build", "capstone"),
    DaySeed(51, "Resume focus", "capstone"),
    DaySeed(52, "Interview prep", "capstone"),
    DaySeed(53, "Live case study", "capstone"),
    DaySeed(54, "Secure design", "capstone"),
    DaySeed(55, "Automation", "capstone"),
    DaySeed(56, "Final review", "capstone"),
    DaySeed(57, "Capstone build 1", "capstone"),
    DaySeed(58, "Capstone build 2", "capstone"),
    DaySeed(59, "Capstone audit", "capstone"),
    DaySeed(60, "Capstone report", "capstone"),
]


FOCUS_META: dict[str, dict[str, Any]] = {
    "foundation": {
        "difficulty": "beginner",
        "skill_key": "secure_engineering",
        "environment": "Kali Linux shell + local safe practice target",
        "kali_tools": ["bash", "ip", "ss", "grep"],
        "scenario": "You are a junior analyst onboarding into a security team and must build correct operator habits before touching production systems.",
        "next_steps": ["Summarize what signal mattered most.", "Repeat the core command until it feels natural."],
    },
    "intel": {
        "difficulty": "intermediate",
        "skill_key": "osint_intelligence",
        "environment": "Kali Linux reconnaissance workspace + verified OSINT workflow",
        "kali_tools": ["whois", "dig", "nslookup", "curl"],
        "scenario": "You are validating external exposure on a scoped target and must separate verified evidence from assumption.",
        "next_steps": ["Cross-check one result with a second source.", "Document one analyst-quality finding."],
    },
    "appsec": {
        "difficulty": "intermediate",
        "skill_key": "web_security",
        "environment": "Kali Linux web security lab + vulnerable training service",
        "kali_tools": ["curl", "ffuf", "burpsuite", "nikto"],
        "scenario": "You are reviewing a staging application before release and need to prove risk with safe, repeatable steps.",
        "next_steps": ["Write the remediation in developer language.", "Explain why the issue changes risk level."],
    },
    "defense": {
        "difficulty": "intermediate",
        "skill_key": "threat_detection",
        "environment": "Kali Linux defense console + synthetic SOC telemetry",
        "kali_tools": ["grep", "jq", "cat", "journalctl"],
        "scenario": "You are supporting a blue-team shift and must triage events, contain risk, and leave a clear operator record.",
        "next_steps": ["Convert one observation into a detection idea.", "Write a short containment note."],
    },
    "cloud": {
        "difficulty": "advanced",
        "skill_key": "secure_engineering",
        "environment": "Kali Linux cloud practice shell + misconfiguration simulation",
        "kali_tools": ["aws", "kubectl", "trivy", "docker"],
        "scenario": "You are hardening a cloud estate where one weak default can become a public incident.",
        "next_steps": ["State the least-privilege change you would make.", "Name one verification step after the fix."],
    },
    "hunt": {
        "difficulty": "advanced",
        "skill_key": "threat_detection",
        "environment": "Kali Linux hunt workspace + alert timeline simulator",
        "kali_tools": ["jq", "grep", "python3", "yara"],
        "scenario": "You are threat hunting through noisy signals and need to build confidence before escalating to incident response.",
        "next_steps": ["Explain your hunt hypothesis in one line.", "Name the evidence that would disprove it."],
    },
    "capstone": {
        "difficulty": "pro",
        "skill_key": "simulation_ops",
        "environment": "Kali Linux project lab + operator reporting workspace",
        "kali_tools": ["nmap", "curl", "python3", "git"],
        "scenario": "You are turning everything learned so far into job-ready operator output: repeatable workflow, evidence, and concise reporting.",
        "next_steps": ["Capture the strongest proof point from the lab.", "Describe the operator judgment behind your final answer."],
    },
}


DAY_ONE_LEARN_CARDS: list[dict[str, str]] = [
    {
        "id": "cia-integrity",
        "eyebrow": "Security Lens",
        "title": "Classify the failure before reacting",
        "detail": "A defaced public page is an integrity issue first. The content can still be reachable while trust in what users see is already broken.",
        "proof_point": "Integrity changes when trusted data is altered without authorization.",
        "action_label": "Identify the impacted pillar",
    },
    {
        "id": "operator-baseline",
        "eyebrow": "Operator Habit",
        "title": "Start from local context, not assumptions",
        "detail": "Your first terminal action should explain where you are, who you are, or what workspace you are in before any deeper move.",
        "proof_point": "Commands like `pwd`, `ls`, and `whoami` create verifiable context in seconds.",
        "action_label": "Run a safe discovery command",
    },
    {
        "id": "evidence-discipline",
        "eyebrow": "Evidence",
        "title": "Prove the result with something visible",
        "detail": "A command only matters if you can point to the output that changed your confidence and justify the next step from it.",
        "proof_point": "Trusted operators explain the signal they saw, not just the command they typed.",
        "action_label": "Tie the output to a decision",
    },
]

MENTOR_INTROS: dict[int, str] = {
    1: "Day 1 is where I want you to build one habit that great security people never outgrow: before you touch tools, understand what actually failed. We’ll keep this simple, practical, and calm. You’ll read the incident, name the broken security property, run one safe command for context, and explain why that output matters.",
    2: "Day 2 is where reconnaissance stops sounding mysterious and starts feeling practical. Before attackers touch a target, they usually learn who owns it, where it points, and which subdomains might expose something interesting. Today I want you to think like that, but with discipline: start from a source you can trust, follow the clue with one clean command, and explain why the result matters.",
    3: "Day 3 is about learning how to look at a website the way an attacker quietly would. Think of a building: the front door is obvious, but the real risk often hides in side doors, staff entrances, and maintenance corridors nobody expected visitors to find. Web attack-surface work is the same. We are not chasing every route. We are looking for the doors that would matter most if the wrong person found them first.",
    4: "Day 4 is about learning to spot weaknesses the way an experienced reviewer would. I do not want you chasing anything that merely looks strange. I want you asking a simpler question: what trust boundary is breaking here? Is the app trusting the wrong user, the wrong input, or the wrong configuration? Once you see that clearly, vulnerability work gets much easier.",
    5: "This day should feel tense, but not chaotic. In real offensive work, a strong operator proves the chain with the smallest safe move possible, then explains the consequence in plain language a defender can act on.",
    6: "A good defender does not chase every alert. They build a timeline, find the attacker progress signal, and choose the first containment move that slows the threat without destroying evidence. That is exactly how we will work today.",
    7: "Today is about connecting the dots. Recon only matters if it leads to an entry path. Entry only matters if it creates leverage. Your job is to keep that chain logical from start to finish.",
    8: "Real cyber decisions rarely come with perfect certainty. What matters is whether you can explain why a path creates leverage, what risk it introduces, and what evidence will still exist after you act.",
    9: "Incident response is a thinking discipline before it becomes a tooling discipline. We are going to anchor the timeline, choose the first control, and only then think about recovery.",
    10: "The arena is intentionally colder. You already know the building blocks. Now the question is whether you can choose the strongest move quickly, under pressure, without being carried by guidance.",
    12: "Day 12 is about attacker movement inside a compromised environment. You already have a foothold somewhere in the network. Now you need to think like an operator under pressure: which credential matters, which node actually changes your leverage, and which move escalates privilege without wasting the path.",
    13: "Day 13 is about data under pressure. You are arriving while sensitive records are already at risk. Your job is to identify the data path, decide whether to simulate extraction or shut the leak down based on role, and justify every move with evidence instead of drama.",
    14: "Day 14 is where separate weaknesses stop being separate. A route exposure, a network trust gap, and a logic flaw now have to be chained into one credible exploit path. There is no walkthrough here. Your job is to identify the decisive combination, move under a timer, and explain the chain like an operator who actually understands leverage.",
    15: "Day 15 is a strategy day, not a tactics day. You are balancing attack pressure and defensive control at the same time, with limited resources and no friendly narration during execution. Your score comes from whether your sequence of choices actually wins the room.",
}

EXAMPLE_STORIES: dict[int, str] = {
    1: "Real-life example: imagine your bank app opens normally, but the balance screen has been changed by someone unauthorized. The app is still available, but trust in the data is broken. That is why integrity matters so much in real incidents.",
    2: "Real-life example: before attacking a company, an operator may spend a few quiet minutes checking WHOIS, nameservers, and obvious subdomains. That alone can reveal whether the target uses a third-party provider, which systems are internet-facing, and whether forgotten environments like `staging` or `api` might exist.",
    3: "Real-life example: a company may polish the homepage and public marketing pages, but leave an old `/admin` panel, `/backup/` folder, or hidden API endpoint accessible because 'nobody knows it exists.' Attackers love those hidden doors because they reveal how the system really works behind the scenes.",
    4: "Real-life example: imagine a building with three problems at once. One door opens with a default key, one receptionist repeats anything you whisper to them out loud, and one maintenance room was left unlocked. Each problem looks different, but all of them mean the building is trusting something it should not.",
    5: "Real-life example: an attacker does not need a dramatic payload if weak auth already gives session access. A small proof request can be enough to demonstrate takeover risk and trigger containment.",
    6: "Real-life example: eleven failed logins alone may be noise, but failed logins followed by a privileged session and new outbound traffic is how a real compromise starts to reveal itself.",
    7: "Real-life example: a forgotten admin route discovered during recon can become the entry point, and weak trust there can become the exploit path. The danger is in the connection between those steps.",
    8: "Real-life example: isolating fast may cut attacker dwell time, but it can also reduce evidence. Waiting may preserve evidence, but it may also hand initiative back to the attacker. Good decisions live inside that tradeoff.",
    9: "Real-life example: after containment, strong teams do not jump straight to cleanup. They restore trust in stages: revoke access, verify clean state, then bring services back carefully.",
    10: "Real-life example: senior analysts are often judged less on what they know than on whether they can spot the decisive signal faster than everyone else and say the next move without filler.",
    12: "Real-life example: many breaches become serious not at the initial foothold, but when an attacker reuses one weak credential or one over-privileged service account to move from a low-value host into something that actually matters.",
    13: "Real-life example: in real incidents, attackers rarely steal everything at once. They look for the one export share, one backup archive, or one sync process that quietly moves the most valuable data with the least resistance. Defenders win by spotting that path before the transfer completes.",
    14: "Real-life example: major breaches often come from three medium-severity issues that become dangerous only when chained together, like a login panel exposed by recon, an internal service reachable over a flat network, and a business-logic shortcut that trusts the wrong user state.",
    15: "Real-life example: mature security teams lose not because they lack tools, but because they spend the wrong resource at the wrong stage, over-commit to offense, or defend too late. Strategic cyber work is often a battle of sequencing under pressure.",
}


EARLY_DAY_PACKS: dict[int, dict[str, Any]] = {
    1: {
        "scenario": "At 06:40, your team wakes up to a defaced public status page. Customers can still load the page, but trust in what they see is broken. You must classify the failure, stabilize your thinking, inspect the shell safely, and explain the evidence before deeper response begins.",
        "scenario_tagline": "Think like a hacker: classify the weakness, validate the signal, then move with discipline.",
        "mission_brief": "Day 1 is your hacker mindset reset. Read the incident, classify it with the CIA triad, run one safe terminal command for context, prove why the output matters, and unlock Day 2 only after the backend validates the full reasoning chain.",
        "learn_points": [
            "Hackers win by observing first and assuming last.",
            "CIA is not theory here: it is the lens that tells you what failed first.",
            "Every command should produce a signal you can explain and defend.",
        ],
        "learn_cards": [
            {
                "id": "day1-cia",
                "eyebrow": "Think",
                "title": "Classify the incident before you touch anything",
                "detail": "When a page is defaced, the important question is not 'is the site up?' but 'can users still trust what they see?' If the page still loads, availability may be fine while integrity is already broken.",
                "proof_point": "The first correct thought is often more valuable than the first command.",
                "action_label": "Name the first broken pillar",
            },
            {
                "id": "day1-command",
                "eyebrow": "Act",
                "title": "Use the shell to build context, not ego",
                "detail": "Real operators do not start with flashy commands. They start with small questions like 'where am I?' or 'what user am I?' because simple context prevents sloppy mistakes.",
                "proof_point": "`pwd`, `ls`, and `whoami` are disciplined because they reduce uncertainty fast.",
                "action_label": "Run one safe command",
            },
            {
                "id": "day1-verify",
                "eyebrow": "Verify",
                "title": "Tie every move to evidence",
                "detail": "Skill shows up when you can say, in plain language, what the output told you and what decision it changed. That is what turns a command into evidence.",
                "proof_point": "The best analysts point to one signal and one decision that followed from it.",
                "action_label": "Explain the evidence",
            },
        ],
        "success_criteria": [
            "Classify the incident correctly with CIA reasoning.",
            "Run a safe shell command that builds context.",
            "Use visible output as evidence for the next decision.",
        ],
        "completion_badge": "Integrity Initiate",
    },
    2: {
        "scenario": "A marketing launch goes live in three hours, but the team never finished documenting the target domain. You need to gather verified external intelligence fast: registrar context, DNS evidence, and one believable subdomain clue before anyone signs off on exposure.",
        "scenario_tagline": "Recon like a real operator: gather facts quietly, verify them, then decide what deserves attention.",
        "mission_brief": "Day 2 is a mentor-guided reconnaissance mission. You will start from a source you can defend, run real recon commands like `whois` and `nslookup`, follow one DNS or subdomain clue, and turn the result into a short analyst brief. Day 3 only unlocks when the full chain validates cleanly.",
        "learn_points": [
            "Recon starts from sources you can verify directly, not internet folklore.",
            "WHOIS and DNS results matter because they can be cross-checked and cited.",
            "Subdomain discovery is useful only when it produces a signal you can explain and prioritize.",
        ],
        "learn_cards": [
            {
                "id": "day2-source",
                "eyebrow": "Source",
                "title": "Start with a source you can explain to someone else",
                "detail": "If another analyst asked, 'How do you know that?', you should be able to point to the exact source. WHOIS and DNS are great first steps because they are direct, checkable, and calm.",
                "proof_point": "Trusted reconnaissance begins with authoritative or directly observable data.",
                "action_label": "Choose the recon source",
            },
            {
                "id": "day2-dns",
                "eyebrow": "DNS",
                "title": "Use DNS to test what the target is really exposing",
                "detail": "A nameserver, A record, MX record, or subdomain clue can quietly tell you whether the target has extra systems, third-party services, or staging environments worth checking next.",
                "proof_point": "`nslookup` and `dig` turn domain questions into visible evidence quickly.",
                "action_label": "Inspect the DNS signal",
            },
            {
                "id": "day2-brief",
                "eyebrow": "Brief",
                "title": "Turn raw recon into a useful note",
                "detail": "Typing a command is not the point. The point is being able to say what you found, why it matters, and what the next sensible check would be.",
                "proof_point": "Strong recon ends with one verified finding and one reason it matters.",
                "action_label": "Write the recon note",
            },
        ],
        "success_criteria": [
            "Begin from a trusted recon source.",
            "Capture a real DNS or registrar signal.",
            "Use that signal to justify the next recon move.",
        ],
        "completion_badge": "Recon Runner",
    },
    3: {
        "scenario": "A staging web app is going public tomorrow, but nobody has mapped the routes it exposes to the internet. Your job is to find the obvious and non-obvious doors first: login panels, forgotten directories, and suspicious endpoints that deserve faster testing before release.",
        "scenario_tagline": "Find the hidden doors before an attacker does.",
        "mission_brief": "Day 3 is a mentor-guided web attack-surface discovery mission. You will learn how to spot high-value routes, run a safe tool simulation like `dirsearch` or `ffuf`, read the output like an analyst, and explain which endpoint should be investigated next. Day 4 unlocks only when the full discovery chain validates.",
        "learn_points": [
            "Good web recon starts by observing routes and response patterns safely.",
            "A login panel, admin directory, or hidden endpoint changes risk because it changes where attention should go next.",
            "Surface discovery becomes useful only when you prioritize the strongest path and explain why it matters.",
        ],
        "learn_cards": [
            {
                "id": "day3-entry",
                "eyebrow": "Entry points",
                "title": "Start by finding the doors people are not meant to notice",
                "detail": "A login panel, admin route, or forgotten staging directory acts like a side entrance in a building. It tells you where privileged traffic or hidden functionality may live.",
                "proof_point": "The first useful path is the one that changes your testing plan immediately.",
                "action_label": "Find the first entry point",
            },
            {
                "id": "day3-enumeration",
                "eyebrow": "Enumeration",
                "title": "Use tooling to surface hidden routes safely",
                "detail": "A dirsearch-style pass is like checking every labeled and unlabeled door in a hallway. Most results are boring, but a few tell you exactly where risk might hide.",
                "proof_point": "Enumeration output becomes powerful when you separate noise from routes worth investigating.",
                "action_label": "Inspect the route list",
            },
            {
                "id": "day3-priority",
                "eyebrow": "Priority",
                "title": "Choose the route that deserves your next move",
                "detail": "The goal is not collecting a long list. The goal is identifying the one route that most likely exposes auth, admin behavior, or hidden application logic.",
                "proof_point": "A strong analyst note explains why one endpoint outranks the rest.",
                "action_label": "Write the discovery note",
            },
        ],
        "success_criteria": [
            "Start from a safe discovery command.",
            "Use enumeration output to identify a high-value route.",
            "Explain which discovered endpoint should be tested next and why.",
        ],
        "completion_badge": "Surface Hunter",
    },
    4: {
        "scenario": "A customer support portal is hours away from release, but internal testing surfaced three suspicious themes: the login accepts weak credentials, the search field reflects raw input, and an admin debug route appears reachable without a hard gate. You need to inspect those clues safely, name the weaknesses clearly, and brief the team before the app goes live.",
        "scenario_tagline": "Find the broken trust before it becomes the breach story.",
        "mission_brief": "Day 4 is a mentor-guided vulnerability module. You will learn to read auth, input, and misconfiguration clues in plain language, run a safe inspection command, classify the strongest weakness, and finish with a product-security brief. Day 5 unlocks only after the full reasoning chain validates.",
        "learn_points": [
            "Good appsec work starts by observing a real signal and naming the likely weakness precisely.",
            "Weak authentication, reflected input, and exposed debug routes represent different risk classes and need different fixes.",
            "The strongest analyst note ties evidence to vulnerability type, impact, and the smallest remediation step.",
        ],
        "learn_cards": [
            {
                "id": "day4-auth",
                "eyebrow": "Weak auth",
                "title": "Auth weaknesses usually look simple before they look dangerous",
                "detail": "A login flow that accepts `admin:admin`, lacks lockout, or protects admin areas with weak checks is often the fastest sign that identity trust is already breaking.",
                "proof_point": "The best first question is whether identity controls fail too easily for an attacker.",
                "action_label": "Classify the auth weakness",
            },
            {
                "id": "day4-input",
                "eyebrow": "Input",
                "title": "Reflected input is the app trusting the wrong words",
                "detail": "If a search term or parameter comes back unsanitized in the response, the important issue is not that the page looks weird. The issue is that attacker-controlled input is being trusted too far.",
                "proof_point": "You are looking for evidence that the application reflects or trusts attacker-controlled data.",
                "action_label": "Inspect the reflected signal",
            },
            {
                "id": "day4-misconfig",
                "eyebrow": "Misconfiguration",
                "title": "Misconfigurations are the doors the team forgot to close",
                "detail": "Debug endpoints, missing headers, and verbose banners often look minor until you realize they lower the cost of discovery for an attacker and reveal how the app behaves behind the scenes.",
                "proof_point": "Misconfiguration matters because it lowers the cost of attacker discovery and follow-up abuse.",
                "action_label": "Write the remediation note",
            },
        ],
        "success_criteria": [
            "Identify the highest-risk vulnerability signal from the scenario.",
            "Use a safe command to inspect evidence from the simulated target.",
            "Explain which weakness matters most and what should be fixed first.",
        ],
        "completion_badge": "Vuln Spotter",
    },
    5: {
        "scenario": "The support portal from Day 4 is still in a controlled staging range, and leadership wants proof of how the weakness chain could unfold. Your mission is to walk the breach path safely: identify the first exploitation move, simulate a non-destructive request, read the target response, and decide whether the chain proves account takeover, reflected injection, or debug-assisted escalation.",
        "scenario_tagline": "Feel the pressure, but validate every step before the chain moves forward.",
        "mission_brief": "Day 5 is a high-intensity but safely sandboxed exploitation simulation. Learn the breach path, pick the right attack logic, run one controlled command, analyze the resulting evidence, and unlock the next day only after ZORVIX-guided backend validation confirms the full sequence.",
        "learn_points": [
            "Exploitation logic is about chaining observed weaknesses into a credible path, not firing random payloads.",
            "A controlled simulation should prove risk with minimal impact and clear evidence at every step.",
            "The best operator note captures the chain, the proof, the failure consequence, and the first containment action.",
        ],
        "learn_cards": [
            {
                "id": "day5-chain",
                "eyebrow": "Breach path",
                "title": "Attack logic starts with the weakest trusted boundary",
                "detail": "Weak auth, reflected input, and debug exposure are not equal. The first operator move should target the shortest path to meaningful impact with the least noise.",
                "proof_point": "A good exploit simulation explains why one chain outruns the others before the first request is sent.",
                "action_label": "Choose the entry move",
            },
            {
                "id": "day5-proof",
                "eyebrow": "Proof",
                "title": "Controlled evidence beats noisy exploitation",
                "detail": "A safe `curl` request, login probe, or route check can prove a breach path without modifying the target or causing instability.",
                "proof_point": "The strongest proof is the one that demonstrates risk and still leaves the range clean.",
                "action_label": "Run the controlled request",
            },
            {
                "id": "day5-consequence",
                "eyebrow": "Consequence",
                "title": "Name the failure consequence before the room panics",
                "detail": "If the chain gives access, session material, reflected script execution, or privileged route visibility, your brief must say what the attacker gains and what gets fixed first.",
                "proof_point": "Elite operators describe the consequence and the fix in the same breath.",
                "action_label": "Deliver the breach brief",
            },
        ],
        "success_criteria": [
            "Choose the most credible first exploitation path from observed weaknesses.",
            "Run a safe command that proves the chain without changing server state.",
            "Explain the impact, evidence, and first containment step in analyst-quality language.",
        ],
        "completion_badge": "Chain Breaker",
    },
    6: {
        "scenario": "The staging portal has now moved into a synthetic breach-response range. Multiple failed admin logins, a sudden privileged session issue, and a suspicious outbound beacon appear within minutes of each other. You are the on-shift analyst and must detect the intrusion signal, validate what happened, and choose the first response action before the breach spreads.",
        "scenario_tagline": "See the signal, prove the breach, and respond before the window closes.",
        "mission_brief": "Day 6 is a defense-thinking module built like a live SOC drill. Read the dashboard, identify the strongest alert signal, inspect the breach telemetry with a safe log-analysis command, classify the incident consequence, and deliver the first containment decision. Day 7 unlocks only when the full detect-analyze-respond chain validates.",
        "learn_points": [
            "Defense work starts by separating noise from the alert that actually changes risk.",
            "A good analyst reads logs for sequence and consequence: failed auth, session issuance, and outbound traffic together mean more than any one event alone.",
            "The best first response preserves evidence while reducing blast radius immediately.",
        ],
        "learn_cards": [
            {
                "id": "day6-detect",
                "eyebrow": "Detect",
                "title": "Find the signal that changes the room",
                "detail": "Repeated failed logins matter, but they matter far more when they are followed by a privileged session and a suspicious outbound connection from the same host.",
                "proof_point": "The job is not to read every line. The job is to identify the sequence that proves attacker progress.",
                "action_label": "Choose the alert to escalate",
            },
            {
                "id": "day6-analyze",
                "eyebrow": "Analyze",
                "title": "Read telemetry like a timeline",
                "detail": "Logs, alerts, and session artifacts should be treated as one story: authentication pressure, access gained, and possible command-and-control behavior.",
                "proof_point": "A strong analyst note ties multiple signals into one defendable breach hypothesis.",
                "action_label": "Inspect the telemetry chain",
            },
            {
                "id": "day6-respond",
                "eyebrow": "Respond",
                "title": "Contain without destroying evidence",
                "detail": "The first move should slow the attacker down and preserve what happened. Isolating the host or disabling the account often beats noisy cleanup.",
                "proof_point": "Response quality is judged by whether risk is reduced and evidence remains usable.",
                "action_label": "Choose the first containment move",
            },
        ],
        "success_criteria": [
            "Escalate the alert sequence that proves attacker progress.",
            "Use a real log-analysis command to inspect the breach timeline safely.",
            "Explain the first response action in senior-analyst language.",
        ],
        "completion_badge": "SOC First Responder",
    },
    7: {
        "scenario": "A training target has now combined everything from the previous days into one flowing mission. Recon exposed `/admin`, `/login`, and `/admin/debug`; weak admin credentials remain active; and reflected search input still exists on the same application. Your job is to chain those signals like a real operator: confirm the best entry path, prove the first foothold safely, and show how the chain escalates into meaningful impact without damaging the environment.",
        "scenario_tagline": "Recon creates the opening. Entry proves the path. Exploit logic defines the outcome.",
        "mission_brief": "Day 7 is the first full attack-chain mission. Move from recon to entry to exploit in one connected flow, where each validated step shapes the next one. ZORVIX will react to your choices in real time, but the mission only unlocks forward when the chain is credible, evidenced, and safely simulated.",
        "learn_points": [
            "A true attack chain is not random activity. It is a sequence where each signal increases attacker leverage.",
            "Recon matters only if it helps you choose the best entry path, and entry matters only if it leads to provable impact.",
            "The strongest exploit simulation explains not just what worked, but why that chain beat the alternatives.",
        ],
        "learn_cards": [
            {
                "id": "day7-recon",
                "eyebrow": "Recon",
                "title": "Pick the clue that opens the mission",
                "detail": "Routes like `/login`, `/admin`, and `/admin/debug` are not all equal. The best recon finding is the one that shortens the path to privilege or sensitive functionality.",
                "proof_point": "The first move in a chain should raise attacker leverage, not just produce more noise.",
                "action_label": "Choose the entry clue",
            },
            {
                "id": "day7-entry",
                "eyebrow": "Entry",
                "title": "Turn the route into a foothold",
                "detail": "A safe probe should confirm auth behavior, route exposure, or a weak trust boundary without mutating the system.",
                "proof_point": "Good entry logic proves the opening and sets up the exploit step immediately.",
                "action_label": "Confirm the foothold",
            },
            {
                "id": "day7-exploit",
                "eyebrow": "Exploit",
                "title": "Chain the weakness into impact",
                "detail": "Exploit thinking means asking what the attacker gets next: privileged session, admin reach, injected script execution, or another escalation path.",
                "proof_point": "The chain is only complete when you can name the impact and defend why it follows from the prior evidence.",
                "action_label": "State the impact",
            },
        ],
        "success_criteria": [
            "Use recon to identify the highest-value entry path.",
            "Run safe commands that prove entry and exploit progression without changing state.",
            "Explain the full chain, consequence, and why it outranks weaker paths.",
        ],
        "completion_badge": "Chain Architect",
    },
    8: {
        "scenario": "An exposed staging stack is now in a live decision drill. The attack team sees weak admin auth and a reachable debug route, while the defense team sees repeated auth failures and suspicious outbound traffic. You must choose between competing attack and defense paths, evaluate the risk of each choice, and justify the outcome before the mission advances.",
        "scenario_tagline": "Every decision changes the outcome. Pick the path, weigh the risk, and own the consequence.",
        "mission_brief": "Day 8 is a branching cybersecurity lab. Each choice points toward a different outcome: exploit pressure, containment pressure, or evidence-first patience. ZORVIX will analyze your decisions like a coach, explain the consequence of the path you picked, and adapt the mission difficulty based on how cleanly you justify the risk.",
        "learn_points": [
            "A good cyber decision is not just fast. It is justified by leverage, evidence, and risk.",
            "Attack and defense paths both have consequences: the fastest path may be noisy, and the safest path may lose the window.",
            "Strong operators explain why one branch is worth more than the alternatives before acting.",
        ],
        "learn_cards": [
            {
                "id": "day8-branches",
                "eyebrow": "Branches",
                "title": "Attack, defend, or hold for evidence",
                "detail": "Branching decisions matter because each path changes what happens next. A noisy exploit path increases detection risk, while a patient defense path can preserve the story but lose attacker visibility.",
                "proof_point": "The right choice depends on leverage, risk, and mission objective, not ego.",
                "action_label": "Choose the branch",
            },
            {
                "id": "day8-risk",
                "eyebrow": "Risk",
                "title": "Score the consequence before you move",
                "detail": "Every branch should be evaluated in terms of likelihood, impact, and evidence quality. If you cannot explain those three, you are guessing.",
                "proof_point": "Risk evaluation turns choices into repeatable operator decisions.",
                "action_label": "Explain the tradeoff",
            },
            {
                "id": "day8-adapt",
                "eyebrow": "Adapt",
                "title": "Let the mission react to your reasoning",
                "detail": "ZORVIX is not just answering questions here. It is checking whether your chosen branch creates the next step logically and whether your justification matches the consequence.",
                "proof_point": "Adaptive difficulty means sharper reasoning earns faster progression.",
                "action_label": "Drive the next state",
            },
        ],
        "success_criteria": [
            "Choose a high-value attack or defense branch and justify it.",
            "Use a safe command to inspect the evidence that supports your path.",
            "Explain the consequence and risk of the chosen branch in operator language.",
        ],
        "completion_badge": "Decision Operator",
    },
    9: {
        "scenario": "At 09:14, an internal workstation starts beaconing to an unfamiliar external IP moments after a suspicious admin session appears in the web stack. Security alerts, Windows-style auth logs, and egress telemetry are arriving at once. You are the incident commander for the first fifteen minutes and must investigate, contain, and recover the environment before the attacker expands access.",
        "scenario_tagline": "Read the timeline, stop the spread, and recover without losing the evidence trail.",
        "mission_brief": "Day 9 is a live incident response simulation. Follow the timeline, inspect the log evidence, choose the first containment action, and define the first recovery move. ZORVIX will evaluate whether your investigation, containment, and recovery decisions actually fit the incident rather than just sounding urgent.",
        "learn_points": [
            "Incident response starts with timeline clarity: what happened first, what changed risk, and what must be protected now.",
            "Containment and recovery are different decisions. One reduces attacker freedom; the other restores trust after control is regained.",
            "The best responder leaves behind a defendable story, preserved evidence, and a measured first recovery plan.",
        ],
        "learn_cards": [
            {
                "id": "day9-timeline",
                "eyebrow": "Timeline",
                "title": "Anchor the incident before you chase it",
                "detail": "A burst of auth failures, an unusual admin session, and an outbound connection form a sequence. Your first job is to prove the sequence, not react to isolated lines.",
                "proof_point": "Incident quality starts with ordering the evidence correctly.",
                "action_label": "Read the timeline",
            },
            {
                "id": "day9-contain",
                "eyebrow": "Containment",
                "title": "Contain fast, but not blindly",
                "detail": "Isolation, account disablement, token reset, and outbound blocking all reduce risk differently. The right move depends on the evidence you already trust.",
                "proof_point": "Great containment reduces spread and preserves what happened.",
                "action_label": "Choose the first control",
            },
            {
                "id": "day9-recover",
                "eyebrow": "Recovery",
                "title": "Recovery begins after control, not before",
                "detail": "Restoring service too early can return the attacker to a half-cleaned environment. Recovery plans should follow verified containment and evidence capture.",
                "proof_point": "A recovery step is valid only if it restores trust, not just availability.",
                "action_label": "Plan the first recovery action",
            },
        ],
        "success_criteria": [
            "Use timeline evidence to identify the true incident sequence.",
            "Choose a containment action that reduces spread while preserving evidence.",
            "Define the first recovery step in language an incident lead would accept.",
        ],
        "completion_badge": "Incident Commander",
    },
    10: {
        "scenario": "Welcome to the arena. Three sealed missions await: SIGMA, APEX, and OMEGA. No walkthroughs. No comfort rails. Each mission compresses recon, exploitation logic, defensive reasoning, and operator judgment into one timed challenge. You either validate the chain cleanly or the gate stays shut.",
        "scenario_tagline": "Three missions. No filler. Cold validation only.",
        "mission_brief": "Day 10 is an elite challenge arena. SIGMA tests your opening read, APEX tests your leverage under pressure, and OMEGA tests whether you can finish with a precise adversarial judgment. ZORVIX does not coach here until the arena ends. It evaluates.",
        "learn_points": [
            "SIGMA, APEX, and OMEGA must be solved with evidence, not momentum.",
            "Every mission compresses prior days into one hard decision loop.",
            "Hints exist, but they cost score and never replace operator judgment.",
        ],
        "learn_cards": [
            {
                "id": "day10-sigma",
                "eyebrow": "SIGMA",
                "title": "Find the opening without being told where to look",
                "detail": "The first mission rewards operators who can identify the one route or signal that matters and ignore decorative noise.",
                "proof_point": "The fastest move is only useful if it increases leverage.",
                "action_label": "Open mission SIGMA",
            },
            {
                "id": "day10-apex",
                "eyebrow": "APEX",
                "title": "Prove the chain under pressure",
                "detail": "The second mission forces you to justify the attacker or defender advantage created by the first move and explain what changes risk immediately.",
                "proof_point": "High difficulty means less room for vague language.",
                "action_label": "Open mission APEX",
            },
            {
                "id": "day10-omega",
                "eyebrow": "OMEGA",
                "title": "Finish with cold precision",
                "detail": "The final mission only accepts a concise operator-grade conclusion that combines impact, evidence, and optimal next action.",
                "proof_point": "No partial credit means every word must earn its place.",
                "action_label": "Open mission OMEGA",
            },
        ],
        "success_criteria": [
            "Clear SIGMA, APEX, and OMEGA without relying on filler answers.",
            "Use real commands or operator language that prove the chain cleanly.",
            "Finish with a concise final judgment that would survive review.",
        ],
        "completion_badge": "Arena Finisher",
    },
    11: {
        "scenario": "Three live scenarios are already unfolding when you arrive. A finance workstation is beaconing, a cloud console session looks suspicious, and an internal web stack just issued a privileged token after a burst of failed admin logins. You do not know motive, attacker identity, or the full chain yet. You only have partial signals and the consequences of whatever you do next.",
        "scenario_tagline": "Not what you know. How you think under uncertainty.",
        "mission_brief": "Day 11 is an active threat simulation. Observe the partial signals, analyze the strongest clue, make a permanent decision, and act. There are no neutral choices. Inaction has a cost. ZORVIX stays silent while you think and only responds after the decision lands.",
        "learn_points": [
            "Uncertainty is the point of the mission. You are graded on decision quality, not memorized facts.",
            "Every branch changes the attacker and the environment. Inaction also shapes the outcome.",
            "Strong operators explain why they moved with incomplete context and what risk they accepted by doing so.",
        ],
        "learn_cards": [
            {
                "id": "day11-observe",
                "eyebrow": "Observe",
                "title": "Partial signals are enough to act if you read them cleanly",
                "detail": "A beacon, a privileged session, and a suspicious cloud action may or may not belong to the same attacker. Your job is to identify the most dangerous signal first.",
                "proof_point": "You are not waiting for certainty. You are choosing the strongest signal under pressure.",
                "action_label": "Read the first scenario",
            },
            {
                "id": "day11-decide",
                "eyebrow": "Decide",
                "title": "There are no neutral choices here",
                "detail": "Containment, monitoring, isolation, and delay each carry different costs. Choosing not to move is still a move.",
                "proof_point": "Decision quality is measured by what risk you accepted and why.",
                "action_label": "Commit to the path",
            },
            {
                "id": "day11-adapt",
                "eyebrow": "Adapt",
                "title": "The attacker changes because you changed the board",
                "detail": "Each decision evolves the scenario. The next signal depends on whether you pressured the attacker, lost visibility, or waited too long.",
                "proof_point": "A good threat operator anticipates the next state, not just the current one.",
                "action_label": "Own the next evolution",
            },
        ],
        "success_criteria": [
            "Identify the most dangerous partial signal without overcommitting to noise.",
            "Make a decision that accepts and explains real risk.",
            "Act with a credible next step and justify the evolving threat state.",
        ],
        "completion_badge": "Adversarial Judge",
    },
    12: {
        "scenario": "A workstation named `WKSTN-04` is already compromised inside a segmented training network. You have partial access, one cached credential clue, and visibility into three internal targets: `FILE-02`, `APP-01`, and `DC-CORE`. Your mission is to reason through the lateral path, choose the right access point, validate the next movement safely, and explain how privilege actually escalates without burning the route.",
        "scenario_tagline": "Move laterally with discipline: node, credential, privilege, then consequence.",
        "mission_brief": "Day 12 is a lateral movement simulation. Read the internal network picture, identify the best pivot path, run one safe command to validate access logic, choose the privilege-escalation interpretation, and finish with an operator debrief explaining the optimal path. ZORVIX should feel like a senior operator here: guiding, challenging, and then judging the path after validation.",
        "learn_points": [
            "Lateral movement is about leverage, not motion. The best next hop is the one that changes privilege or blast radius.",
            "A cached credential, reused service token, or mis-scoped share matters only if it gives you access to a more valuable node.",
            "Strong operators explain the path as a chain: source node, credential, destination, privilege gain, and defensive consequence.",
        ],
        "learn_cards": [
            {
                "id": "day12-pivot",
                "eyebrow": "Pivot logic",
                "title": "Choose the node that actually changes the mission",
                "detail": "Moving from one host to another is not impressive on its own. The right pivot is the one that gets you closer to privileged systems, broader access, or sensitive control points.",
                "proof_point": "A good lateral move increases leverage, not just movement count.",
                "action_label": "Pick the first pivot",
            },
            {
                "id": "day12-credential",
                "eyebrow": "Credential signal",
                "title": "Credentials matter because of where they lead",
                "detail": "A reused local admin password, cached share token, or service account only matters if it opens a path you did not have before.",
                "proof_point": "The best analysts describe both the credential and the node it unlocks.",
                "action_label": "Validate the access path",
            },
            {
                "id": "day12-escalation",
                "eyebrow": "Privilege",
                "title": "End the chain by naming the real privilege gain",
                "detail": "Your job is to explain what the attacker gains next: broader file access, service execution, administrative control, or domain-level leverage.",
                "proof_point": "A complete lateral movement story ends with privilege, not just connectivity.",
                "action_label": "Write the operator debrief",
            },
        ],
        "success_criteria": [
            "Identify the strongest lateral pivot from the compromised host.",
            "Use a safe command to validate the access or credential path.",
            "Explain the resulting privilege gain and why it matters defensively.",
        ],
        "completion_badge": "Lateral Operator",
    },
    13: {
        "scenario": "A finance application server is already compromised, and telemetry shows access to `/srv/finance/exports`, `legal-archive.zip`, and a sync channel pointing toward `198.51.100.44`. Depending on role, you must either simulate the attacker path that would extract the highest-value data safely inside the range or act as the defender and stop the leak before the transfer window closes.",
        "scenario_tagline": "Find the sensitive path, choose the role, and decide whether to extract or contain before the window closes.",
        "mission_brief": "Day 13 is a branching exfiltration-vs-defense mission. Choose the attack or defense role, identify the most sensitive data path, run one timed command that proves extraction or leak-prevention logic, evaluate the risk of that path, and finish with a precise ZORVIX-reviewed debrief. Hint usage costs performance score.",
        "learn_points": [
            "Data exfiltration risk is about path, value, and timing, not just file names.",
            "Attackers look for quiet export points; defenders look for the transfer route that changes business impact first.",
            "The best operator explanation names the data path, the transfer method, the risk level, and the next control or exploit move.",
        ],
        "learn_cards": [
            {
                "id": "day13-path",
                "eyebrow": "Sensitive path",
                "title": "Look for where high-value data naturally moves",
                "detail": "Exports, archives, staging shares, and backup sync jobs matter because they already solve the attacker’s hardest problem: collecting valuable data in one place.",
                "proof_point": "The strongest path is the one that combines sensitivity, access, and a believable transfer route.",
                "action_label": "Identify the high-value path",
            },
            {
                "id": "day13-role",
                "eyebrow": "Role branch",
                "title": "Extraction and defense see the same path differently",
                "detail": "An attacker asks how quietly data can move. A defender asks which route must be interrupted first to stop business damage. Same evidence, different decision.",
                "proof_point": "Good branching logic means your role changes the best next move, not the facts.",
                "action_label": "Choose the role",
            },
            {
                "id": "day13-risk",
                "eyebrow": "Risk call",
                "title": "Score the leak before you narrate it",
                "detail": "A believable exfiltration scenario needs impact, route credibility, and timing pressure. If one of those is weak, the story is weak.",
                "proof_point": "Precise risk language beats dramatic language every time.",
                "action_label": "Make the risk call",
            },
        ],
        "success_criteria": [
            "Choose a credible extraction or defense role based on the scenario.",
            "Use a timed command to prove the sensitive path or leak-prevention route.",
            "Explain the risk level, mistake pattern, and optimal next move with no filler.",
        ],
        "completion_badge": "Exfiltration Arbiter",
    },
    14: {
        "scenario": "A staging commerce platform exposes `/partner/login`, an internal metrics node at `10.10.22.17:8443`, and an order-approval workflow that trusts a client-side role flag after a successful partner session. Security review missed the combination, but you did not. Your mission is to identify the web flaw, the network pivot, and the logic weakness, then chain them into one realistic exploit path before the timer closes.",
        "scenario_tagline": "One web flaw, one network gap, one logic mistake. Chain them before the window closes.",
        "mission_brief": "Day 14 is a multi-vector attack simulation. There is no guidance rail. Identify the strongest web, network, and logic signals, validate the chain with timed actions, and finish with a cold exploit-path judgment. Hints cost score and weak chains fail validation outright.",
        "learn_points": [
            "Single issues do not matter here unless they combine into leverage.",
            "A strong chain explains how web access enables network reach and how network reach exposes the logic flaw that turns access into impact.",
            "Operator-quality scoring rewards the shortest credible chain, not the loudest one.",
        ],
        "learn_cards": [
            {
                "id": "day14-web",
                "eyebrow": "Web vector",
                "title": "Find the route that changes identity or trust first",
                "detail": "A partner login panel or exposed admin path matters because it can create the session context needed for every later move.",
                "proof_point": "The web vector is only valuable if it opens the next vector.",
                "action_label": "Identify the web opening",
            },
            {
                "id": "day14-network",
                "eyebrow": "Network vector",
                "title": "Look for the internal path that should not be reachable",
                "detail": "A metrics port, internal admin service, or flat-trust segment matters because it creates access where the web edge should have stopped you.",
                "proof_point": "The network vector turns session context into positional advantage.",
                "action_label": "Identify the pivot",
            },
            {
                "id": "day14-logic",
                "eyebrow": "Logic vector",
                "title": "The chain ends where business logic trusts the wrong thing",
                "detail": "If the workflow trusts a client-side role flag, approval state, or predictable identifier, the attacker no longer needs a dramatic exploit. They need the right sequence.",
                "proof_point": "Logic flaws become dangerous when the earlier vectors put you exactly where trust is weakest.",
                "action_label": "Call the exploit path",
            },
        ],
        "success_criteria": [
            "Identify the decisive web, network, and logic flaws.",
            "Use timed commands or choices to prove the chain in the shortest credible sequence.",
            "Explain the final exploit path, tactical mistake, and optimal move with no filler.",
        ],
        "completion_badge": "Vector Architect",
    },
    15: {
        "scenario": "A simulated enterprise battle arena is in motion. An exposed partner application is still under attack, an internal command node is reachable through one segmented exception, and a blue-team control plane can still isolate one tier or burn one credential path. You do not have infinite moves. Each stage forces a choice between attack leverage and defensive preservation, and every commitment changes the next board state.",
        "scenario_tagline": "Attack and defend in the same arena. Spend the right resource at the right stage or lose the board.",
        "mission_brief": "Day 15 is a strategic cyber battle arena. Move through multiple stages, choose between attack and defense pressure, manage limited resources, act under a timer, and accept strict scoring. ZORVIX stays silent while you execute and returns only after completion with a cold mission analysis, rank, and progression judgment.",
        "learn_points": [
            "Strategic cyber work is about sequencing limited moves, not doing everything at once.",
            "Attack pressure, defensive control, and reserve capacity all trade off against one another.",
            "The best arena answer explains why one resource was spent now instead of later.",
        ],
        "learn_cards": [
            {
                "id": "day15-stage",
                "eyebrow": "Stages",
                "title": "The board changes every time you commit",
                "detail": "A strong first move is the one that improves your next position, not just the one that feels decisive in the moment.",
                "proof_point": "Stage quality matters because every decision changes what remains possible later.",
                "action_label": "Read the board",
            },
            {
                "id": "day15-resource",
                "eyebrow": "Resources",
                "title": "You do not get every move",
                "detail": "Burning a credential, isolating a tier, or pushing an exploit path all spend opportunity. Good operators know what they are giving up.",
                "proof_point": "Resource management is really tradeoff management under pressure.",
                "action_label": "Spend the right resource",
            },
            {
                "id": "day15-evaluation",
                "eyebrow": "Evaluation",
                "title": "Winning the room means explaining why your sequence works",
                "detail": "The arena does not reward noise. It rewards the shortest sequence that changes the balance in your favor and survives cold review.",
                "proof_point": "A strategic answer names the move, the cost, the gain, and the next board state.",
                "action_label": "Deliver the mission judgment",
            },
        ],
        "success_criteria": [
            "Choose the right attack or defense pressure at each stage.",
            "Use a timed command or action to validate the board state before spending more resources.",
            "Explain the final sequence, resource tradeoff, and winning move under strict scoring.",
        ],
        "completion_badge": "Battle Strategist",
    },
}


def build_learn_cards(seed: DaySeed, learn_points: list[str]) -> list[dict[str, str]]:
    if seed.day == 1:
        return DAY_ONE_LEARN_CARDS
    cards: list[dict[str, str]] = []
    for index, point in enumerate(learn_points, start=1):
        cards.append(
            {
                "id": f"{seed.focus}-learn-{index}",
                "eyebrow": f"{seed.focus.title()} Principle {index}",
                "title": point.split(".")[0].strip(),
                "detail": point,
                "proof_point": f"Day {seed.day} validates this principle through a backend-scored task.",
                "action_label": f"Apply principle {index}",
            }
        )
    return cards


def build_mission_assets(seed: DaySeed, meta: dict[str, Any], scenario_frame: dict[str, Any]) -> list[dict[str, str]]:
    focus_labels = {
        "foundation": "Operator baseline",
        "intel": "Recon scope",
        "appsec": "Application target",
        "defense": "Detection stream",
        "cloud": "Cloud surface",
        "hunt": "Hunt hypothesis",
        "capstone": "Reviewer outcome",
    }
    artifact_labels = {
        "foundation": "Shell context + analyst note",
        "intel": "Verified signal + intel brief",
        "appsec": "Safe probe + remediation note",
        "defense": "Telemetry evidence + containment note",
        "cloud": "Posture finding + hardening proof",
        "hunt": "Signal query + escalation decision",
        "capstone": "Technical proof + reviewer-ready report",
    }
    return [
        {
            "id": f"{seed.day}-track",
            "label": "Mission track",
            "value": focus_labels.get(seed.focus, "Operator workflow"),
            "tone": "info",
        },
        {
            "id": f"{seed.day}-threat",
            "label": "Threat posture",
            "value": scenario_frame["threat_level"],
            "tone": "warning" if scenario_frame["threat_level"] in {"High", "Critical"} else "neutral",
        },
        {
            "id": f"{seed.day}-artifact",
            "label": "Deliverable",
            "value": artifact_labels.get(seed.focus, "Validated mission output"),
            "tone": "success",
        },
        {
            "id": f"{seed.day}-env",
            "label": "Range",
            "value": str(meta["environment"]),
            "tone": "neutral",
        },
    ]


def build_console_boot_lines(seed: DaySeed, meta: dict[str, Any], scenario_frame: dict[str, Any]) -> list[str]:
    return [
        f"[zorvix] Booting Day {seed.day} operator simulation...",
        f"[profile] role={scenario_frame['operator_role']} focus={seed.focus} difficulty={meta['difficulty']}",
        f"[range] {meta['environment']}",
        f"[objective] {seed.title}",
        f"[status] Awaiting validated action.",
    ]


def build_debrief_points(seed: DaySeed) -> list[str]:
    by_focus = {
        "foundation": [
            "Explain which signal changed your confidence the fastest.",
            "State how the first terminal move reduced uncertainty.",
            "Capture the principle you will repeat on the next day.",
        ],
        "intel": [
            "Name the signal you trust most and why.",
            "Record the second source that would verify it.",
            "Summarize what exposure means in analyst language.",
        ],
        "appsec": [
            "Write the strongest proof point from the app response.",
            "State the risk in language a developer will respect.",
            "End with the smallest fix that changes the risk posture.",
        ],
        "defense": [
            "Capture the first telemetry clue that justified action.",
            "State the containment step and the evidence you preserved.",
            "Write the next detection query you would monitor.",
        ],
        "cloud": [
            "Name the exposure or privilege boundary that mattered most.",
            "Describe the hardening action that reduces blast radius.",
            "State how you would verify the control held after the fix.",
        ],
        "hunt": [
            "Restate the hypothesis in one line.",
            "Identify the evidence that increased your confidence.",
            "Record why the final decision did or did not justify escalation.",
        ],
        "capstone": [
            "Highlight the most reviewer-ready proof point from the day.",
            "Explain the operator judgment behind the final answer.",
            "Name the artifact that would best represent this work publicly.",
        ],
    }
    return by_focus.get(seed.focus, ["Capture the best signal from the mission.", "Explain why it mattered.", "State the next move."])


def _focus_quiz_task(seed: DaySeed) -> TaskDefinition:
    if seed.focus == "foundation":
        return TaskDefinition(
            id="concept-check",
            title="Choose the strongest foundation move",
            instruction=f"For '{seed.title}', which operator behavior is the best starting point?",
            expected_type="quiz",
            hint="Pick the action that builds trusted context before deeper work.",
            success_message="Correct. Strong operators start with context, not assumption.",
            accepted_terms=[["verify context", "verify", "baseline", "context"]],
            score=18,
            xp=10,
            interaction_type="single-select",
            options=[
                {"label": "Verify context and baseline first", "value": "verify context baseline"},
                {"label": "Guess the system state and move quickly", "value": "guess quickly"},
                {"label": "Skip directly to advanced exploitation", "value": "advanced exploitation"},
            ],
            validation_focus=["operator discipline", "foundations"],
        )
    if seed.focus == "intel":
        return TaskDefinition(
            id="source-selection",
            title="Pick the best first evidence source",
            instruction=f"For '{seed.title}', which starting point gives the strongest verified signal?",
            expected_type="quiz",
            hint="Choose the source you can verify and cross-check quickly.",
            success_message="Correct. Recon starts with a source that can be validated, not guessed.",
            accepted_terms=[["verified source", "whois", "dns", "header"]],
            score=18,
            xp=10,
            interaction_type="single-select",
            options=[
                {"label": "A verified source such as WHOIS, DNS, or headers", "value": "verified source whois dns header"},
                {"label": "A social post with no proof", "value": "social post no proof"},
                {"label": "A memory of what the target looked like last week", "value": "memory last week"},
            ],
            validation_focus=["verification", "osint quality"],
        )
    if seed.focus == "appsec":
        return TaskDefinition(
            id="risk-selection",
            title="Choose the safest first test move",
            instruction=f"In '{seed.title}', what is the strongest first step before claiming a vulnerability?",
            expected_type="quiz",
            hint="Start by observing the application safely and collecting evidence.",
            success_message="Correct. Safe observation and evidence collection come before hard claims.",
            accepted_terms=[["safe observation", "inspect", "headers", "response", "recon"]],
            score=18,
            xp=10,
            interaction_type="single-select",
            options=[
                {"label": "Inspect the app safely and collect response evidence first", "value": "safe observation inspect headers response recon"},
                {"label": "Assume the bug category from the page title alone", "value": "assume bug"},
                {"label": "Jump straight to destructive testing", "value": "destructive testing"},
            ],
            validation_focus=["safe testing", "evidence first"],
        )
    if seed.focus == "defense":
        return TaskDefinition(
            id="triage-priority",
            title="Choose the first defensive priority",
            instruction=f"During '{seed.title}', what should happen before deep analysis?",
            expected_type="quiz",
            hint="Pick the move that preserves evidence and reduces immediate risk.",
            success_message="Correct. Good defenders contain risk and keep evidence intact.",
            accepted_terms=[["contain", "evidence", "triage", "telemetry"]],
            score=18,
            xp=10,
            interaction_type="single-select",
            options=[
                {"label": "Contain risk while preserving evidence and telemetry", "value": "contain evidence triage telemetry"},
                {"label": "Delete logs so the system looks clean", "value": "delete logs"},
                {"label": "Ignore alerts until the shift ends", "value": "ignore alerts"},
            ],
            validation_focus=["triage", "containment"],
        )
    if seed.focus == "cloud":
        return TaskDefinition(
            id="cloud-priority",
            title="Choose the first hardening lens",
            instruction=f"For '{seed.title}', what should you validate first?",
            expected_type="quiz",
            hint="Think exposure, privilege, and secret handling.",
            success_message="Correct. Cloud hardening begins with exposure and privilege boundaries.",
            accepted_terms=[["exposure", "privilege", "access", "secret"]],
            score=18,
            xp=10,
            interaction_type="single-select",
            options=[
                {"label": "Public exposure, privilege scope, and secret handling", "value": "exposure privilege access secret"},
                {"label": "Only the background color of the console", "value": "console color"},
                {"label": "Nothing until a breach happens", "value": "wait for breach"},
            ],
            validation_focus=["least privilege", "cloud posture"],
        )
    if seed.focus == "hunt":
        return TaskDefinition(
            id="hunt-lens",
            title="Choose the strongest hunt approach",
            instruction=f"In '{seed.title}', what should drive the first hunt step?",
            expected_type="quiz",
            hint="Pick a hypothesis tied to evidence, not noise.",
            success_message="Correct. Hunting starts from a testable hypothesis and signal path.",
            accepted_terms=[["hypothesis", "signal", "evidence", "testable"]],
            score=18,
            xp=10,
            interaction_type="single-select",
            options=[
                {"label": "A testable hypothesis tied to evidence and signal", "value": "hypothesis signal evidence testable"},
                {"label": "A random guess with no telemetry", "value": "random guess"},
                {"label": "Every log line at once with no scope", "value": "all logs no scope"},
            ],
            validation_focus=["hunt hypothesis", "signal quality"],
        )
    return TaskDefinition(
        id="capstone-direction",
        title="Choose the strongest deliverable direction",
        instruction=f"For '{seed.title}', what makes the capstone output reviewer-ready?",
        expected_type="quiz",
        hint="Pick the answer that combines proof, reproducibility, and judgment.",
        success_message="Correct. Strong capstone work proves technical depth and operator judgment together.",
        accepted_terms=[["evidence", "reproducible", "judgment", "report"]],
        score=18,
        xp=10,
        interaction_type="single-select",
        options=[
            {"label": "Evidence-backed, reproducible, and clear to a reviewer", "value": "evidence reproducible judgment report"},
            {"label": "A vague claim with no proof", "value": "vague claim"},
            {"label": "A screenshot without explanation", "value": "screenshot only"},
        ],
        validation_focus=["deliverable quality", "review readiness"],
    )


def _task_bundle(seed: DaySeed) -> list[TaskDefinition]:
    if seed.day == 1:
        return [
            TaskDefinition(
                id="cia-triad-quiz",
                title="Spot what failed first",
                instruction="Your team's public status page has been defaced, but customers can still load it and customer records are untouched. What failed first?",
                expected_type="quiz",
                hint="Ask yourself: what changed for the user? Secrecy, trust in the content, or availability?",
                success_message="Exactly right. The page is still reachable, but the trusted content was changed. That makes integrity the first broken pillar.",
                accepted_terms=[["integrity"]],
                score=18,
                xp=10,
                interaction_type="single-select",
                options=[
                    {"label": "Confidentiality", "value": "confidentiality"},
                    {"label": "Integrity", "value": "integrity"},
                    {"label": "Availability", "value": "availability"},
                ],
                validation_focus=["CIA triad", "incident classification"],
            ),
            TaskDefinition(
                id="first-terminal-step",
                title="Run your first calm command",
                instruction="You open a fresh Kali shell. Before doing anything advanced, what safe command would you run first to understand your current context?",
                expected_type="terminal",
                hint="A great first move is small and boring on purpose: `pwd`, `ls`, or `whoami` are perfect here.",
                success_message="Good call. You started by grounding yourself in reality instead of guessing.",
                accepted_terms=[["pwd", "ls", "whoami"]],
                score=28,
                xp=16,
                validation_focus=["terminal discipline", "safe operator habits"],
            ),
            TaskDefinition(
                id="evidence-check-quiz",
                title="Choose the signal that actually helps",
                instruction="Which result best proves that your first command gave you useful context before you acted?",
                expected_type="quiz",
                hint="Pick the answer that gives you something concrete you could explain to another analyst.",
                success_message="Exactly. A useful command changes your understanding because the output gives you something concrete to point at.",
                accepted_terms=[["current directory", "working directory", "path"]],
                score=20,
                xp=12,
                interaction_type="single-select",
                options=[
                    {"label": "A random screenshot from another session", "value": "random screenshot"},
                    {"label": "The current directory or working path shown by the shell", "value": "current directory working path"},
                    {"label": "A guess that the system is probably Linux", "value": "guess linux"},
                ],
                validation_focus=["evidence-based reasoning", "operator verification"],
            ),
            TaskDefinition(
                id="operator-brief",
                title="Write the mentor-style takeaway",
                instruction="In one short sentence, explain why the CIA triad matters before you start real security work on a live problem.",
                expected_type="brief",
                hint="Keep it simple: mention one CIA pillar and explain how it helps you make a better first decision.",
                success_message="Strong answer. You explained the concept like an operator, not like someone reciting a definition.",
                accepted_terms=[["confidentiality", "integrity", "availability", "evidence", "decision", "risk"]],
                score=30,
                xp=18,
                validation_focus=["analyst communication", "security fundamentals"],
            ),
        ]
    if seed.day == 2:
        return [
            TaskDefinition(
                id="recon-source-quiz",
                title="Choose the strongest first recon source",
                instruction="You need one fast, defensible first signal on a target domain. Which starting point gives you the clearest evidence you can trust and explain?",
                expected_type="quiz",
                hint="Pick the source you could confidently show to another analyst and cite in a short note.",
                success_message="Correct. Good reconnaissance starts with something you can verify, not something you only suspect.",
                accepted_terms=[["whois", "dns", "verified source"]],
                score=18,
                xp=10,
                interaction_type="single-select",
                options=[
                    {"label": "WHOIS or DNS from an authoritative source", "value": "whois dns verified source"},
                    {"label": "A screenshot from social media", "value": "social screenshot"},
                    {"label": "A guess based on last week's memory", "value": "guess last week"},
                ],
                validation_focus=["recon source", "verification"],
            ),
            TaskDefinition(
                id="recon-whois-command",
                title="Run the registrar recon command",
                instruction="Submit the first command you would run to gather authoritative registration or ownership context on the target domain.",
                expected_type="terminal",
                hint="A clean start is `whois target.com` or `dig ns target.com` when you want registrar or nameserver context before going deeper.",
                success_message="Command accepted. You started the recon the right way: quiet, direct, and based on a trusted source.",
                accepted_terms=[["whois", "dig ns", "dig"]],
                score=28,
                xp=16,
                validation_focus=["registrar context", "authoritative recon"],
            ),
            TaskDefinition(
                id="recon-dns-command",
                title="Inspect the DNS or subdomain clue",
                instruction="Now follow the first clue. Submit the next command you would run to inspect DNS or a likely subdomain signal for the same target.",
                expected_type="terminal",
                hint="Use `nslookup`, `dig`, or a DNS-focused command against the target or a candidate subdomain like `api`, `dev`, or `staging`.",
                success_message="Command accepted. You took the first clue and turned it into a stronger recon signal.",
                accepted_terms=[["nslookup", "dig", "mx", "a ", "www", "dev", "api", "staging"]],
                score=24,
                xp=14,
                validation_focus=["dns lookup", "subdomain clue"],
            ),
            TaskDefinition(
                id="recon-analysis-quiz",
                title="Choose the strongest verified finding",
                instruction="Which recon result gives you the strongest analyst-grade signal to carry into the brief and act on next?",
                expected_type="quiz",
                hint="Pick the observation you could cite, cross-check, and actually use to justify the next recon step.",
                success_message="Correct. Recon becomes useful when the clue is both real and actionable.",
                accepted_terms=[["nameserver", "registrar", "a record", "mx", "subdomain", "dns"]],
                score=22,
                xp=12,
                interaction_type="single-select",
                options=[
                    {"label": "A registrar, nameserver, or DNS record you can verify again", "value": "nameserver registrar a record mx subdomain dns"},
                    {"label": "A hunch that the domain probably uses a common cloud stack", "value": "hunch common cloud"},
                    {"label": "A logo color from the landing page", "value": "logo color"},
                ],
                validation_focus=["verified signal", "analyst evidence"],
            ),
            TaskDefinition(
                id="recon-operator-note",
                title="Write the reconnaissance brief",
                instruction="In one short sentence, explain what your verified recon signal means for the target and what you would check next.",
                expected_type="brief",
                hint="Mention the source, the signal, what it suggests about exposure, and the next check you would make.",
                success_message="Strong brief. You turned raw recon into a clean, analyst-style next step.",
                accepted_terms=[["source", "signal", "target", "risk", "exposure", "dns", "whois", "verify"]],
                score=30,
                xp=18,
                validation_focus=["recon brief", "next-step reasoning"],
            ),
        ]
    if seed.day == 3:
        return [
            TaskDefinition(
                id="surface-entry-quiz",
                title="Choose the first safe discovery move",
                instruction="You need to map the exposed routes on a staging target. Which first move gives you the cleanest and safest starting signal?",
                expected_type="quiz",
                hint="Choose the option that helps you observe hidden doors instead of guessing where they might be.",
                success_message="Correct. Good surface discovery starts with observation, not imagination.",
                accepted_terms=[["dirsearch", "ffuf", "curl", "route discovery"]],
                score=18,
                xp=10,
                interaction_type="single-select",
                options=[
                    {"label": "Run a safe route discovery command such as dirsearch or ffuf", "value": "dirsearch ffuf curl route discovery"},
                    {"label": "Assume /admin exists and report it immediately", "value": "assume admin exists"},
                    {"label": "Start exploiting forms without any mapping", "value": "exploit forms immediately"},
                ],
                validation_focus=["surface discovery", "safe recon"],
            ),
            TaskDefinition(
                id="surface-enum-command",
                title="Run the discovery command",
                instruction="Submit the first command you would run to look for hidden directories, login routes, or exposed endpoints on the staging web app.",
                expected_type="terminal",
                hint="A good start is `dirsearch`, `ffuf`, `gobuster`, or a safe `curl` probe that helps you find the application's hidden doors without forcing anything.",
                success_message="Command accepted. You opened the discovery process the way a careful operator would.",
                accepted_terms=[["dirsearch", "ffuf", "curl", "gobuster"]],
                score=28,
                xp=16,
                validation_focus=["route enumeration", "web discovery"],
            ),
            TaskDefinition(
                id="surface-findings-quiz",
                title="Choose the highest-value discovered endpoint",
                instruction="Your simulated scan reveals `/login`, `/assets`, `/backup/`, and `/admin/api/health`. Which result deserves the strongest follow-up first, and why would an attacker care about it?",
                expected_type="quiz",
                hint="Pick the route that looks most like a hidden staff door into something privileged or sensitive.",
                success_message="Correct. The best follow-up target is usually the endpoint closest to privileged or hidden behavior.",
                accepted_terms=[["admin", "login", "backup", "api"]],
                score=22,
                xp=12,
                interaction_type="single-select",
                options=[
                    {"label": "`/admin/api/health` because admin-facing routes often expose privileged behavior", "value": "admin api"},
                    {"label": "`/assets` because static files always mean compromise", "value": "assets static"},
                    {"label": "`/favicon.ico` because icons are the most sensitive endpoint", "value": "favicon"},
                ],
                validation_focus=["endpoint prioritization", "attack surface triage"],
            ),
            TaskDefinition(
                id="surface-analyst-note",
                title="Write the discovery brief",
                instruction="In one short sentence, explain which discovered web route you would investigate next and why it matters.",
                expected_type="brief",
                hint="Mention the endpoint, what it suggests, and why it could expose login, admin, or hidden application behavior.",
                success_message="Good note. You turned tool output into a clear testing decision instead of just listing routes.",
                accepted_terms=[["endpoint", "admin", "login", "backup", "auth", "hidden", "route", "risk"]],
                score=30,
                xp=18,
                validation_focus=["discovery brief", "next-step reasoning"],
            ),
        ]
    if seed.day == 4:
        return [
            TaskDefinition(
                id="vuln-signal-quiz",
                title="Choose the strongest first vulnerability signal",
                instruction="The staging portal shows a reflected search result, an `/admin/debug` route, and a login flow that accepts `admin:admin`. Which issue deserves the fastest escalation first, and why is it the most dangerous trust failure?",
                expected_type="quiz",
                hint="Pick the weakness that can collapse privileged access the fastest, not just the one that looks flashy.",
                success_message="Correct. Weak authentication on an admin-capable path usually deserves the fastest escalation because it can break identity trust immediately.",
                accepted_terms=[["weak authentication", "weak auth", "default credentials", "admin admin", "broken authentication"]],
                score=18,
                xp=10,
                interaction_type="single-select",
                options=[
                    {"label": "Weak authentication with default credentials on the admin-capable login", "value": "weak authentication default credentials admin admin broken authentication"},
                    {"label": "A dark blue color scheme in the portal UI", "value": "dark blue ui"},
                    {"label": "A footer link that says beta", "value": "footer beta"},
                ],
                validation_focus=["vulnerability triage", "auth weakness"],
            ),
            TaskDefinition(
                id="vuln-evidence-command",
                title="Run the safe evidence command",
                instruction="Submit the first safe command you would run to inspect the target for headers, reflected input, or debug-route clues without changing server state.",
                expected_type="terminal",
                hint="Use a safe inspection command like `curl -I`, `curl -i`, `curl https://target/search?q=test`, or `nikto -h https://target` so you can observe the weakness without touching state.",
                success_message="Command accepted. You gathered real evidence before making the vulnerability call.",
                accepted_terms=[["curl -i", "curl -I", "curl -sI", "curl ", "nikto"]],
                score=28,
                xp=16,
                validation_focus=["safe probing", "evidence collection"],
            ),
            TaskDefinition(
                id="vuln-analysis-quiz",
                title="Choose the best vulnerability classification",
                instruction="Your safe probe shows a reflected `q=<script>alert(1)</script>` string in the response body, `X-Powered-By: debug-app`, no `X-Frame-Options`, and `/admin/debug` returning `200`. Which classification is the clearest and most useful analyst conclusion?",
                expected_type="quiz",
                hint="Choose the answer that names the broken trust correctly: reflected input plus unsafe debug exposure.",
                success_message="Correct. Reflected input plus exposed debug behavior points to client-side injection risk and misconfiguration, not a generic web issue.",
                accepted_terms=[["xss", "reflected xss", "misconfiguration", "debug endpoint", "security headers"]],
                score=22,
                xp=12,
                interaction_type="single-select",
                options=[
                    {"label": "Reflected XSS risk plus exposed debug misconfiguration", "value": "xss reflected xss misconfiguration debug endpoint security headers"},
                    {"label": "The app is definitely safe because it returned HTTP 200", "value": "safe 200"},
                    {"label": "Only a typography issue with no security impact", "value": "typography issue"},
                ],
                validation_focus=["vulnerability classification", "impact analysis"],
            ),
            TaskDefinition(
                id="vuln-remediation-note",
                title="Write the vulnerability brief",
                instruction="In one short sentence, explain the highest-priority vulnerability you found, the evidence that proves it, and the first remediation step.",
                expected_type="brief",
                hint="Mention the vulnerability type, one proof point, and the first fix such as stronger auth, input sanitization, or removing debug exposure.",
                success_message="Strong brief. You translated evidence into a product-security recommendation a team can act on.",
                accepted_terms=[["vulnerability", "auth", "xss", "input", "debug", "misconfiguration", "fix", "remediate", "evidence"]],
                score=30,
                xp=18,
                validation_focus=["remediation note", "analyst communication"],
            ),
        ]
    if seed.day == 5:
        return [
            TaskDefinition(
                id="exploit-chain-quiz",
                title="Choose the first exploitation move",
                instruction="You observed weak admin credentials, a reflected search field, and an exposed `/admin/debug` route. Which path is the strongest first breach-chain move in this controlled simulation?",
                expected_type="quiz",
                hint="Start with the weakness that can produce privileged access fastest and be proven with the least noise.",
                success_message="Correct. Weak admin credentials are the strongest first chain because they can collapse privileged access immediately and safely in a controlled range.",
                accepted_terms=[["weak auth", "default credentials", "admin login", "account takeover", "weak authentication"]],
                score=18,
                xp=10,
                interaction_type="single-select",
                options=[
                    {"label": "Probe the weak admin login path first because it can yield privileged access immediately", "value": "weak auth default credentials admin login account takeover weak authentication"},
                    {"label": "Ignore auth and guess the app is fully patched", "value": "guess patched"},
                    {"label": "Treat the portal theme color as the most important signal", "value": "theme color"},
                ],
                validation_focus=["breach path", "auth chain"],
            ),
            TaskDefinition(
                id="exploit-command-step",
                title="Run the controlled command",
                instruction="Submit the first safe command you would run to test the breach path and collect exploit evidence without modifying server state.",
                expected_type="terminal",
                hint="Use a safe `curl` login probe, reflected-search request, or debug-route check such as `curl -i https://target/login`, `curl https://target/search?q=test`, or `curl -I https://target/admin/debug`.",
                success_message="Command accepted. You used a controlled simulation step to prove the chain safely.",
                accepted_terms=[["curl", "/login", "/search", "/admin/debug", "admin", "debug"]],
                score=28,
                xp=16,
                validation_focus=["controlled execution", "proof of impact"],
            ),
            TaskDefinition(
                id="exploit-analysis-quiz",
                title="Choose the strongest consequence",
                instruction="Your safe probe returns `302 /admin -> /dashboard`, a `Set-Cookie: session=sim-admin`, and the search page reflects `<img src=x onerror=alert(1)>` unsanitized. What is the strongest analyst conclusion?",
                expected_type="quiz",
                hint="Choose the answer that names the attacker gain, not just the technical artifact.",
                success_message="Correct. The chain demonstrates privileged session issuance and reflected client-side injection risk, which together justify immediate containment.",
                accepted_terms=[["account takeover", "privileged session", "xss", "reflected", "immediate containment"]],
                score=22,
                xp=12,
                interaction_type="single-select",
                options=[
                    {"label": "The breach path can issue a privileged session and also exposes reflected injection risk, so containment should start immediately", "value": "account takeover privileged session xss reflected immediate containment"},
                    {"label": "Nothing matters because the app returned HTTP 200 or 302", "value": "http only"},
                    {"label": "The only issue is cosmetic branding inconsistency", "value": "branding inconsistency"},
                ],
                validation_focus=["impact analysis", "failure consequence"],
            ),
            TaskDefinition(
                id="exploit-brief-note",
                title="Write the breach brief",
                instruction="In one short sentence, explain the breach chain, the proof you observed, and the first containment or remediation action.",
                expected_type="brief",
                hint="Mention weak auth, reflected input, or debug exposure, then connect it to session risk, containment, or remediation.",
                success_message="Breach brief accepted. You turned exploit evidence into operator-grade action.",
                accepted_terms=[["weak auth", "session", "account takeover", "xss", "debug", "contain", "fix", "remediate", "evidence"]],
                score=30,
                xp=18,
                validation_focus=["breach brief", "containment action"],
            ),
        ]
    if seed.day == 6:
        return [
            TaskDefinition(
                id="defense-alert-quiz",
                title="Choose the alert to escalate",
                instruction="The dashboard shows 11 failed admin logins, one successful `admin` session issuance, and a new outbound connection to `198.51.100.24:443`. Which alert pattern deserves the fastest escalation?",
                expected_type="quiz",
                hint="Choose the signal sequence that proves attacker progress, not just attacker intent.",
                success_message="Correct. Failed logins followed by privileged access and outbound activity indicate likely compromise, not just probing.",
                accepted_terms=[["failed login", "successful admin session", "outbound", "beacon", "compromise"]],
                score=18,
                xp=10,
                interaction_type="single-select",
                options=[
                    {"label": "The combined sequence of failed admin logins, successful admin session, and new outbound beacon", "value": "failed login successful admin session outbound beacon compromise"},
                    {"label": "A single page refresh from a normal user session", "value": "page refresh"},
                    {"label": "A favicon request with no other context", "value": "favicon request"},
                ],
                validation_focus=["alert triage", "breach sequence"],
            ),
            TaskDefinition(
                id="defense-log-command",
                title="Inspect the breach telemetry",
                instruction="Submit the first command you would run to inspect authentication, session, or network telemetry in the breached system safely.",
                expected_type="terminal",
                hint="Use `journalctl`, `grep`, `tail`, or `jq` to inspect auth failures, session issuance, or outbound connection telemetry.",
                success_message="Command accepted. You started with observable telemetry instead of guesswork.",
                accepted_terms=[["journalctl", "grep", "tail", "jq", "auth", "session", "network"]],
                score=28,
                xp=16,
                validation_focus=["log analysis", "telemetry review"],
            ),
            TaskDefinition(
                id="defense-branch-quiz",
                title="Choose the strongest incident conclusion",
                instruction="Your telemetry shows repeated `auth failed` lines, a later `session issued role=admin`, and `egress connection established to 198.51.100.24`. What is the strongest analyst conclusion?",
                expected_type="quiz",
                hint="Pick the answer that names attacker progress and justifies immediate defensive action.",
                success_message="Correct. The sequence supports likely account compromise with possible command-and-control activity, which justifies containment.",
                accepted_terms=[["account compromise", "privileged access", "command and control", "containment", "incident"]],
                score=22,
                xp=12,
                interaction_type="single-select",
                options=[
                    {"label": "Likely account compromise with privileged access and possible command-and-control activity", "value": "account compromise privileged access command and control containment incident"},
                    {"label": "Probably harmless because some users fail passwords often", "value": "harmless password failures"},
                    {"label": "Only a frontend styling issue", "value": "frontend styling"},
                ],
                validation_focus=["incident reasoning", "branch decision"],
            ),
            TaskDefinition(
                id="defense-containment-note",
                title="Write the first response action",
                instruction="In one short sentence, explain your first containment action and why it should happen before deeper remediation.",
                expected_type="containment",
                hint="Use terms like isolate host, disable admin account, block outbound traffic, preserve evidence, or reset session.",
                success_message="Containment action accepted. You responded like an analyst protecting both the system and the evidence.",
                accepted_terms=[["isolate", "disable", "block", "preserve evidence", "session", "contain", "host", "account"]],
                score=30,
                xp=18,
                validation_focus=["containment", "analyst response"],
            ),
        ]
    if seed.day == 7:
        return [
            TaskDefinition(
                id="chain-recon-quiz",
                title="Choose the recon clue that opens the chain",
                instruction="Recon shows `/login`, `/assets`, `/admin`, and `/admin/debug`. Which clue gives the strongest start for a real attack chain?",
                expected_type="quiz",
                hint="Choose the path that is most likely to expose privilege, administrative logic, or trust collapse.",
                success_message="Correct. Admin-facing routes are the strongest recon clue because they shorten the path to privilege and impact.",
                accepted_terms=[["admin", "debug", "login", "privileged route", "entry path"]],
                score=16,
                xp=10,
                interaction_type="single-select",
                options=[
                    {"label": "`/admin` or `/admin/debug` because they expose privileged functionality and chain potential", "value": "admin debug login privileged route entry path"},
                    {"label": "`/assets` because static files always mean breach", "value": "assets static breach"},
                    {"label": "`/favicon.ico` because icons create the fastest exploit path", "value": "favicon exploit"},
                ],
                validation_focus=["attack chain", "recon priority"],
            ),
            TaskDefinition(
                id="chain-entry-command",
                title="Run the entry confirmation command",
                instruction="Submit the first safe command you would use to confirm the entry path and auth behavior on the target.",
                expected_type="terminal",
                hint="Use `dirsearch`, `ffuf`, `curl -i https://target/login`, or `curl -I https://target/admin/debug` to confirm the path safely.",
                success_message="Command accepted. You turned recon into a validated entry signal.",
                accepted_terms=[["dirsearch", "ffuf", "gobuster", "curl", "/login", "/admin", "/admin/debug"]],
                score=22,
                xp=14,
                validation_focus=["attack chain", "entry confirmation"],
            ),
            TaskDefinition(
                id="chain-entry-quiz",
                title="Choose the best foothold interpretation",
                instruction="Your entry probe shows `302 /login -> /dashboard`, `/admin/debug` returns `200`, and the login accepts `admin:admin`. Which foothold interpretation is strongest?",
                expected_type="quiz",
                hint="Pick the answer that describes attacker leverage, not just the HTTP status.",
                success_message="Correct. Weak admin auth plus exposed admin routes means the chain has moved from recon into real foothold territory.",
                accepted_terms=[["weak admin auth", "privileged foothold", "admin access", "entry validated"]],
                score=18,
                xp=12,
                interaction_type="single-select",
                options=[
                    {"label": "Weak admin auth creates a privileged foothold on an exposed admin path", "value": "weak admin auth privileged foothold admin access entry validated"},
                    {"label": "The route is harmless because it returned 200", "value": "harmless 200"},
                    {"label": "Only the UI theme changed", "value": "ui theme"},
                ],
                validation_focus=["attack chain", "foothold reasoning"],
            ),
            TaskDefinition(
                id="chain-exploit-command",
                title="Run the exploit-stage proof command",
                instruction="Submit the next safe command you would use to prove exploit-stage impact from the foothold without altering system state.",
                expected_type="terminal",
                hint="Use a safe `curl` request against `/login`, `/search?q=test`, or `/admin/debug` to prove session issuance, reflected input, or debug-assisted impact.",
                success_message="Command accepted. You advanced the chain from foothold to proven impact safely.",
                accepted_terms=[["curl", "/login", "/search", "/admin/debug", "session", "admin"]],
                score=24,
                xp=16,
                validation_focus=["attack chain", "exploit proof"],
            ),
            TaskDefinition(
                id="chain-impact-brief",
                title="Write the full chain brief",
                instruction="In one short sentence, explain the recon clue, the entry path, the exploit impact, and why this chain deserves the highest priority.",
                expected_type="brief",
                hint="Mention the route, the auth or trust weakness, the resulting impact, and the reason it outranks weaker paths.",
                success_message="Chain brief accepted. You connected recon, entry, and exploit into one operator-grade story.",
                accepted_terms=[["admin", "login", "debug", "session", "impact", "priority", "chain", "evidence"]],
                score=32,
                xp=20,
                validation_focus=["attack chain", "impact reasoning"],
            ),
        ]
    if seed.day == 8:
        return [
            TaskDefinition(
                id="decision-branch-quiz",
                title="Choose the first branch",
                instruction="You can pursue three paths first: exploit weak admin auth, contain the suspicious beacon, or pause to gather more evidence. Which branch creates the strongest immediate value?",
                expected_type="quiz",
                hint="Pick the branch that best matches leverage, mission objective, and risk awareness.",
                success_message="Correct. The strongest branch is the one you can justify with leverage and consequence, not just speed.",
                accepted_terms=[["exploit path", "containment path", "evidence path", "risk", "leverage"]],
                score=18,
                xp=10,
                interaction_type="single-select",
                options=[
                    {"label": "Take the branch you can justify with the highest leverage and clearest consequence", "value": "exploit path containment path evidence path risk leverage"},
                    {"label": "Pick randomly because every path is equal", "value": "random choice"},
                    {"label": "Ignore the decision and wait forever", "value": "wait forever"},
                ],
                validation_focus=["branch decision", "risk evaluation"],
            ),
            TaskDefinition(
                id="decision-evidence-command",
                title="Inspect evidence for the chosen branch",
                instruction="Submit a safe command you would run to support the branch you chose, using route, auth, session, or telemetry evidence.",
                expected_type="terminal",
                hint="Use `curl`, `journalctl`, `grep`, `tail`, or `jq` to support an exploit, containment, or evidence-first path safely.",
                success_message="Command accepted. You supported the branch with visible evidence instead of instinct.",
                accepted_terms=[["curl", "journalctl", "grep", "tail", "jq", "login", "admin", "session", "auth", "network"]],
                score=24,
                xp=14,
                validation_focus=["branch decision", "evidence support"],
            ),
            TaskDefinition(
                id="decision-risk-quiz",
                title="Choose the strongest risk read",
                instruction="Your chosen path could either gain quick access, reduce attacker dwell time, or preserve a richer evidence trail. Which risk evaluation is strongest?",
                expected_type="quiz",
                hint="Pick the answer that balances likelihood, impact, and evidence quality.",
                success_message="Correct. Strong risk reads compare leverage, downside, and what proof will remain after the action.",
                accepted_terms=[["likelihood", "impact", "evidence quality", "tradeoff", "consequence"]],
                score=22,
                xp=12,
                interaction_type="single-select",
                options=[
                    {"label": "Evaluate the branch by likelihood, impact, and evidence quality before committing", "value": "likelihood impact evidence quality tradeoff consequence"},
                    {"label": "Choose only by emotion or urgency", "value": "emotion urgency"},
                    {"label": "Assume every outcome is harmless", "value": "harmless outcome"},
                ],
                validation_focus=["risk evaluation", "decision consequence"],
            ),
            TaskDefinition(
                id="decision-outcome-brief",
                title="Write the outcome brief",
                instruction="In one short sentence, explain the branch you chose, the evidence supporting it, and the consequence that follows from that choice.",
                expected_type="brief",
                hint="Mention the chosen path, the supporting signal, and the likely impact or containment outcome.",
                success_message="Outcome brief accepted. You turned a branching choice into a defendable cyber decision.",
                accepted_terms=[["branch", "evidence", "impact", "containment", "risk", "path", "outcome", "signal"]],
                score=30,
                xp=18,
                validation_focus=["branch decision", "outcome reasoning"],
            ),
        ]
    if seed.day == 9:
        return [
            TaskDefinition(
                id="ir-timeline-quiz",
                title="Choose the first incident anchor",
                instruction="The timeline shows failed admin logins at 09:09, an admin session at 09:12, and outbound traffic to `198.51.100.24` at 09:14. Which event sequence should anchor the investigation first?",
                expected_type="quiz",
                hint="Pick the sequence that proves attacker progress rather than background noise.",
                success_message="Correct. Failed auth followed by privileged access and beaconing is the incident spine you should investigate first.",
                accepted_terms=[["failed auth", "admin session", "outbound", "timeline", "incident sequence"]],
                score=18,
                xp=10,
                interaction_type="single-select",
                options=[
                    {"label": "Failed admin auth -> privileged admin session -> outbound beacon", "value": "failed auth admin session outbound timeline incident sequence"},
                    {"label": "A single page refresh with no privilege change", "value": "page refresh"},
                    {"label": "A theme asset download", "value": "theme asset"},
                ],
                validation_focus=["incident response", "timeline analysis"],
            ),
            TaskDefinition(
                id="ir-log-command",
                title="Inspect live incident logs",
                instruction="Submit the first command you would run to inspect auth, session, or network logs for this incident safely.",
                expected_type="terminal",
                hint="Use `journalctl`, `grep`, `tail`, or `jq` to inspect timestamps, auth events, or egress activity.",
                success_message="Command accepted. You opened the incident with real telemetry instead of assumptions.",
                accepted_terms=[["journalctl", "grep", "tail", "jq", "auth", "session", "network", "egress"]],
                score=26,
                xp=16,
                validation_focus=["incident response", "log analysis"],
            ),
            TaskDefinition(
                id="ir-containment-quiz",
                title="Choose the first containment action",
                instruction="Based on the timeline and logs, which first containment move is strongest?",
                expected_type="quiz",
                hint="Pick the action that slows spread quickly while preserving useful evidence.",
                success_message="Correct. Isolating the affected host or disabling the compromised admin path is a stronger first move than jumping straight to cleanup.",
                accepted_terms=[["isolate host", "disable admin account", "block outbound", "preserve evidence", "containment"]],
                score=22,
                xp=12,
                interaction_type="single-select",
                options=[
                    {"label": "Isolate the affected host or disable the compromised admin path while preserving evidence", "value": "isolate host disable admin account block outbound preserve evidence containment"},
                    {"label": "Delete all logs immediately", "value": "delete logs"},
                    {"label": "Reboot everything without collecting evidence", "value": "reboot everything"},
                ],
                validation_focus=["incident response", "containment"],
            ),
            TaskDefinition(
                id="ir-recovery-brief",
                title="Write the first recovery action",
                instruction="In one short sentence, explain the first recovery step you would approve after containment and why it is safe to do next.",
                expected_type="brief",
                hint="Mention restoring trust, resetting access, validating clean state, or staged service recovery after containment.",
                success_message="Recovery brief accepted. You treated recovery as a controlled trust-restoration step, not a panic action.",
                accepted_terms=[["recover", "restore", "reset", "validate", "clean", "containment", "trust", "service"]],
                score=30,
                xp=18,
                validation_focus=["incident response", "recovery planning"],
            ),
        ]
    if seed.day == 10:
        return [
            TaskDefinition(
                id="arena-sigma",
                title="SIGMA",
                instruction="A target exposes `/login`, `/admin/debug`, repeated auth failures, and a new outbound beacon. Submit the first command or action that gives the highest-value opening signal.",
                expected_type="terminal",
                hint="Cryptic hint: the opening is where privilege and proof can meet in one move.",
                success_message="SIGMA accepted. You found the opening signal without wasting the move.",
                accepted_terms=[["curl", "journalctl", "grep", "/admin", "/admin/debug", "/login", "auth", "beacon"]],
                score=40,
                xp=24,
                validation_focus=["arena", "sigma", "opening move"],
            ),
            TaskDefinition(
                id="arena-apex",
                title="APEX",
                instruction="Your opening reveals weak admin trust and live beacon telemetry. Which consequence matters most right now?",
                expected_type="quiz",
                hint="Cryptic hint: choose the consequence that changes the room, not the one that merely looks dramatic.",
                success_message="APEX accepted. You identified the decisive leverage point.",
                accepted_terms=[["privileged access", "account compromise", "containment", "attacker leverage", "beacon"]],
                score=45,
                xp=26,
                interaction_type="single-select",
                options=[
                    {"label": "The opening now supports likely privileged access plus live attacker leverage, so containment pressure is immediate", "value": "privileged access account compromise containment attacker leverage beacon"},
                    {"label": "Nothing important changed because alerts are noisy", "value": "nothing changed"},
                    {"label": "Only the UI complexity increased", "value": "ui complexity"},
                ],
                validation_focus=["arena", "apex", "leverage judgment"],
            ),
            TaskDefinition(
                id="arena-omega",
                title="OMEGA",
                instruction="In one short sentence, give the optimal operator approach now: strongest signal, failure point, and next action.",
                expected_type="brief",
                hint="Cryptic hint: name the signal, the collapse, and the cleanest next move.",
                success_message="OMEGA accepted. The arena has a final answer worth reviewing.",
                accepted_terms=[["signal", "privilege", "beacon", "contain", "recover", "evidence", "next action", "failure"]],
                score=55,
                xp=30,
                validation_focus=["arena", "omega", "final judgment"],
            ),
        ]
    if seed.day == 11:
        return [
            TaskDefinition(
                id="threat-observe-quiz",
                title="Scenario 1: choose the signal",
                instruction="You see three partial signals at once: a workstation beacon, a privileged web token, and an unusual cloud-console action. Which one do you anchor first and why?",
                expected_type="quiz",
                hint="Pick the signal that most directly increases attacker leverage or blast radius.",
                success_message="Decision locked. You committed to the strongest signal instead of waiting for perfect context.",
                accepted_terms=[["beacon", "privileged token", "cloud console", "attacker leverage", "blast radius"]],
                score=20,
                xp=12,
                interaction_type="single-select",
                options=[
                    {"label": "Anchor on the signal that most directly increases attacker leverage or blast radius", "value": "beacon privileged token cloud console attacker leverage blast radius"},
                    {"label": "Treat all signals as equal and delay the decision", "value": "delay decision"},
                    {"label": "Ignore the signals until the attacker reveals more", "value": "ignore signals"},
                ],
                validation_focus=["active threat", "uncertainty", "decision quality"],
            ),
            TaskDefinition(
                id="threat-analyze-command",
                title="Scenario 2: analyze the evidence",
                instruction="Submit the first command you would run to inspect authentication, beacon, or cloud activity with incomplete context.",
                expected_type="terminal",
                hint="Use `journalctl`, `grep`, `tail`, `jq`, or a targeted `curl`/telemetry command that fits the signal you anchored on.",
                success_message="Analysis locked. You used evidence to sharpen the scenario instead of narrating around it.",
                accepted_terms=[["journalctl", "grep", "tail", "jq", "curl", "auth", "beacon", "cloud", "session"]],
                score=24,
                xp=14,
                validation_focus=["active threat", "evidence analysis", "uncertainty"],
            ),
            TaskDefinition(
                id="threat-decide-quiz",
                title="Scenario 3: make the permanent decision",
                instruction="With only partial confidence, what is the strongest next move: isolate hard, monitor quietly, contain selectively, or wait for more evidence?",
                expected_type="quiz",
                hint="There is no neutral path. Choose the move whose risk you can defend.",
                success_message="Decision locked. The attacker will now adapt to your chosen behavior.",
                accepted_terms=[["isolate", "monitor", "contain selectively", "risk", "defend"]],
                score=26,
                xp=16,
                interaction_type="single-select",
                options=[
                    {"label": "Choose the move whose downside and tradeoff you can defend under uncertainty", "value": "isolate monitor contain selectively risk defend"},
                    {"label": "Pretend waiting is risk-free", "value": "wait risk free"},
                    {"label": "Pick the loudest option without reasoning", "value": "loudest option"},
                ],
                validation_focus=["active threat", "permanent decision", "risk acceptance"],
            ),
            TaskDefinition(
                id="threat-act-brief",
                title="Act: justify the next state",
                instruction="In one short sentence, explain what you chose, what risk level you accepted, and how the scenario will evolve next.",
                expected_type="brief",
                hint="Name the move, the risk level, and the attacker or system evolution you expect next.",
                success_message="Action locked. Your final judgment shows how you think, not just what you know.",
                accepted_terms=[["choice", "risk", "evolve", "attacker", "scenario", "next", "high", "medium", "low"]],
                score=30,
                xp=18,
                validation_focus=["active threat", "thinking quality", "scenario evolution"],
            ),
        ]
    if seed.day == 12:
        return [
            TaskDefinition(
                id="lateral-pivot-quiz",
                title="Choose the strongest first pivot",
                instruction="From `WKSTN-04`, you can test access toward `FILE-02`, `APP-01`, or `DC-CORE`. A cached note suggests a reused deployment credential exists somewhere in the environment. Which node is the strongest first lateral movement target?",
                expected_type="quiz",
                hint="Pick the node that is most likely to expand access safely and lead to higher privilege, not just the closest machine.",
                success_message="Correct. A shared application node is often the best first pivot because it can expose reused service credentials and broader internal trust.",
                accepted_terms=[["app-01", "application node", "service credential", "pivot", "lateral movement"]],
                score=18,
                xp=10,
                interaction_type="single-select",
                options=[
                    {"label": "`APP-01`, because shared app infrastructure is the strongest place to validate reused service credentials and expand leverage", "value": "app-01 application node service credential pivot lateral movement"},
                    {"label": "`WKSTN-04` again, because staying on the same host is always safer than pivoting", "value": "stay workstation"},
                    {"label": "`DC-CORE` immediately, because jumping straight to the domain controller is always the first move", "value": "domain controller immediately"},
                ],
                validation_focus=["lateral movement", "pivot choice"],
            ),
            TaskDefinition(
                id="lateral-access-command",
                title="Run the access validation command",
                instruction="Submit the first safe command you would run to validate the pivot from `WKSTN-04` into the next internal node using host, share, session, or credential evidence.",
                expected_type="terminal",
                hint="Use a safe command like `ssh`, `smbclient`, `wmic`, `net use`, or a targeted `crackmapexec`-style probe phrased as a non-destructive access check.",
                success_message="Command accepted. You validated the lateral path with a controlled access check instead of guessing the route.",
                accepted_terms=[["ssh", "smbclient", "wmic", "net use", "crackmapexec", "app-01", "file-02", "share", "credential"]],
                score=28,
                xp=16,
                validation_focus=["access validation", "credential path"],
            ),
            TaskDefinition(
                id="lateral-privilege-quiz",
                title="Choose the strongest privilege interpretation",
                instruction="Your safe probe shows `APP-01` accepts the deployment credential, a mounted share exposes `svc_backup`, and that account can read an admin-only configuration path used by scheduled tasks. What is the strongest analyst conclusion?",
                expected_type="quiz",
                hint="Choose the answer that explains the new privilege or leverage the attacker gains next, not just the artifact they found.",
                success_message="Correct. The chain now supports lateral movement from workstation access into service-account backed privilege expansion on the application tier.",
                accepted_terms=[["service account", "privilege escalation", "scheduled task", "broader access", "lateral path"]],
                score=24,
                xp=14,
                interaction_type="single-select",
                options=[
                    {"label": "The attacker can pivot through the application tier into service-account backed privilege escalation and broader internal access", "value": "service account privilege escalation scheduled task broader access lateral path"},
                    {"label": "The share is interesting but does not change attacker leverage at all", "value": "no leverage"},
                    {"label": "Only the homepage styling would change from here", "value": "homepage styling"},
                ],
                validation_focus=["privilege escalation", "lateral consequence"],
            ),
            TaskDefinition(
                id="lateral-debrief",
                title="Write the operator debrief",
                instruction="In one short sentence, explain the best movement chain from source host to privileged outcome, including the credential or access point that made it possible.",
                expected_type="brief",
                hint="Mention the starting node, the pivot target, the credential or share, the resulting privilege gain, and why defenders should care.",
                success_message="Debrief accepted. You turned lateral movement into a clear operator story with a defensible optimal path.",
                accepted_terms=[["wkstn-04", "app-01", "credential", "service account", "privilege", "path", "pivot", "defender"]],
                score=32,
                xp=20,
                validation_focus=["operator debrief", "optimal path"],
            ),
        ]
    if seed.day == 13:
        return [
            TaskDefinition(
                id="exfil-role-quiz",
                title="Choose the role and first priority",
                instruction="Telemetry shows `finance_export_2026_q1.csv`, `legal-archive.zip`, and an outbound sync target at `198.51.100.44`. Which role and first priority create the strongest mission path?",
                expected_type="quiz",
                hint="Choose the path that either moves the highest-value dataset quietly or interrupts the transfer route that changes business impact first.",
                success_message="Branch accepted. You chose a role with a defensible first priority instead of treating all signals as equal.",
                accepted_terms=[["attacker", "defender", "finance export", "legal archive", "outbound sync", "priority"]],
                score=20,
                xp=12,
                interaction_type="single-select",
                options=[
                    {"label": "Take a role, pick the highest-value data path or leak route, and justify why that priority changes impact first", "value": "attacker defender finance export legal archive outbound sync priority"},
                    {"label": "Treat every file and route as equal, then wait for more context", "value": "every file equal wait"},
                    {"label": "Ignore the outbound path and focus only on UI noise", "value": "ui noise"},
                ],
                validation_focus=["data exfiltration", "branch decision", "sensitive path"],
            ),
            TaskDefinition(
                id="exfil-command",
                title="Run the timed exfiltration or defense command",
                instruction="Submit the first safe command you would run to inspect or act on the data path. Attack path examples can inspect exports or simulate extraction logic; defense path examples can validate sync, process, or connection evidence to stop leakage.",
                expected_type="terminal",
                hint="Use a focused command like `find`, `grep`, `tar -tf`, `scp`, `rsync`, `lsof`, `tcpdump`, `journalctl`, or `jq` that proves the path you chose without causing damage.",
                success_message="Timed command accepted. You proved the data path with a credible operator move under pressure.",
                accepted_terms=[["find", "grep", "tar", "scp", "rsync", "lsof", "tcpdump", "journalctl", "jq", "finance", "archive", "sync", "198.51.100.44"]],
                score=30,
                xp=18,
                validation_focus=["data exfiltration", "timed action", "leak prevention"],
            ),
            TaskDefinition(
                id="exfil-risk-quiz",
                title="Choose the strongest risk evaluation",
                instruction="Given the data path and outbound route, which analyst conclusion is strongest right now?",
                expected_type="quiz",
                hint="Pick the answer that ties data sensitivity, route credibility, and response urgency together.",
                success_message="Risk evaluation accepted. You judged the path by impact and route quality instead of by file names alone.",
                accepted_terms=[["high risk", "sensitive data", "credible path", "urgent", "containment", "business impact"]],
                score=24,
                xp=14,
                interaction_type="single-select",
                options=[
                    {"label": "This is high risk because sensitive data has a credible movement path, so action is urgent whether the goal is extraction or containment", "value": "high risk sensitive data credible path urgent containment business impact"},
                    {"label": "This is low risk because archives are normal and outbound traffic is always harmless", "value": "low risk harmless"},
                    {"label": "Only the file extension matters, not the route or destination", "value": "extension only"},
                ],
                validation_focus=["data exfiltration", "risk evaluation", "decision consequence"],
            ),
            TaskDefinition(
                id="exfil-debrief",
                title="Deliver the no-fluff ZORVIX debrief",
                instruction="In one short sentence, explain the chosen role, the sensitive path, the main mistake or weakness exposed, and the optimal next move.",
                expected_type="brief",
                hint="Name the role, the path, the weakness or mistake, the risk level, and the best next action with tight language.",
                success_message="Debrief accepted. You turned the mission into a precise operator judgment ZORVIX can score.",
                accepted_terms=[["attacker", "defender", "path", "mistake", "weakness", "risk", "contain", "extract", "next move", "finance", "archive", "sync"]],
                score=34,
                xp=22,
                validation_focus=["data exfiltration", "performance scoring", "optimal path"],
            ),
        ]
    if seed.day == 14:
        return [
            TaskDefinition(
                id="vector-open-quiz",
                title="Choose the opening vector",
                instruction="You have `/partner/login`, `10.10.22.17:8443`, and an approval flow that trusts a client role flag. Which first vector creates the strongest chain opening?",
                expected_type="quiz",
                hint="Choose the vector that creates the cleanest path into the other two, not the one that looks most dramatic by itself.",
                success_message="Opening vector accepted. You chose the part of the chain that actually creates leverage.",
                accepted_terms=[["partner login", "session", "web vector", "opening", "chain"]],
                score=22,
                xp=12,
                interaction_type="single-select",
                options=[
                    {"label": "Start with the partner login because session trust creates the cleanest bridge into the internal node and the logic flaw", "value": "partner login session web vector opening chain"},
                    {"label": "Start with the internal host only because port numbers are always more important than sessions", "value": "internal host only"},
                    {"label": "Ignore the web path and guess the logic flaw first", "value": "guess logic flaw"},
                ],
                validation_focus=["attack chain", "recon priority", "web vector"],
            ),
            TaskDefinition(
                id="vector-command",
                title="Run the chain validation command",
                instruction="Submit the first safe command you would run to validate the chain across web and network exposure.",
                expected_type="terminal",
                hint="Use a focused command like `curl`, `ffuf`, `dirsearch`, `nmap`, or `nc` that proves either the reachable login-to-internal path or the internal service behavior.",
                success_message="Validation command accepted. You proved the chain with a credible operator move instead of narrating around it.",
                accepted_terms=[["curl", "ffuf", "dirsearch", "nmap", "nc", "partner", "10.10.22.17", "8443", "metrics"]],
                score=30,
                xp=18,
                validation_focus=["attack chain", "entry confirmation", "network vector"],
            ),
            TaskDefinition(
                id="vector-logic-quiz",
                title="Choose the exploit logic",
                instruction="Your validation shows the partner session reaches the metrics node, and the order-approval API trusts the client-side `role=approver` state after that session. What is the strongest analyst conclusion?",
                expected_type="quiz",
                hint="Pick the answer that explains how the earlier web and network vectors make the logic flaw exploitable.",
                success_message="Exploit logic accepted. You chained the flaws into one credible impact path.",
                accepted_terms=[["session", "internal access", "role flag", "approval", "logic flaw", "exploit path"]],
                score=26,
                xp=16,
                interaction_type="single-select",
                options=[
                    {"label": "The partner session plus internal reach makes the trusted client-side approver flag exploitable, creating a real approval-bypass chain", "value": "session internal access role flag approval logic flaw exploit path"},
                    {"label": "The role flag does not matter because business logic is never security relevant", "value": "logic not relevant"},
                    {"label": "Only the metrics page matters; workflows can be ignored", "value": "metrics only"},
                ],
                validation_focus=["attack chain", "logic flaw", "exploit proof"],
            ),
            TaskDefinition(
                id="vector-debrief",
                title="Deliver the exploit-path judgment",
                instruction="In one short sentence, describe the shortest successful exploit path across web, network, and logic flaws, plus the tactical fix that would break the chain fastest.",
                expected_type="brief",
                hint="Name the opening, the pivot, the logic abuse, the impact, and the fastest chain-breaking control.",
                success_message="Judgment accepted. You described the multi-vector path like a real operator and closed with a tactical fix.",
                accepted_terms=[["partner", "session", "10.10.22.17", "role", "approval", "chain", "fix", "segment", "server-side", "trust"]],
                score=36,
                xp=22,
                validation_focus=["attack chain", "final judgment", "optimal path"],
            ),
        ]
    if seed.day == 15:
        return [
            TaskDefinition(
                id="battle-stage-quiz",
                title="Stage 1: choose the opening pressure",
                instruction="The attacker can extend session leverage through the partner app, while defenders can burn the exposed credential path or isolate the internal command node. Which opening pressure gives the strongest board position?",
                expected_type="quiz",
                hint="Choose the move that improves your next stage and preserves optionality, not the loudest move on the board.",
                success_message="Opening pressure accepted. You treated the arena like a board, not a checklist.",
                accepted_terms=[["attack", "defense", "board position", "opening pressure", "resource"]],
                score=22,
                xp=12,
                interaction_type="single-select",
                options=[
                    {"label": "Choose the move that improves the next board state while preserving at least one strong follow-up resource", "value": "attack defense board position opening pressure resource"},
                    {"label": "Spend every major resource immediately because speed is all that matters", "value": "spend everything"},
                    {"label": "Delay the first move until the system becomes easier", "value": "delay first move"},
                ],
                validation_focus=["branch decision", "resource management", "battle stage"],
            ),
            TaskDefinition(
                id="battle-command",
                title="Stage 2: validate the live board",
                instruction="Submit the first safe command you would run to confirm the arena state before committing the next attack or defense resource.",
                expected_type="terminal",
                hint="Use a focused command like `curl`, `journalctl`, `grep`, `nmap`, `ss`, or `jq` that validates either session leverage, node reachability, or control-plane pressure.",
                success_message="Board validation accepted. You checked the live state before overspending the next move.",
                accepted_terms=[["curl", "journalctl", "grep", "nmap", "ss", "jq", "partner", "node", "control", "session"]],
                score=30,
                xp=18,
                validation_focus=["battle stage", "timed action", "resource management"],
            ),
            TaskDefinition(
                id="battle-branch-quiz",
                title="Stage 3: spend the decisive resource",
                instruction="The board now shows live partner-session leverage, a reachable internal command node, and one remaining defensive burn action. What is the strongest next commitment?",
                expected_type="quiz",
                hint="Pick the move whose gain is worth the resource it consumes and whose downside you can still survive.",
                success_message="Resource commitment accepted. You spent the decisive move for position, not panic.",
                accepted_terms=[["commitment", "resource", "gain", "defensive burn", "position", "tradeoff"]],
                score=28,
                xp=16,
                interaction_type="single-select",
                options=[
                    {"label": "Commit the move whose gain, tradeoff, and resulting board position are still favorable after the resource is spent", "value": "commitment resource gain defensive burn position tradeoff"},
                    {"label": "Preserve every resource forever and never commit", "value": "never commit"},
                    {"label": "Spend the last defensive action without checking whether it changes leverage", "value": "spend blindly"},
                ],
                validation_focus=["branch decision", "resource management", "decision consequence"],
            ),
            TaskDefinition(
                id="battle-debrief",
                title="Final: deliver the cold arena judgment",
                instruction="In one short sentence, explain the winning sequence, what resource was spent, what was preserved, and why the final board favored your side.",
                expected_type="brief",
                hint="Name the sequence, the spent resource, the preserved option, the risk accepted, and the final advantage with no filler.",
                success_message="Arena judgment accepted. The mission now has a cold strategic explanation worth scoring.",
                accepted_terms=[["sequence", "resource", "preserved", "risk", "advantage", "attack", "defense", "board", "final"]],
                score=38,
                xp=22,
                validation_focus=["battle stage", "performance scoring", "cold evaluation"],
            ),
        ]
    meta = FOCUS_META[seed.focus]
    intro_quiz = _focus_quiz_task(seed)
    if seed.focus == "foundation":
        return [
            intro_quiz,
            TaskDefinition(
                id="context-map",
                title="Map the core concept",
                instruction=f"Explain the main security concept behind '{seed.title}' in one short operator sentence.",
                expected_type="analysis",
                hint="Use a principle like confidentiality, least privilege, network visibility, or trustworthy defaults.",
                success_message="Concept captured. The lab can now measure whether you understand why the task matters.",
                accepted_terms=[["security", "confidentiality", "integrity", "availability", "linux", "network", "http", "password"]],
                score=20,
                xp=10,
            ),
            TaskDefinition(
                id="terminal-step",
                title="Run the first terminal move",
                instruction="Enter a realistic Kali/Linux command you would run first for this task.",
                expected_type="terminal",
                hint="A safe first move is usually a discovery command like `pwd`, `ls`, `ip a`, `ss -tulpn`, or `curl -I`.",
                success_message="Command accepted. Your first operator action is grounded in a realistic workflow.",
                accepted_terms=[["pwd", "ls", "ip", "ss", "curl", "whoami", "cat"]],
                score=30,
                xp=15,
            ),
            TaskDefinition(
                id="operator-note",
                title="Write the operator note",
                instruction="Describe what result would convince you the step worked.",
                expected_type="explanation",
                hint="Mention the signal you expect to see: a header, interface, permission, hash policy, or process output.",
                success_message="Operator note saved. You are connecting command execution to evidence.",
                accepted_terms=[["output", "header", "interface", "permission", "policy", "response", "service"]],
                score=25,
                xp=15,
            ),
        ]
    if seed.focus == "intel":
        return [
            intro_quiz,
            TaskDefinition(
                id="scope-check",
                title="Choose the first recon command",
                instruction="Enter the safest first OSINT command you would run in Kali.",
                expected_type="terminal",
                hint="Think `whois`, `dig`, `nslookup`, or `curl -I` depending on what you want to verify.",
                success_message="Recon entry point accepted. The workflow starts with a verifiable signal.",
                accepted_terms=[["whois", "dig", "nslookup", "curl"]],
                score=30,
                xp=15,
            ),
            TaskDefinition(
                id="evidence-filter",
                title="Separate verified from assumed",
                instruction="Write one sentence that explains how you would verify the result before trusting it.",
                expected_type="analysis",
                hint="Use words like verify, cross-check, second source, DNS, WHOIS, or header.",
                success_message="Verification logic accepted. The lab now treats your workflow as evidence-driven.",
                accepted_terms=[["verify", "cross", "source", "dns", "whois", "header", "mx"]],
                score=25,
                xp=15,
            ),
            TaskDefinition(
                id="intel-brief",
                title="Draft the intel brief",
                instruction="Write a short analyst note about what the target exposure could mean.",
                expected_type="brief",
                hint="Mention the target, the verified signal, and why it matters for risk.",
                success_message="Analyst brief accepted. You linked evidence to risk in operator language.",
                accepted_terms=[["risk", "target", "verified", "exposure", "signal"]],
                score=30,
                xp=20,
            ),
        ]
    if seed.focus == "appsec":
        return [
            intro_quiz,
            TaskDefinition(
                id="web-probe",
                title="Probe the application safely",
                instruction="Enter a safe command you would use first to inspect the application surface.",
                expected_type="terminal",
                hint="`curl -I`, `curl -s`, `nikto -h`, or `ffuf` can all be valid starts depending on the objective.",
                success_message="Application probe accepted. The lab can now validate your recon sequence.",
                accepted_terms=[["curl", "nikto", "ffuf", "burp", "python"]],
                score=30,
                xp=15,
            ),
            TaskDefinition(
                id="risk-class",
                title="Name the risk",
                instruction=f"Classify the likely issue category behind '{seed.title}' in one sentence.",
                expected_type="analysis",
                hint="Think authentication, headers, injection, access control, CSRF, or upload validation.",
                success_message="Risk classification accepted. The system can now adapt follow-up difficulty.",
                accepted_terms=[["auth", "header", "inject", "access", "csrf", "upload", "validation", "sql", "xss", "api"]],
                score=25,
                xp=15,
            ),
            TaskDefinition(
                id="fix-brief",
                title="Write the remediation brief",
                instruction="Give one developer-facing remediation step.",
                expected_type="remediation",
                hint="Use direct actions like validate input, add policy/header, enforce authorization, or parameterize queries.",
                success_message="Remediation accepted. You translated security findings into engineering action.",
                accepted_terms=[["validate", "authorize", "header", "token", "parameter", "sanitize", "policy"]],
                score=30,
                xp=20,
            ),
        ]
    if seed.focus == "defense":
        return [
            intro_quiz,
            TaskDefinition(
                id="triage-command",
                title="Start triage in the terminal",
                instruction="Enter a command you would use to inspect alerts, logs, or local telemetry.",
                expected_type="terminal",
                hint="Good starts include `grep`, `jq`, `cat`, `journalctl`, or `tail` depending on the source.",
                success_message="Triage command accepted. The workflow begins with observable telemetry.",
                accepted_terms=[["grep", "jq", "cat", "journalctl", "tail"]],
                score=30,
                xp=15,
            ),
            TaskDefinition(
                id="containment-choice",
                title="Pick the containment direction",
                instruction="Describe your first defensive move in one short sentence.",
                expected_type="containment",
                hint="Use phrases like isolate host, disable account, block domain, reset token, or preserve evidence.",
                success_message="Containment accepted. The engine can now score response quality.",
                accepted_terms=[["isolate", "disable", "block", "reset", "evidence", "contain"]],
                score=25,
                xp=15,
            ),
            TaskDefinition(
                id="detection-note",
                title="Leave a detection note",
                instruction="Write one line about what signal should be monitored next.",
                expected_type="detection",
                hint="Mention a log source, suspicious pattern, repeated failure, beacon, or policy event.",
                success_message="Detection note accepted. The lab completed the learn-detect-respond loop.",
                accepted_terms=[["log", "pattern", "failure", "beacon", "event", "alert", "monitor"]],
                score=30,
                xp=20,
            ),
        ]
    if seed.focus == "cloud":
        return [
            intro_quiz,
            TaskDefinition(
                id="cloud-check",
                title="Inspect the cloud surface",
                instruction="Enter the first cloud or container security command you would run.",
                expected_type="terminal",
                hint="`aws`, `kubectl`, `docker`, or `trivy` are valid entry points in this simulation.",
                success_message="Cloud inspection accepted. You started from a practical operator action.",
                accepted_terms=[["aws", "kubectl", "docker", "trivy"]],
                score=30,
                xp=15,
            ),
            TaskDefinition(
                id="least-privilege",
                title="Apply least privilege reasoning",
                instruction="Write one sentence explaining the access reduction you would make.",
                expected_type="analysis",
                hint="Use terms like role, policy, secret, public access, service account, or bucket/object permissions.",
                success_message="Least-privilege reasoning accepted. The system sees a real hardening decision.",
                accepted_terms=[["role", "policy", "secret", "public", "service", "bucket", "permission"]],
                score=25,
                xp=15,
            ),
            TaskDefinition(
                id="verify-fix",
                title="Verify the hardening",
                instruction="Describe the evidence you would expect after the fix.",
                expected_type="verification",
                hint="Think denied access, private object, clean image scan, or successful policy audit.",
                success_message="Verification accepted. You closed the cloud hardening loop correctly.",
                accepted_terms=[["denied", "private", "clean", "audit", "restricted", "scan"]],
                score=30,
                xp=20,
            ),
        ]
    if seed.focus == "hunt":
        return [
            intro_quiz,
            TaskDefinition(
                id="hunt-hypothesis",
                title="Write the hunt hypothesis",
                instruction="State the hypothesis you are testing in one sentence.",
                expected_type="hypothesis",
                hint="Use phrases like suspicious process, abnormal login, lateral movement, or beaconing behavior.",
                success_message="Hunt hypothesis accepted. The lab can now score the investigation path.",
                accepted_terms=[["suspicious", "abnormal", "lateral", "beacon", "process", "login"]],
                score=25,
                xp=15,
            ),
            TaskDefinition(
                id="hunt-command",
                title="Query the signal",
                instruction="Enter a command you would use to inspect the evidence.",
                expected_type="terminal",
                hint="Use `grep`, `jq`, `python3`, or `yara` to show a realistic hunt workflow.",
                success_message="Hunt query accepted. The signal path is now actionable.",
                accepted_terms=[["grep", "jq", "python", "yara"]],
                score=30,
                xp=15,
            ),
            TaskDefinition(
                id="hunt-decision",
                title="Decide escalation",
                instruction="Write one line on whether you would escalate, and why.",
                expected_type="decision",
                hint="Use evidence-driven wording like high confidence, false positive, insufficient evidence, or escalate to IR.",
                success_message="Escalation logic accepted. The lab now sees a mature analyst decision.",
                accepted_terms=[["confidence", "false", "evidence", "escalate", "ir", "positive"]],
                score=30,
                xp=20,
            ),
        ]
    return [
        intro_quiz,
        TaskDefinition(
            id="capstone-brief",
            title="State the operator goal",
            instruction="Summarize the deliverable for this capstone day in one sentence.",
            expected_type="brief",
            hint="Use terms like evidence, report, remediation, workflow, portfolio, or automation.",
            success_message="Capstone goal accepted. The platform can now track your final-output quality.",
            accepted_terms=[["evidence", "report", "workflow", "portfolio", "automation", "remediation"]],
            score=25,
            xp=15,
        ),
        TaskDefinition(
            id="capstone-command",
            title="Show the technical move",
            instruction="Enter one realistic command or tool you would use first.",
            expected_type="terminal",
            hint="Capstone days can start with `nmap`, `curl`, `python3`, or `git` depending on the artifact.",
            success_message="Technical move accepted. The capstone remains grounded in hands-on execution.",
            accepted_terms=[["nmap", "curl", "python", "git"]],
            score=30,
            xp=15,
        ),
        TaskDefinition(
            id="capstone-report",
            title="Write the final explanation",
            instruction="Explain what the final solution should prove to a reviewer.",
            expected_type="report",
            hint="Mention evidence quality, reproducibility, remediation value, or operator judgment.",
            success_message="Final explanation accepted. This capstone day now ends with reviewer-ready clarity.",
            accepted_terms=[["evidence", "reproduc", "remediation", "judgment", "review"]],
            score=35,
            xp=20,
        ),
    ]


def _matches(answer: str, accepted_terms: list[list[str]]) -> bool:
    normalized = answer.strip().lower()
    if not normalized:
        return False
    if len(normalized) < 2:
        return False
    for group in accepted_terms:
        if any(term in normalized for term in group):
            return True
    return False


def get_day_module(day_number: int) -> dict[str, Any]:
    seed = next((item for item in PROGRAM_SEEDS if item.day == day_number), None)
    if not seed:
        raise ValueError("Invalid day number")
    meta = FOCUS_META[seed.focus]
    tasks = _task_bundle(seed)
    day_pack = EARLY_DAY_PACKS.get(seed.day, {})
    scenario_frame = {
        "foundation": {
            "operator_role": "Junior Security Analyst",
            "threat_level": "Low",
            "scenario_tagline": "Build operator trust from first principles before touching live systems.",
            "success_criteria": ["Classify the core security concern correctly.", "Use a safe first move.", "Explain the evidence behind the decision."],
        },
        "intel": {
            "operator_role": "Recon Operator",
            "threat_level": "Medium",
            "scenario_tagline": "Turn scoped external signals into verified intelligence, not assumption.",
            "success_criteria": ["Start from a verifiable source.", "Cross-check the signal.", "Convert the result into an intel note."],
        },
        "appsec": {
            "operator_role": "Application Security Tester",
            "threat_level": "Medium",
            "scenario_tagline": "Inspect the target safely, prove the risk, and state the fix clearly.",
            "success_criteria": ["Observe the app safely first.", "Name the risk with evidence.", "Provide a developer-ready remediation."],
        },
        "defense": {
            "operator_role": "Blue Team Operator",
            "threat_level": "High",
            "scenario_tagline": "Triage, contain, and explain the next detection move under pressure.",
            "success_criteria": ["Begin from telemetry.", "Choose a containment step.", "State the next signal to monitor."],
        },
        "cloud": {
            "operator_role": "Cloud Security Engineer",
            "threat_level": "High",
            "scenario_tagline": "Harden exposed cloud posture before weak defaults become incidents.",
            "success_criteria": ["Inspect exposure and privileges.", "Apply least-privilege reasoning.", "State how the hardening will be verified."],
        },
        "hunt": {
            "operator_role": "Threat Hunter",
            "threat_level": "High",
            "scenario_tagline": "Move from noisy signals to a testable hypothesis and evidence-backed escalation.",
            "success_criteria": ["Write a hypothesis.", "Query the signal path.", "Decide escalation based on evidence."],
        },
        "capstone": {
            "operator_role": "Lead Operator",
            "threat_level": "Critical",
            "scenario_tagline": "Produce reviewer-ready work that combines technical proof with operator judgment.",
            "success_criteria": ["Define the deliverable clearly.", "Show the technical move.", "Explain what the final output proves."],
        },
    }[seed.focus]
    if day_pack.get("scenario_tagline"):
        scenario_frame["scenario_tagline"] = str(day_pack["scenario_tagline"])
    if day_pack.get("success_criteria"):
        scenario_frame["success_criteria"] = list(day_pack["success_criteria"])
    learn_points = {
        "foundation": [
            "Start by classifying the security problem before touching the terminal.",
            "Use the first command to build context, not to make assumptions.",
            "Treat every answer as operator evidence, not classroom recall.",
        ],
        "intel": [
            "Separate verified signals from assumptions before drawing conclusions.",
            "Cross-check recon results with a second source whenever possible.",
            "Turn observed exposure into a concise analyst-quality note.",
        ],
        "appsec": [
            "Observe the application safely before naming the risk category.",
            "Tie findings to a reproducible signal such as a header, route, or response pattern.",
            "Translate the issue into a remediation an engineer can actually implement.",
        ],
        "defense": [
            "Contain risk without destroying evidence.",
            "Use telemetry to justify decisions instead of relying on instinct alone.",
            "End every response step with the next signal you would monitor.",
        ],
        "cloud": [
            "Check exposure and privilege boundaries before anything else.",
            "Treat secrets, public access, and policy scope as first-class risks.",
            "Verify the hardening change with evidence after the fix.",
        ],
        "hunt": [
            "Start from a testable hypothesis, not a pile of noise.",
            "Query the signal that would prove or disprove the theory fastest.",
            "Escalate only when the evidence supports operator confidence.",
        ],
        "capstone": [
            "Structure the day around evidence, reproducibility, and operator judgment.",
            "Keep the technical move tied to the final reviewer-facing deliverable.",
            "Finish with a concise explanation that proves why the work matters.",
        ],
    }[seed.focus]
    if day_pack.get("learn_points"):
        learn_points = list(day_pack["learn_points"])
    mission_brief = (
        "Day 1 is your operator reset: learn the security lens, execute one safe command, validate the evidence, and unlock Day 2."
        if seed.day == 1
        else f"Day {seed.day} runs as a real mission loop for {seed.title}: learn the context, perform the task, validate the result, and unlock the next module."
    )
    if day_pack.get("mission_brief"):
        mission_brief = str(day_pack["mission_brief"])
    primary_action_label = "Start Day 1 Mission" if seed.day == 1 else "Enter Challenge Arena" if seed.day == 10 else f"Start Day {seed.day} Task Flow"
    learn_cards = list(day_pack.get("learn_cards") or build_learn_cards(seed, learn_points))
    mission_assets = build_mission_assets(seed, meta, scenario_frame)
    console_boot_lines = build_console_boot_lines(seed, meta, scenario_frame)
    debrief_points = build_debrief_points(seed)
    completion_badge = str(day_pack.get("completion_badge") or f"Day {seed.day} Cleared")
    mentor_intro = MENTOR_INTROS.get(
        seed.day,
        f"I'll guide this like a working mentor would: understand the situation first, make one clean move, then explain why that move earns the next unlock."
    )
    example_story = EXAMPLE_STORIES.get(
        seed.day,
        f"Example: in a {seed.focus} workflow, the strongest operators narrow the problem quickly, validate one useful signal, and let the next action follow from evidence instead of guesswork."
    )
    return {
        "day": seed.day,
        "title": seed.title,
        "objective": f"Complete a guided hands-on lab for {seed.title} using realistic operator actions and evidence-based reasoning.",
        "scenario": str(day_pack.get("scenario") or meta["scenario"]),
        "mentor_intro": mentor_intro,
        "example_story": example_story,
        "scenario_tagline": scenario_frame["scenario_tagline"],
        "operator_role": scenario_frame["operator_role"],
        "threat_level": scenario_frame["threat_level"],
        "focus": seed.focus,
        "difficulty": meta["difficulty"],
        "estimated_minutes": 18 if meta["difficulty"] == "beginner" else 24 if meta["difficulty"] == "intermediate" else 32,
        "environment": meta["environment"],
        "mission_brief": mission_brief,
        "learn_points": learn_points,
        "learn_cards": learn_cards,
        "mission_assets": mission_assets,
        "console_boot_lines": console_boot_lines,
        "completion_badge": completion_badge,
        "primary_action_label": primary_action_label,
        "success_criteria": scenario_frame["success_criteria"],
        "tasks": tasks,
        "solution_explanation": [
            "Day 1 builds the habits that make every later lab work: classify the problem, start safely, verify the evidence, then write the operator note."
            if seed.day == 1
            else f"Day {seed.day} trains {seed.focus} judgment through a command step, an evidence step, and an operator explanation.",
            "A correct lab run starts with a realistic action, verifies the signal, and ends with a concise analyst-quality note.",
            "The final unlock is based on validated task completion, not just clicking through the module.",
        ],
        "debrief_points": debrief_points,
        "next_steps": meta["next_steps"],
        "kali_tools": meta["kali_tools"],
    }


def build_day_overview(state_rows: dict[int, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    previous_completed = True
    for seed in PROGRAM_SEEDS:
        row = state_rows.get(seed.day)
        completed = bool(row.completed) if row else False
        unlocked = bool(row.unlocked) if row else (seed.day == 1 or previous_completed)
        items.append(
            {
                "day": seed.day,
                "title": seed.title,
                "focus": seed.focus,
                "difficulty": FOCUS_META[seed.focus]["difficulty"],
                "unlocked": unlocked,
                "completed": completed,
                "score": int(row.score) if row else 0,
                "xp_earned": int(row.xp_earned) if row else 0,
            }
        )
        previous_completed = completed
    return items


def validate_task(day_number: int, task_id: str, answer: str) -> dict[str, Any]:
    module = get_day_module(day_number)
    task = next((item for item in module["tasks"] if item.id == task_id), None)
    if not task:
        raise ValueError("Task not found")
    accepted = _matches(answer, task.accepted_terms)
    return {
        "accepted": accepted,
        "task": task,
        "feedback": task.success_message if accepted else f"Not quite yet. {task.hint}",
        "score_delta": task.score if accepted else 0,
        "xp_delta": task.xp if accepted else 0,
    }
