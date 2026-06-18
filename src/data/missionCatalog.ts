/**
 * missionCatalog.ts — Maps mission numbers (1-60) to mission names, objectives,
 * focus areas, difficulty, XP rewards, and estimated time.
 *
 * Used to replace "Day N" naming throughout the platform with mission-based naming.
 */

export type MissionDifficulty = "beginner" | "intermediate" | "advanced" | "pro";
export type MissionFocus =
  | "Reconnaissance"
  | "Web Security"
  | "Network Security"
  | "Exploitation"
  | "Defense"
  | "OSINT"
  | "Forensics"
  | "Cloud Security"
  | "Cryptography"
  | "Social Engineering"
  | "Mobile Security"
  | "Incident Response";

export interface MissionEntry {
  /** The sequential mission number (1-60) */
  number: number;
  /** Short display title (e.g. "Recon Initiation") */
  title: string;
  /** Full formatted label (e.g. "Mission 01: Recon Initiation") */
  label: string;
  /** One-sentence objective */
  objective: string;
  /** Primary skill focus area */
  focus: MissionFocus;
  /** Difficulty band */
  difficulty: MissionDifficulty;
  /** XP reward for completion */
  xp: number;
  /** Estimated time in minutes */
  estimatedMinutes: number;
  /** Prerequisite mission number (0 = none) */
  prerequisite: number;
  /** Brief in-universe description */
  description: string;
}

