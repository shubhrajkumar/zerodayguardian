export type ResourceKind = "Guide" | "Tutorial" | "Reference" | "Course" | "Playbook";

export interface LearningResource {
  id: string;
  title: string;
  kind: ResourceKind;
  source: string;
  url: string;
  summary: string;
  tags: string[];
}

export const resourceCatalog: LearningResource[] = [
  {
    id: "owasp-top-10",
    title: "OWASP Top 10 Web Application Security Risks",
    kind: "Guide",
    source: "OWASP",
    url: "https://owasp.org/www-project-top-ten/",
    summary: "Industry-standard breakdown of critical web security risks with remediation guidance.",
    tags: ["web security", "owasp", "application security", "vulnerability management"],
  },
  {
    id: "mitre-attack",
    title: "MITRE ATT&CK Knowledge Base",
    kind: "Reference",
    source: "MITRE",
    url: "https://attack.mitre.org/",
    summary: "Global adversary tactics and techniques mapping for defense strategy and detection design.",
    tags: ["threat intelligence", "detection engineering", "soc", "incident response"],
  },
  {
    id: "nist-csf",
    title: "NIST Cybersecurity Framework",
    kind: "Playbook",
    source: "NIST",
    url: "https://www.nist.gov/cyberframework",
    summary: "Strategic framework for identifying, protecting, detecting, responding, and recovering.",
    tags: ["governance", "risk management", "security program", "compliance"],
  },
  {
    id: "portswigger-web-security-academy",
    title: "PortSwigger Web Security Academy",
    kind: "Tutorial",
    source: "PortSwigger",
    url: "https://portswigger.net/web-security",
    summary: "Hands-on labs for modern web exploitation and secure coding mindset.",
    tags: ["web security", "pentesting", "bug bounty", "hands-on labs"],
  },
  {
    id: "kubernetes-security",
    title: "Kubernetes Security Best Practices",
    kind: "Guide",
    source: "Kubernetes Docs",
    url: "https://kubernetes.io/docs/concepts/security/",
    summary: "Official best practices for securing workloads and clusters at scale.",
    tags: ["cloud security", "kubernetes", "devsecops", "infrastructure security"],
  },
  {
    id: "cisa-alerts",
    title: "CISA Cybersecurity Advisories and Alerts",
    kind: "Reference",
    source: "CISA",
    url: "https://www.cisa.gov/news-events/cybersecurity-advisories",
    summary: "Current advisories and known exploited vulnerabilities from U.S. CISA.",
    tags: ["threat intelligence", "vulnerability", "cve", "incident response"],
  },
  {
    id: "owasp-asvs",
    title: "OWASP Application Security Verification Standard",
    kind: "Playbook",
    source: "OWASP",
    url: "https://owasp.org/www-project-application-security-verification-standard/",
    summary: "Comprehensive requirements framework for secure application architecture and testing.",
    tags: ["application security", "secure architecture", "sdlc", "security testing"],
  },
  {
    id: "google-secops-learning",
    title: "Google Cloud Security Learning Path",
    kind: "Course",
    source: "Google Cloud",
    url: "https://cloud.google.com/learn/security",
    summary: "Structured cloud security learning across identity, network, and workload hardening.",
    tags: ["cloud security", "learning path", "identity", "network security"],
  },
];

