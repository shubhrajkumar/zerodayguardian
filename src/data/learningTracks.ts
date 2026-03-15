export interface TrackResource {
  title: string;
  platform: string;
  url: string;
}

export interface LearningTrack {
  id: string;
  title: string;
  description: string;
  tags: string[];
  query: string;
  resources: TrackResource[];
}

export const learningTracks: LearningTrack[] = [
  {
    id: "ai-log-analysis",
    title: "AI Log Analysis",
    description: "Use ML-assisted workflows to detect anomalies and prioritize incident signals.",
    tags: ["ai", "logs", "siem", "soc"],
    query: "AI log analysis for security operations",
    resources: [
      { title: "SIEM Fundamentals", platform: "TryHackMe", url: "https://tryhackme.com/" },
      { title: "Security Monitoring with Splunk", platform: "Cybrary", url: "https://www.cybrary.it/" },
      { title: "MITRE ATT&CK Detection Engineering", platform: "MITRE ATT&CK", url: "https://attack.mitre.org/" },
    ],
  },
  {
    id: "malware-detection",
    title: "Malware Detection",
    description: "Build practical malware analysis and detection skills with modern tooling.",
    tags: ["malware", "analysis", "reverse engineering"],
    query: "malware detection learning path",
    resources: [
      { title: "Intro to Malware Analysis", platform: "Hack The Box Academy", url: "https://academy.hackthebox.com/" },
      { title: "Malware Traffic Analysis", platform: "TryHackMe", url: "https://tryhackme.com/" },
      { title: "Malware Analysis Essentials", platform: "Cybrary", url: "https://www.cybrary.it/" },
    ],
  },
  {
    id: "phishing-detection",
    title: "Phishing Detection",
    description: "Identify and defend against phishing campaigns using technical and human-layer controls.",
    tags: ["phishing", "email security", "awareness"],
    query: "phishing detection and defense",
    resources: [
      { title: "Phishing Analysis Room", platform: "TryHackMe", url: "https://tryhackme.com/" },
      { title: "Security Awareness and Social Engineering", platform: "Cybrary", url: "https://www.cybrary.it/" },
      { title: "Email Security Best Practices", platform: "CISA", url: "https://www.cisa.gov/" },
    ],
  },
  {
    id: "prompt-engineering",
    title: "Prompt Engineering for Cybersecurity",
    description: "Design robust prompts for triage, investigation, and secure automation support.",
    tags: ["prompt engineering", "ai", "automation"],
    query: "prompt engineering for cybersecurity",
    resources: [
      { title: "Prompt Engineering Guide", platform: "OpenAI", url: "https://platform.openai.com/docs/guides/prompt-engineering" },
      { title: "AI Security Foundations", platform: "OWASP", url: "https://owasp.org/" },
      { title: "AI for Cybersecurity", platform: "Coursera", url: "https://www.coursera.org/" },
    ],
  },
  {
    id: "automation-workflows",
    title: "Automation Workflows",
    description: "Automate repetitive security tasks with scripting and orchestration.",
    tags: ["automation", "python", "devsecops", "soar"],
    query: "security automation workflows",
    resources: [
      { title: "Python for Security", platform: "Cybrary", url: "https://www.cybrary.it/" },
      { title: "SOC Automation", platform: "Hack The Box Academy", url: "https://academy.hackthebox.com/" },
      { title: "DevSecOps Learning Path", platform: "Microsoft Learn", url: "https://learn.microsoft.com/" },
    ],
  },
  {
    id: "ai-cyber-integration-lab",
    title: "AI + Cyber Integration Lab",
    description: "Hands-on labs where AI techniques meet offensive and defensive security.",
    tags: ["ai", "lab", "cybersecurity"],
    query: "AI cyber integration lab",
    resources: [
      { title: "Cyber Labs", platform: "TryHackMe", url: "https://tryhackme.com/" },
      { title: "Enterprise Labs", platform: "Hack The Box", url: "https://www.hackthebox.com/" },
      { title: "AI Security Guidance", platform: "NIST", url: "https://www.nist.gov/" },
    ],
  },
  {
    id: "ethical-hacking-hub",
    title: "Ethical Hacking Learning Hub",
    description: "Structured progression from fundamentals to advanced exploitation and reporting.",
    tags: ["ethical hacking", "pentesting", "learning path"],
    query: "ethical hacking learning roadmap",
    resources: [
      { title: "Jr Penetration Tester", platform: "TryHackMe", url: "https://tryhackme.com/" },
      { title: "Penetration Tester Path", platform: "Hack The Box Academy", url: "https://academy.hackthebox.com/" },
      { title: "Ethical Hacking Career Path", platform: "Cybrary", url: "https://www.cybrary.it/" },
    ],
  },
  {
    id: "kali-linux-guides",
    title: "Kali Linux Guides",
    description: "Master Kali tooling, workflows, and operational best practices for labs.",
    tags: ["kali linux", "tools", "offensive security"],
    query: "kali linux practical guide",
    resources: [
      { title: "Kali Linux Revealed", platform: "Offensive Security", url: "https://www.kali.org/" },
      { title: "Kali Rooms", platform: "TryHackMe", url: "https://tryhackme.com/" },
      { title: "Linux for Hackers", platform: "Hack The Box Academy", url: "https://academy.hackthebox.com/" },
    ],
  },
  {
    id: "web-exploitation",
    title: "Web Exploitation",
    description: "Develop deep practical skills for finding and exploiting real web vulnerabilities.",
    tags: ["web exploitation", "owasp", "bug bounty"],
    query: "web exploitation labs and guides",
    resources: [
      { title: "Web Security Academy", platform: "PortSwigger", url: "https://portswigger.net/web-security" },
      { title: "OWASP Top 10", platform: "OWASP", url: "https://owasp.org/www-project-top-ten/" },
      { title: "Web Pentesting Path", platform: "Hack The Box Academy", url: "https://academy.hackthebox.com/" },
    ],
  },
  {
    id: "nmap-mastery",
    title: "Nmap Mastery",
    description: "Learn high-signal reconnaissance, service analysis, and scripting strategies.",
    tags: ["nmap", "recon", "network scanning"],
    query: "nmap mastery training",
    resources: [
      { title: "Nmap Room", platform: "TryHackMe", url: "https://tryhackme.com/" },
      { title: "Nmap Documentation", platform: "Nmap", url: "https://nmap.org/book/man.html" },
      { title: "Network Enumeration", platform: "Hack The Box Academy", url: "https://academy.hackthebox.com/" },
    ],
  },
  {
    id: "practice-labs",
    title: "Practice Labs",
    description: "Train in realistic lab environments to convert theory into muscle memory.",
    tags: ["labs", "hands-on", "practice"],
    query: "cybersecurity practice labs",
    resources: [
      { title: "Guided Labs", platform: "TryHackMe", url: "https://tryhackme.com/" },
      { title: "Pro Labs", platform: "Hack The Box", url: "https://www.hackthebox.com/" },
      { title: "Cyber Range", platform: "SANS", url: "https://www.sans.org/" },
    ],
  },
  {
    id: "courses",
    title: "Courses",
    description: "Build structured depth with globally recognized cybersecurity courses.",
    tags: ["courses", "learning", "certification"],
    query: "best cybersecurity courses",
    resources: [
      { title: "Cybersecurity Courses", platform: "Coursera", url: "https://www.coursera.org/" },
      { title: "Security Learning Paths", platform: "Cybrary", url: "https://www.cybrary.it/" },
      { title: "AWS Security Learning", platform: "AWS Skill Builder", url: "https://explore.skillbuilder.aws/" },
    ],
  },
  {
    id: "intro-ethical-hacking",
    title: "Intro to Ethical Hacking",
    description: "Foundational concepts for beginners entering the cybersecurity domain.",
    tags: ["beginner", "ethical hacking", "fundamentals"],
    query: "intro to ethical hacking",
    resources: [
      { title: "Pre-Security Path", platform: "TryHackMe", url: "https://tryhackme.com/" },
      { title: "Ethical Hacking Basics", platform: "Cybrary", url: "https://www.cybrary.it/" },
      { title: "Cybersecurity Fundamentals", platform: "Cisco Skills", url: "https://skillsforall.com/" },
    ],
  },
  {
    id: "beginner-advanced-nmap",
    title: "Beginner & Advanced Nmap Techniques",
    description: "Progress from simple host discovery to NSE scripts and advanced scan strategy.",
    tags: ["nmap", "beginner", "advanced"],
    query: "beginner and advanced nmap techniques",
    resources: [
      { title: "Nmap for Beginners", platform: "TryHackMe", url: "https://tryhackme.com/" },
      { title: "NSE Script Guide", platform: "Nmap", url: "https://nmap.org/book/nse.html" },
      { title: "Enumeration Mastery", platform: "Hack The Box Academy", url: "https://academy.hackthebox.com/" },
    ],
  },
  {
    id: "intermediate-web-workshop",
    title: "Intermediate Web Exploitation Workshop",
    description: "Bridge fundamentals to real bug-class chaining and practical reporting.",
    tags: ["web exploitation", "intermediate", "labs"],
    query: "intermediate web exploitation workshop",
    resources: [
      { title: "Intermediate Web Labs", platform: "PortSwigger", url: "https://portswigger.net/web-security" },
      { title: "OWASP Testing Guide", platform: "OWASP", url: "https://owasp.org/www-project-web-security-testing-guide/" },
      { title: "Bug Bounty Track", platform: "Hack The Box Academy", url: "https://academy.hackthebox.com/" },
    ],
  },
  {
    id: "advanced-ai-tools-review",
    title: "Advanced AI Security Tools Review Hub",
    description: "Evaluate top AI security tools with practical benchmarks and strategic fit criteria.",
    tags: ["ai tools", "security tools", "advanced"],
    query: "advanced ai security tools review",
    resources: [
      { title: "AI Security Project", platform: "OWASP", url: "https://owasp.org/" },
      { title: "Cloud AI Security Docs", platform: "Google Cloud", url: "https://cloud.google.com/security" },
      { title: "AI Governance Guidance", platform: "NIST", url: "https://www.nist.gov/" },
    ],
  },
];

