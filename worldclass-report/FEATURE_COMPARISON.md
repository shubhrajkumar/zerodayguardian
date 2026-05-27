# ZeroDay Guardian — Feature Comparison

**Comparison Date:** May 27, 2026

---

## Competitive Landscape

| Platform | Type | Pricing | Open Source | Architecture |
|----------|------|---------|-------------|-------------|
| **ZeroDay Guardian** | Cybersecurity SaaS | Freemium | Yes (source available) | React + Express + FastAPI |
| **TryHackMe** | Cyber Learning Platform | Subscription | No | Monolithic Web App |
| **CyberMindSpace** | Cyber Learning Platform | Subscription | No | Monolithic Web App |
| **HackTheBox** | Cyber Lab Platform | Subscription | No | Monolithic Web App |
| **PentesterLab** | Cyber Lab Platform | Subscription | No | Monolithic Web App |

## Feature Matrix

| Feature | ZeroDay Guardian | TryHackMe | CyberMindSpace | HackTheBox |
|---------|-----------------|-----------|----------------|------------|
| **Authentication** | | | | |
| Email/Password Login | ✅ | ✅ | ✅ | ✅ |
| Google OAuth | ✅ | ❌ | ❌ | ❌ |
| JWT + Refresh Tokens | ✅ | ✅ | ✅ | ✅ |
| MFA Support | ✅ (via Firebase) | ✅ | ❌ | ❌ |
| CSRF Protection | ✅ | ❌ | ❌ | ❌ |
| RBAC (Admin/User/Guest) | ✅ | ✅ | ✅ | ✅ |

| **Labs & Learning** | | | | |
| Interactive Browser Labs | ✅ (Backend-integrated) | ✅ | ✅ | ✅ |
| OSINT Workflows | ✅ | ❌ | ❌ | ❌ |
| 60-Day Program | ✅ | ✅ | ✅ | ❌ |
| Adaptive Difficulty | ✅ (AI-powered) | ❌ | ❌ | ❌ |
| Mission System | ✅ | ✅ | ❌ | ✅ |
| CTF Challenges | ✅ | ✅ | ✅ | ✅ |
| Real-time Attack Sims | ✅ | ❌ | ❌ | ❌ |

| **Gamification** | | | | |
| XP/Level System | ✅ (Firestore-backed) | ✅ | ✅ | ✅ |
| Streaks | ✅ | ✅ | ❌ | ❌ |
| Badges | ✅ | ✅ | ✅ | ✅ |
| Leaderboards | ✅ | ✅ | ❌ | ✅ |
| Certificates | ✅ (Planned) | ✅ | ❌ | ❌ |

| **AI Features** | | | | |
| AI Mentor (ZORVIX) | ✅ | ❌ | ❌ | ❌ |
| Adaptive Recommendations | ✅ | ❌ | ❌ | ❌ |
| Auto-Feedback on Labs | ✅ | ✅ | ❌ | ❌ |
| LLM Integration | ✅ (OpenAI/Llama) | ❌ | ❌ | ❌ |

| **Tools** | | | | |
| Domain Scanner | ✅ | ❌ | ❌ | ❌ |
| Web Security Scanner | ✅ | ❌ | ❌ | ❌ |
| Header Analyzer | ✅ | ❌ | ❌ | ❌ |
| OSINT Tools | ✅ | ❌ | ❌ | ❌ |
| Google Dork Generator | ✅ | ❌ | ❌ | ❌ |

| **Security** | | | | |
| HTTPS/HSTS | ✅ | ✅ | ✅ | ✅ |
| CSP Headers | ✅ | ✅ | ❌ | ❌ |
| Helmet.js | ✅ | ❌ | ❌ | ❌ |
| Rate Limiting | ✅ | ✅ | ❌ | ✅ |
| Firestore Security Rules | ✅ | N/A | N/A | N/A |

| **Infrastructure** | | | | |
| Docker Support | ✅ | ❌ | ❌ | ❌ |
| Kubernetes | ✅ | ❌ | ❌ | ❌ |
| CI/CD (GitHub Actions) | ✅ | ❌ | ❌ | ❌ |
| OpenTelemetry | ✅ | ❌ | ❌ | ❌ |
| Prometheus Metrics | ✅ | ❌ | ❌ | ❌ |

| **Compliance** | | | | |
| GDPR Cookie Consent | ✅ | ✅ | ❌ | ❌ |
| Privacy Policy | ✅ | ✅ | ✅ | ✅ |
| Terms of Service | ✅ | ✅ | ✅ | ✅ |
| Data Export/Delete | ✅ | ✅ | ❌ | ❌ |

| **Deployment** | | | | |
| Vercel Deployment | ✅ | ❌ | ❌ | ❌ |
| Render Deployment | ✅ | ❌ | ❌ | ❌ |
| Self-Hosted | ✅ | ❌ | ❌ | ❌ |
| SaaS + On-Prem | ✅ | ❌ | ❌ | ❌ |

## Key Differentiators

### 1. Open Source Architecture
ZeroDay Guardian is the only platform with a **fully open-source, self-hostable** architecture. Users can deploy their own instance, modify the codebase, and integrate custom tools.

### 2. AI-Powered Adaptive Learning
ZORVIX AI mentor provides **real-time, context-aware guidance** during lab exercises — differentiating from TryHackMe's static hint system.

### 3. OSINT + Security Tools
Unique integration of **production-grade OSINT tools** (WHOIS, DNS, headers, web scans, dork generator) within the same platform as learning labs.

### 4. Modern Infrastructure
Full **Docker + Kubernetes + CI/CD** pipeline with OpenTelemetry observability — enterprise-grade infrastructure uncommon in cyber learning platforms.

### 5. API-First Design
Every feature is accessible via **REST API**, enabling automation, custom integrations, and programmatic access — a feature absent from all competitors.

### 6. Dual Database Architecture
**MongoDB** for flexible primary storage + **PostgreSQL** for structured analytics + **Firestore** for real-time gamification — optimized for different workloads.

## Areas for Improvement

1. **Content Volume**: TryHackMe has 600+ rooms vs ~50 labs currently
2. **Community Size**: TryHackMe has 4M+ users; growing community features
3. **Mobile App**: No native mobile app yet (existing competitors have mobile)
4. **Corporate Training**: Lacks LMS features (SCORM, progress reports for teams)
5. **Certifications**: No formal certification program (competitors offer certificates)

## Summary

ZeroDay Guardian competes **strongly on architecture, AI features, OSINT tools, and deployment flexibility** but trails on content volume and community size. The platform's **open-source, API-first, AI-powered approach** is a unique value proposition in the market.