const MISSION_CATALOG: MissionEntry[] = [
  // ═══ Phase 1: Reconnaissance & Foundations (Missions 01-20) ═══
  {
    number: 1,
    title: "Recon Initiation",
    label: "Mission 01: Recon Initiation",
    objective: "Perform your first SYN scan, identify 3 open ports, and classify the services.",
    focus: "Reconnaissance",
    difficulty: "beginner",
    xp: 100,
    estimatedMinutes: 15,
    prerequisite: 0,
    description: "Learn the fundamentals of network reconnaissance. Deploy Nmap, interpret port states, and understand how attackers map targets before engagement.",
  },
  {
    number: 2,
    title: "Digital Footprint Mapping",
    label: "Mission 02: Digital Footprint Mapping",
    objective: "Profile a domain using WHOIS, DNS, and subdomain enumeration techniques.",
    focus: "Reconnaissance",
    difficulty: "beginner",
    xp: 110,
    estimatedMinutes: 20,
    prerequisite: 1,
    description: "Map the external attack surface of a target domain. Gather WHOIS records, resolve DNS records, and discover hidden subdomains.",
  },
  {
    number: 3,
    title: "Linux Operations",
    label: "Mission 03: Linux Operations",
    objective: "Navigate a Linux environment, execute basic commands, and manage file permissions.",
    focus: "Reconnaissance",
    difficulty: "beginner",
    xp: 100,
    estimatedMinutes: 15,
    prerequisite: 2,
    description: "Build fluency in Linux command-line operations. Navigate filesystems, manage permissions, and execute commands essential for cyber operations.",
  },
  {
    number: 4,
    title: "Enumeration Protocol",
    label: "Mission 04: Enumeration Protocol",
    objective: "Enumerate services, users, and shares on a target system using established tools.",
    focus: "Reconnaissance",
    difficulty: "beginner",
    xp: 120,
    estimatedMinutes: 20,
    prerequisite: 3,
    description: "Systematically enumerate target services to identify users, shared resources, and potential entry points for further analysis.",
  },
  {
    number: 5,
    title: "Web Attack Surface Discovery",
    label: "Mission 05: Web Attack Surface Discovery",
    objective: "Map hidden endpoints, login panels, and admin routes on a web target.",
    focus: "Web Security",
    difficulty: "intermediate",
    xp: 130,
    estimatedMinutes: 25,
    prerequisite: 4,
    description: "Discover the full attack surface of a web application. Find hidden routes, admin panels, and exposed functionality that attackers target first.",
  },
  {
    number: 6,
    title: "Authentication Analysis",
    label: "Mission 06: Authentication Analysis",
    objective: "Identify authentication weaknesses and classify trust failures in login flows.",
    focus: "Web Security",
    difficulty: "intermediate",
    xp: 140,
    estimatedMinutes: 25,
    prerequisite: 5,
    description: "Analyze authentication mechanisms for common weaknesses. Test for default credentials, weak password policies, and session management flaws.",
  },
  {
    number: 7,
    title: "Vulnerability Identification",
    label: "Mission 07: Vulnerability Identification",
    objective: "Classify auth weakness, reflected input, and misconfiguration as trust failures.",
    focus: "Web Security",
    difficulty: "intermediate",
    xp: 150,
    estimatedMinutes: 30,
    prerequisite: 6,
    description: "Train your eye to spot vulnerabilities. Classify broken trust patterns — weak auth, unvalidated input, and configuration gaps.",
  },
  {
    number: 8,
    title: "Controlled Exploitation Simulation",
    label: "Mission 08: Controlled Exploitation Simulation",
    objective: "Step through breach logic safely and prove impact with one controlled command.",
    focus: "Exploitation",
    difficulty: "intermediate",
    xp: 160,
    estimatedMinutes: 30,
    prerequisite: 7,
    description: "Execute a controlled exploitation sequence. Prove the attack chain from entry to impact using safe, reversible commands.",
  },
  {
    number: 9,
    title: "Defense Thinking Drill",
    label: "Mission 09: Defense Thinking Drill",
    objective: "Detect a breach sequence, inspect telemetry, and choose the first response action.",
    focus: "Defense",
    difficulty: "intermediate",
    xp: 170,
    estimatedMinutes: 35,
    prerequisite: 8,
    description: "Step into the defender's role. Analyze security telemetry, identify breach indicators, and make containment decisions under pressure.",
  },
  {
    number: 10,
    title: "Full Attack Chain Simulation",
    label: "Mission 10: Full Attack Chain Simulation",
    objective: "Turn recon into entry, and entry into exploit impact through a complete chain.",
    focus: "Exploitation",
    difficulty: "intermediate",
    xp: 180,
    estimatedMinutes: 35,
    prerequisite: 9,
    description: "Execute a complete attack chain from initial reconnaissance to exploit impact. Connect each validated step into a coherent offensive story.",
  },
  {
    number: 11,
    title: "Branching Decision Lab",
    label: "Mission 11: Branching Decision Lab",
    objective: "Choose attack or defense paths and evaluate tradeoffs under uncertainty.",
    focus: "Defense",
    difficulty: "intermediate",
    xp: 190,
    estimatedMinutes: 40,
    prerequisite: 10,
    description: "Face branching scenarios where your choice changes the outcome. Compare attack and defense paths, justify your decision with evidence.",
  },
  {
    number: 12,
    title: "Incident Response Simulation",
    label: "Mission 12: Incident Response Simulation",
    objective: "Investigate a timeline, contain the attack, and define recovery steps.",
    focus: "Incident Response",
    difficulty: "intermediate",
    xp: 200,
    estimatedMinutes: 40,
    prerequisite: 11,
    description: "Lead an incident response from first alert to recovery. Analyze the timeline, contain the threat, and document findings.",
  },
  {
    number: 13,
    title: "Active Threat Simulation",
    label: "Mission 13: Active Threat Simulation",
    objective: "Observe partial signals and make decisions under uncertainty.",
    focus: "Defense",
    difficulty: "advanced",
    xp: 220,
    estimatedMinutes: 35,
    prerequisite: 12,
    description: "Think under uncertainty with incomplete threat signals. Make permanent decisions as ZORVIX silently evaluates your judgment.",
  },
  {
    number: 14,
    title: "Lateral Movement Detection",
    label: "Mission 14: Lateral Movement Detection",
    objective: "Identify pivot nodes and detect credential-based lateral movement patterns.",
    focus: "Network Security",
    difficulty: "advanced",
    xp: 230,
    estimatedMinutes: 40,
    prerequisite: 13,
    description: "Detect lateral movement across a network. Identify compromised credentials, pivot nodes, and privilege escalation paths.",
  },
  {
    number: 15,
    title: "Data Exfiltration vs Defense",
    label: "Mission 15: Data Exfiltration vs Defense",
    objective: "Identify sensitive data paths and act under a timed containment window.",
    focus: "Defense",
    difficulty: "advanced",
    xp: 240,
    estimatedMinutes: 40,
    prerequisite: 14,
    description: "Balance attack and defense in a data exfiltration scenario. Identify critical data paths and decide when to contain vs. observe.",
  },
  {
    number: 16,
    title: "Multi-Vector Attack Simulation",
    label: "Mission 16: Multi-Vector Attack Simulation",
    objective: "Identify web, network, and logic flaws and prove the shortest credible chain.",
    focus: "Exploitation",
    difficulty: "pro",
    xp: 260,
    estimatedMinutes: 45,
    prerequisite: 15,
    description: "Chain multiple attack vectors together. Combine web, network, and application logic flaws into a credible exploit path under time pressure.",
  },
  {
    number: 17,
    title: "Strategic Cyber Battle Arena",
    label: "Mission 17: Strategic Cyber Battle Arena",
    objective: "Balance attack and defense across multiple stages under resource pressure.",
    focus: "Defense",
    difficulty: "pro",
    xp: 280,
    estimatedMinutes: 50,
    prerequisite: 16,
    description: "Command the cyber battlefield. Deploy offensive and defensive resources strategically while ZORVIX silently evaluates your decisions.",
  },
  {
    number: 18,
    title: "OSINT Intelligence Gathering",
    label: "Mission 18: OSINT Intelligence Gathering",
    objective: "Collect open-source intelligence on a target using legal, ethical methods.",
    focus: "OSINT",
    difficulty: "beginner",
    xp: 120,
    estimatedMinutes: 25,
    prerequisite: 17,
    description: "Master open-source intelligence collection. Gather, correlate, and analyze publicly available information on a target.",
  },
  {
    number: 19,
    title: "Network Traffic Analysis",
    label: "Mission 19: Network Traffic Analysis",
    objective: "Capture and analyze network traffic to identify anomalies and threats.",
    focus: "Network Security",
    difficulty: "intermediate",
    xp: 160,
    estimatedMinutes: 30,
    prerequisite: 18,
    description: "Analyze network traffic patterns. Use packet capture tools to identify suspicious connections, data exfiltration, and C2 traffic.",
  },
  {
    number: 20,
    title: "Phishing Attack Simulation",
    label: "Mission 20: Phishing Attack Simulation",
    objective: "Analyze a phishing email, identify indicators, and recommend defenses.",
    focus: "Social Engineering",
    difficulty: "beginner",
    xp: 110,
    estimatedMinutes: 20,
    prerequisite: 19,
    description: "Analyze phishing attempts from an operator's perspective. Identify social engineering indicators and build defensive email workflows.",

  // ═══ Phase 2: Web & Application Security (Missions 21-40) ═══
  },
  {
    number: 21,
    title: "SQL Injection Fundamentals",
    label: "Mission 21: SQL Injection Fundamentals",
    objective: "Identify and exploit SQL injection vulnerabilities in a safe lab environment.",
    focus: "Web Security",
    difficulty: "intermediate",
    xp: 180,
    estimatedMinutes: 35,
    prerequisite: 20,
    description: "Understand and exploit SQL injection vulnerabilities. Learn how attackers manipulate database queries through unsanitized input.",
  },
  {
    number: 22,
    title: "Cross-Site Scripting Mastery",
    label: "Mission 22: Cross-Site Scripting Mastery",
    objective: "Identify reflected, stored, and DOM-based XSS vulnerabilities.",
    focus: "Web Security",
    difficulty: "intermediate",
    xp: 170,
    estimatedMinutes: 30,
    prerequisite: 21,
    description: "Master XSS detection across all three types. Learn how script injection works and how to build effective defenses.",
  },
  {
    number: 23,
    title: "Cross-Site Request Forgery",
    label: "Mission 23: Cross-Site Request Forgery",
    objective: "Identify and exploit CSRF vulnerabilities in web applications.",
    focus: "Web Security",
    difficulty: "intermediate",
    xp: 160,
    estimatedMinutes: 25,
    prerequisite: 22,
    description: "Understand CSRF attacks and how attackers trick users into performing unintended actions. Implement anti-CSRF defenses.",
  },
  {
    number: 24,
    title: "Authentication Bypass Techniques",
    label: "Mission 24: Authentication Bypass Techniques",
    objective: "Identify and exploit authentication bypass vulnerabilities.",
    focus: "Web Security",
    difficulty: "intermediate",
    xp: 180,
    estimatedMinutes: 30,
    prerequisite: 23,
    description: "Discover common authentication bypass techniques. Test for insecure direct object references, weak session management, and privilege escalation.",
  },
  {
    number: 25,
    title: "Server-Side Request Forgery",
    label: "Mission 25: Server-Side Request Forgery",
    objective: "Identify and exploit SSRF to access internal resources.",
    focus: "Web Security",
    difficulty: "advanced",
    xp: 200,
    estimatedMinutes: 35,
    prerequisite: 24,
    description: "Exploit server-side request forgery vulnerabilities. Learn how attackers pivot through internal networks using SSRF.",
  },
  {
    number: 26,
    title: "File Inclusion & Path Traversal",
    label: "Mission 26: File Inclusion & Path Traversal",
    objective: "Identify LFI/RFI and path traversal vulnerabilities.",
    focus: "Web Security",
    difficulty: "intermediate",
    xp: 170,
    estimatedMinutes: 30,
    prerequisite: 25,
    description: "Exploit local and remote file inclusion vulnerabilities. Read sensitive files and execute arbitrary code through unsafe include functions.",
  },
  {
    number: 27,
    title: "Command Injection Exploitation",
    label: "Mission 27: Command Injection Exploitation",
    objective: "Identify and exploit OS command injection in web applications.",
    focus: "Web Security",
    difficulty: "intermediate",
    xp: 190,
    estimatedMinutes: 30,
    prerequisite: 26,
    description: "Execute OS commands through vulnerable application interfaces. Learn detection, exploitation, and remediation techniques.",
  },
  {
    number: 28,
    title: "Insecure Deserialization",
    label: "Mission 28: Insecure Deserialization",
    objective: "Identify and exploit insecure deserialization vulnerabilities.",
    focus: "Web Security",
    difficulty: "advanced",
    xp: 220,
    estimatedMinutes: 40,
    prerequisite: 27,
    description: "Understand the risks of insecure deserialization. Exploit untrusted data deserialization to achieve remote code execution.",
  },
  {
    number: 29,
    title: "API Security Testing",
    label: "Mission 29: API Security Testing",
    objective: "Test REST and GraphQL APIs for common security flaws.",
    focus: "Web Security",
    difficulty: "intermediate",
    xp: 200,
    estimatedMinutes: 35,
    prerequisite: 28,
    description: "Test API endpoints for security vulnerabilities. Identify mass assignment, broken object-level authorization, and injection flaws.",
  },
  {
    number: 30,
    title: "Web Application Firewall Evasion",
    label: "Mission 30: Web Application Firewall Evasion",
    objective: "Bypass WAF rules using encoding, obfuscation, and logic tricks.",
    focus: "Web Security",
    difficulty: "advanced",
    xp: 240,
    estimatedMinutes: 40,
    prerequisite: 29,
    description: "Evade web application firewalls using advanced techniques. Encode payloads, split requests, and bypass signature-based detection.",
  },
  {
    number: 31,
    title: "Container Security Fundamentals",
    label: "Mission 31: Container Security Fundamentals",
    objective: "Harden Docker containers and identify common container misconfigurations.",
    focus: "Cloud Security",
    difficulty: "intermediate",
    xp: 180,
    estimatedMinutes: 30,
    prerequisite: 30,
    description: "Secure containerized environments. Identify privilege escalation paths, volume mount risks, and network exposure in container setups.",
  },
  {
    number: 32,
    title: "Kubernetes Security Assessment",
    label: "Mission 32: Kubernetes Security Assessment",
    objective: "Audit a Kubernetes cluster for RBAC, pod security, and network policy flaws.",
    focus: "Cloud Security",
    difficulty: "advanced",
    xp: 240,
    estimatedMinutes: 45,
    prerequisite: 31,
    description: "Assess Kubernetes security posture. Test RBAC configurations, pod security policies, and network segmentation effectiveness.",
  },
  {
    number: 33,
    title: "Cloud Infrastructure Reconnaissance",
    label: "Mission 33: Cloud Infrastructure Reconnaissance",
    objective: "Map cloud infrastructure and identify exposed services and misconfigurations.",
    focus: "Cloud Security",
    difficulty: "intermediate",
    xp: 190,
    estimatedMinutes: 35,
    prerequisite: 32,
    description: "Reconnaissance in cloud environments. Identify exposed S3 buckets, open security groups, and IAM misconfigurations.",
  },
  {
    number: 34,
    title: "IAM Privilege Escalation",
    label: "Mission 34: IAM Privilege Escalation",
    objective: "Identify and exploit IAM policy misconfigurations in cloud environments.",
    focus: "Cloud Security",
    difficulty: "advanced",
    xp: 250,
    estimatedMinutes: 40,
    prerequisite: 33,
    description: "Escalate privileges through misconfigured IAM policies. Chain permissions to access restricted resources.",
  },
  {
    number: 35,
    title: "SIEM Operations & Log Analysis",
    label: "Mission 35: SIEM Operations & Log Analysis",
    objective: "Analyze security logs in a SIEM to detect and investigate threats.",
    focus: "Incident Response",
    difficulty: "intermediate",
    xp: 200,
    estimatedMinutes: 35,
    prerequisite: 34,
    description: "Operate a SIEM environment. Correlate log sources, create detection rules, and investigate security incidents.",
  },
  {
    number: 36,
    title: "Network Segmentation Testing",
    label: "Mission 36: Network Segmentation Testing",
    objective: "Test network segmentation controls and identify lateral movement paths.",
    focus: "Network Security",
    difficulty: "advanced",
    xp: 220,
    estimatedMinutes: 40,
    prerequisite: 35,
    description: "Validate network segmentation effectiveness. Identify ACL gaps, VLAN hopping opportunities, and unrestricted east-west traffic.",
  },
  {
    number: 37,
    title: "Wireless Security Assessment",
    label: "Mission 37: Wireless Security Assessment",
    objective: "Assess wireless network security and identify common attack vectors.",
    focus: "Network Security",
    difficulty: "intermediate",
    xp: 180,
    estimatedMinutes: 30,
    prerequisite: 36,
    description: "Evaluate wireless network security. Test for weak encryption, rogue access points, and client-side attack surfaces.",
  },
  {
    number: 38,
    title: "Buffer Overflow Fundamentals",
    label: "Mission 38: Buffer Overflow Fundamentals",
    objective: "Understand stack-based buffer overflows and control flow hijacking.",
    focus: "Exploitation",
    difficulty: "advanced",
    xp: 260,
    estimatedMinutes: 45,
    prerequisite: 37,
    description: "Learn the fundamentals of buffer overflow exploitation. Control EIP, bypass DEP/NX, and execute shellcode.",
  },
  {
    number: 39,
    title: "Privilege Escalation Techniques",
    label: "Mission 39: Privilege Escalation Techniques",
    objective: "Escalate privileges on Linux and Windows targets through common misconfigurations.",
    focus: "Exploitation",
    difficulty: "intermediate",
    xp: 220,
    estimatedMinutes: 40,
    prerequisite: 38,
    description: "Escalate privileges from low-privileged access. Exploit kernel vulnerabilities, misconfigured services, and weak permissions.",
  },
  {
    number: 40,
    title: "Password Cracking & Hash Analysis",
    label: "Mission 40: Password Cracking & Hash Analysis",
    objective: "Identify hash types and crack passwords using various attack modes.",
    focus: "Exploitation",
    difficulty: "intermediate",
    xp: 170,
    estimatedMinutes: 30,
    prerequisite: 39,
    description: "Analyze password hashes and deploy cracking strategies. Learn about rainbow tables, dictionary attacks, and GPU-accelerated cracking.",

  // ═══ Phase 3: Advanced Exploitation & Defense (Missions 41-60) ═══
  },
  {
    number: 41,
    title: "Memory Forensics Analysis",
    label: "Mission 41: Memory Forensics Analysis",
    objective: "Analyze memory dumps to detect malware, rootkits, and attacker artifacts.",
    focus: "Forensics",
    difficulty: "advanced",
    xp: 250,
    estimatedMinutes: 45,
    prerequisite: 40,
    description: "Perform memory forensics analysis. Extract processes, network connections, and malicious artifacts from RAM dumps.",
  },
  {
    number: 42,
    title: "Disk Forensics & Evidence Collection",
    label: "Mission 42: Disk Forensics & Evidence Collection",
    objective: "Collect and analyze disk evidence while maintaining chain of custody.",
    focus: "Forensics",
    difficulty: "intermediate",
    xp: 210,
    estimatedMinutes: 40,
    prerequisite: 41,
    description: "Conduct disk forensics investigations. Acquire images, recover deleted files, and document evidence with proper chain of custody.",
  },
  {
    number: 43,
    title: "Malware Analysis & Reverse Engineering",
    label: "Mission 43: Malware Analysis & Reverse Engineering",
    objective: "Perform static and dynamic analysis of malware samples in a sandbox.",
    focus: "Forensics",
    difficulty: "advanced",
    xp: 280,
    estimatedMinutes: 50,
    prerequisite: 42,
    description: "Analyze malware in a controlled environment. Perform static analysis, dynamic behavior monitoring, and basic reverse engineering.",
  },
  {
    number: 44,
    title: "Threat Hunting Operations",
    label: "Mission 44: Threat Hunting Operations",
    objective: "Proactively hunt for threats using hypothesis-driven investigation.",
    focus: "Incident Response",
    difficulty: "advanced",
    xp: 260,
    estimatedMinutes: 45,
    prerequisite: 43,
    description: "Lead proactive threat hunting operations. Formulate hypotheses, collect evidence, and identify threats before they trigger alerts.",
  },
  {
    number: 45,
    title: "Cryptography in Practice",
    label: "Mission 45: Cryptography in Practice",
    objective: "Identify weak cryptographic implementations and apply secure alternatives.",
    focus: "Cryptography",
    difficulty: "intermediate",
    xp: 190,
    estimatedMinutes: 35,
    prerequisite: 44,
    description: "Apply cryptography principles in real-world scenarios. Identify weak ciphers, broken implementations, and recommended alternatives.",
  },
  {
    number: 46,
    title: "TLS & Certificate Security",
    label: "Mission 46: TLS & Certificate Security",
    objective: "Audit TLS configurations and identify certificate chain weaknesses.",
    focus: "Network Security",
    difficulty: "intermediate",
    xp: 180,
    estimatedMinutes: 25,
    prerequisite: 45,
    description: "Assess TLS security posture. Analyze certificate chains, protocol versions, cipher suites, and common misconfigurations.",
  },
  {
    number: 47,
    title: "Active Directory Security",
    label: "Mission 47: Active Directory Security",
    objective: "Audit Active Directory for common security misconfigurations.",
    focus: "Network Security",
    difficulty: "advanced",
    xp: 260,
    estimatedMinutes: 45,
    prerequisite: 46,
    description: "Assess Active Directory security. Identify Kerberos attacks, delegation abuse, and domain privilege escalation paths.",
  },
  {
    number: 48,
    title: "Social Engineering Operations",
    label: "Mission 48: Social Engineering Operations",
    objective: "Plan and execute ethical social engineering scenarios for security awareness.",
    focus: "Social Engineering",
    difficulty: "intermediate",
    xp: 200,
    estimatedMinutes: 35,
    prerequisite: 47,
    description: "Understand social engineering tactics from an operator's perspective. Plan pretexts, craft phishing campaigns, and recommend awareness training.",
  },
  {
    number: 49,
    title: "Physical Security Assessment",
    label: "Mission 49: Physical Security Assessment",
    objective: "Assess physical security controls and identify bypass opportunities.",
    focus: "Social Engineering",
    difficulty: "intermediate",
    xp: 170,
    estimatedMinutes: 30,
    prerequisite: 48,
    description: "Evaluate physical security measures. Test access controls, tailgating prevention, and facility security awareness.",
  },
  {
    number: 50,
    title: "Mobile Application Security",
    label: "Mission 50: Mobile Application Security",
    objective: "Test mobile applications for common security vulnerabilities.",
    focus: "Mobile Security",
    difficulty: "advanced",
    xp: 240,
    estimatedMinutes: 40,
    prerequisite: 49,
    description: "Assess mobile application security. Test for insecure storage, broken cryptography, and platform-specific vulnerabilities.",
  },
  {
    number: 51,
    title: "DevSecOps Pipeline Integration",
    label: "Mission 51: DevSecOps Pipeline Integration",
    objective: "Integrate security testing into CI/CD pipelines.",
    focus: "Cloud Security",
    difficulty: "advanced",
    xp: 230,
    estimatedMinutes: 40,
    prerequisite: 50,
    description: "Embed security into the development pipeline. Implement SAST, DAST, and dependency scanning in CI/CD workflows.",
  },
  {
    number: 52,
    title: "Supply Chain Security Analysis",
    label: "Mission 52: Supply Chain Security Analysis",
    objective: "Identify supply chain risks in third-party dependencies and software components.",
    focus: "Cloud Security",
    difficulty: "advanced",
    xp: 220,
    estimatedMinutes: 35,
    prerequisite: 51,
    description: "Analyze software supply chain risks. Audit dependencies, verify software provenance, and detect malicious packages.",
  },
  {
    number: 53,
    title: "Red Team Engagement Planning",
    label: "Mission 53: Red Team Engagement Planning",
    objective: "Plan and scope a red team engagement with defined rules of engagement.",
    focus: "Exploitation",
    difficulty: "pro",
    xp: 300,
    estimatedMinutes: 50,
    prerequisite: 52,
    description: "Plan a professional red team engagement. Define scope, rules of engagement, communication channels, and success criteria.",
  },
  {
    number: 54,
    title: "Blue Team Defense Operations",
    label: "Mission 54: Blue Team Defense Operations",
    objective: "Build and validate detection and response capabilities for common attack patterns.",
    focus: "Defense",
    difficulty: "pro",
    xp: 290,
    estimatedMinutes: 50,
    prerequisite: 53,
    description: "Build blue team capabilities. Develop detection rules, automate response playbooks, and validate coverage against MITRE ATT&CK.",
  },
  {
    number: 55,
    title: "Purple Team Coordination",
    label: "Mission 55: Purple Team Coordination",
    objective: "Facilitate purple team exercises that validate detection and response capabilities.",
    focus: "Defense",
    difficulty: "pro",
    xp: 280,
    estimatedMinutes: 45,
    prerequisite: 54,
    description: "Coordinate purple team operations. Bridge red and blue team findings to improve overall security posture.",
  },
  {
    number: 56,
    title: "Incident Recovery & Business Continuity",
    label: "Mission 56: Incident Recovery & Business Continuity",
    objective: "Develop and test incident recovery procedures and business continuity plans.",
    focus: "Incident Response",
    difficulty: "advanced",
    xp: 250,
    estimatedMinutes: 40,
    prerequisite: 55,
    description: "Build incident recovery capabilities. Develop recovery procedures, test backup integrity, and validate business continuity plans.",
  },
  {
    number: 57,
    title: "Security Architecture Review",
    label: "Mission 57: Security Architecture Review",
    objective: "Review security architecture for design flaws and recommend improvements.",
    focus: "Defense",
    difficulty: "pro",
    xp: 300,
    estimatedMinutes: 50,
    prerequisite: 56,
    description: "Evaluate security architecture designs. Identify trust boundaries, threat modeling gaps, and architectural weaknesses.",
  },
  {
    number: 58,
    title: "Compliance & Audit Preparation",
    label: "Mission 58: Compliance & Audit Preparation",
    objective: "Prepare for security audits and map controls to compliance frameworks.",
    focus: "Defense",
    difficulty: "advanced",
    xp: 230,
    estimatedMinutes: 40,
    prerequisite: 57,
    description: "Prepare for compliance audits. Map security controls to NIST, ISO 27001, SOC 2, and other frameworks.",
  },
  {
    number: 59,
    title: "Bug Bounty Methodology",
    label: "Mission 59: Bug Bounty Methodology",
    objective: "Apply professional bug bounty hunting methodology to find and report vulnerabilities.",
    focus: "Web Security",
    difficulty: "pro",
    xp: 320,
    estimatedMinutes: 55,
    prerequisite: 58,
    description: "Master bug bounty hunting methodology. Scope targets, prioritize attack surfaces, and write professional vulnerability reports.",
  },
  {
    number: 60,
    title: "Final Guardian Challenge",
    label: "Mission 60: Final Guardian Challenge",
    objective: "Complete a comprehensive capstone exercise combining all learned skills.",
    focus: "Exploitation",
    difficulty: "pro",
    xp: 500,
    estimatedMinutes: 90,
    prerequisite: 59,
    description: "The ultimate test. Combine all skills in a comprehensive capstone exercise that validates your readiness as a ZeroDay Guardian.",
  },
];

/** Lookup a mission entry by its sequential number (1-60) */
export function getMission(day: number): MissionEntry | undefined {
  return MISSION_CATALOG.find((m) => m.number === day);
}

/** Get the formatted mission label for a day number */
export function getMissionLabel(day: number): string {
  const mission = getMission(day);
  if (mission) return mission.label;
  return `Mission ${String(day).padStart(2, "0")}`;
}

/** Get the short mission title for a day number */
export function getMissionTitle(day: number): string {
  const mission = getMission(day);
  if (mission) return mission.title;
  return `Mission ${day}`;
}

/** Get mission objective for a day number */
export function getMissionObjective(day: number): string {
  const mission = getMission(day);
  return mission?.objective ?? `Complete a realistic guided lab for Mission ${String(day).padStart(2, "0")}.`;
}

/** Get mission XP reward */
export function getMissionXp(day: number): number {
  const mission = getMission(day);
  return mission?.xp ?? 100;
}

/** Get mission difficulty */
export function getMissionDifficulty(day: number): MissionDifficulty {
  const mission = getMission(day);
  return mission?.difficulty ?? "beginner";
}

/** Get mission focus area */
export function getMissionFocus(day: number): MissionFocus {
  const mission = getMission(day);
  return mission?.focus ?? "Reconnaissance";
}

/** Get mission estimated time */
export function getMissionMinutes(day: number): number {
  const mission = getMission(day);
  return mission?.estimatedMinutes ?? 15;
}

/** Get the next mission number or null if at capstone */
export function getNextMission(day: number): number | null {
  return day < 60 ? day + 1 : null;
}

/** Get mission description */
export function getMissionDescription(day: number): string {
  const mission = getMission(day);
  return mission?.description ?? `Mission ${String(day).padStart(2, "0")} in the ZeroDay Guardian training program.`;
}

export default MISSION_CATALOG;
