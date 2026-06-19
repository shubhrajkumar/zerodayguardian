/**
 * ProgramDay1Page — Standalone production-grade Day 1 launchpad.
 *
 * "DAY 01: Foundational Reconnaissance & Operational Security (OPSEC) Setup"
 *
 * Features:
 * - Hero section with operator momentum framing
 * - 60-day roadmap telemetry timeline (Day 1 active, Days 2-60 locked)
 * - 3 interactive tasks with real steps, terminal commands, and DNS data
 * - "Mark Day 1 Complete & Advance" action button
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Copy,
  Lock,
  PlayCircle,
  Shield,
  TerminalSquare,
  Globe,
  Network,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useUserProgress } from "@/context/UserProgressContext";
import { useMissionSystem } from "@/context/MissionSystemApiContext";
import { getMissionLabel, getMissionTitle } from "@/data/missionCatalog";
import { SYLLABUS_PHASES, TOTAL_DAYS, resolvePhase } from "@/lib/syllabusShared";
import SEOManager from "@/components/SEOManager";

// ── Types ──
type TaskStatus = "locked" | "active" | "completed";
type DayNode = {
  day: number;
  label: string;
  phaseName: string;
  vectorTrack: string;
  status: "locked" | "unlocked" | "active" | "completed";
};

interface TaskItem {
  id: string;
  number: number;
  title: string;
  description: string;
  steps: string[];
  commandBlocks?: { label: string; command: string }[];
  dataSets?: { label: string; content: string }[];
  status: TaskStatus;
}

// ── Constants ──
const STORAGE_KEY = "zdg:roadmap:day1:completed";

// ── Phase color map ──
const PHASE_COLORS: Record<string, { border: string; bg: string; text: string; glow: string; dot: string }> = {
  RECON: {
    border: "border-cyan-500/30",
    bg: "bg-cyan-500/8",
    text: "text-cyan-300",
    glow: "rgba(34,211,238,0.2)",
    dot: "bg-cyan-400",
  },
  APPSEC: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/8",
    text: "text-emerald-300",
    glow: "rgba(52,211,153,0.2)",
    dot: "bg-emerald-400",
  },
  BINARY_PWN: {
    border: "border-purple-500/30",
    bg: "bg-purple-500/8",
    text: "text-purple-300",
    glow: "rgba(167,139,250,0.2)",
    dot: "bg-purple-400",
  },
};

const getPhaseColor = (track: string) => PHASE_COLORS[track] || PHASE_COLORS.RECON;

// ── Day 1 Task Data ──
const DAY1_TASKS: TaskItem[] = [
  {
    id: "task-1",
    number: 1,
    title: "Configure an Isolated Threat Research Environment",
    description:
      "Establish your isolated analysis perimeter using a Type-2 hypervisor (VirtualBox or VMware). Deploy a Whonix Gateway + Workstation or Kali Linux as your primary research environment. This segregation ensures your OSINT and recon activities never leak your actual identity or IP address.",
    steps: [
      "Download and install VirtualBox 7.x (or VMware Workstation Pro) on your host machine",
      "Allocate minimum 4 GB RAM and 2 vCPU cores to the VM — adjust based on host capacity",
      "Download the Kali Linux 2026.1 ISO or Whonix 16 OVA from the official mirrors",
      "Verify ISO checksum against the published SHA-256 hash before first boot",
      "Configure VM network adapter to NAT (for updates) + Host-Only (for isolated lab access)",
      "Spoof the MAC address in VM settings to a randomized OUI before connecting to the network",
      "Boot the VM, run `sudo apt update && sudo apt full-upgrade -y` to establish baseline",
      "Install core tools: `sudo apt install -y nmap whois dnsutils curl netcat-openbsd`",
    ],
    commandBlocks: [
      {
        label: "Verify VM Network Isolation",
        command:
          "# Check for IP/DNS leaks from within the VM\ncurl -s https://ipleak.net/json/ | python3 -m json.tool\n# Verify no local network services are reachable\nnmap -sn 192.168.56.0/24 2>/dev/null | grep -E \"Nmap done|Host is up\"",
      },
      {
        label: "Spoof MAC Address (Kali)",
        command:
          "# Find your network interface\nip link show\n# Bring interface down, change MAC, bring up\nsudo ip link set eth0 down\nsudo ip link set eth0 address 02:$(openssl rand -hex 5 | sed 's/\\(..\\)/\\1:/g; s/.$//')\nsudo ip link set eth0 up\n# Verify the change\nip link show eth0 | grep ether",
      },
    ],
    status: "active",
  },
  {
    id: "task-2",
    number: 2,
    title: "OPSEC Verification & DNS Leak Minimization",
    description:
      "Before performing any active reconnaissance, verify your operational security. A single DNS leak can expose your ISP-assigned IP address, defeating the purpose of the isolated environment. Configure system DNS to use encrypted resolvers and verify no requests bypass your tunnel.",
    steps: [
      'Disable systemd-resolved\'s stub resolver: `sudo systemctl stop systemd-resolved` and `sudo systemctl disable systemd-resolved`',
      "Remove the symlink and create a plain `/etc/resolv.conf` pointing to DNS-over-TLS providers",
      "Configure iptables to block all outbound DNS on port 53 except through your VPN/tunnel interface",
      "Verify no IPv6 DNS leaks by checking `/etc/resolv.conf` has no IPv6 nameservers",
      "Run a DNS leak test from within the VM: `curl -s https://dnsleaktest.com/json/ | python3 -m json.tool`",
      "Review your iptables rules with `sudo iptables -L -n -v` to ensure no unexpected outbound connections",
    ],
    commandBlocks: [
      {
        label: "Harden DNS Configuration",
        command:
          "# Disable systemd-resolved stub resolver\nsudo systemctl stop systemd-resolved\nsudo systemctl disable systemd-resolved\nsudo rm -f /etc/resolv.conf\n\n# Configure encrypted DNS via Quad9\necho \"nameserver 9.9.9.9\" | sudo tee /etc/resolv.conf\necho \"nameserver 149.112.112.112\" | sudo tee -a /etc/resolv.conf\n\n# Verify no leaks\niptables -L -n -v | grep -E \"53|domain\"",
      },
      {
        label: "Add DNS Leak Block Rule (iptables)",
        command:
          "# Block all outbound DNS except through VPN interface (tun0)\nsudo iptables -A OUTPUT -p udp --dport 53 -j DROP\nsudo iptables -A OUTPUT -p tcp --dport 53 -j DROP\nsudo iptables -I OUTPUT -o tun0 -p udp --dport 53 -j ACCEPT\nsudo iptables -I OUTPUT -o tun0 -p tcp --dport 53 -j ACCEPT\n\n# Verify rules\nsudo iptables -L -n -v | head -20",
      },
    ],
    status: "locked",
  },
  {
    id: "task-3",
    number: 3,
    title: "Initial Passive Recon: DNS Zone Transfers & Passive DNS Mining",
    description:
      "Execute passive reconnaissance against a designated target domain without sending a single packet to the target's infrastructure. Use DNS interrogation techniques including zone transfer attempts (AXFR), passive DNS database lookups, and historical certificate transparency log mining to build an asset inventory.",
    steps: [
      "Identify authoritative nameservers for the target domain: `nslookup -type=NS target-perimeter.com`",
      "Attempt a full zone transfer: `dig axfr @<nameserver> target-perimeter.com`",
      "Query passive DNS data via SecurityTrails or VirusTotal API for historical record discovery",
      "Mine Certificate Transparency logs via crt.sh: `curl -s 'https://crt.sh/?q=%25.target-perimeter.com&output=json' | python3 -m json.tool`",
      "Analyze returned A, AAAA, MX, and TXT records to map the external attack surface",
      "Document findings in a structured format: target IP ranges, mail server identities, SPF policies",
    ],
    commandBlocks: [
      {
        label: "DNS Reconnaissance Commands",
        command:
          "# Identify authoritative nameservers\nnslookup -type=NS target-perimeter.com\n\n# Attempt a zone transfer against each NS\ndig axfr @ns1.target-perimeter.com target-perimeter.com\n\n# Standard record enumeration\ndig A target-perimeter.com +short\ndig AAAA target-perimeter.com +short\ndig MX target-perimeter.com +short\ndig TXT target-perimeter.com +short\ndig CNAME target-perimeter.com +short\n\n# Passive DNS via crt.sh (Certificate Transparency)\ncurl -s \"https://crt.sh/?q=%25.target-perimeter.com&output=json\" | python3 -c \"import sys,json; data=json.load(sys.stdin); seen=set(); [print(r['name_value']) for r in data if r['name_value'] not in seen and not seen.add(r['name_value'])]\" | sort -u",
      },
    ],
    dataSets: [
      {
        label: "Zone Transfer Results — target-perimeter.com",
        content: `; <<>> DiG 9.18.28 <<>> axfr @ns1.target-perimeter.com target-perimeter.com
; (1 server found)
;; global options: +cmd
target-perimeter.com.  3600  IN  SOA  ns1.target-perimeter.com. admin.target-perimeter.com. 2026061901 3600 900 604800 86400
target-perimeter.com.  3600  IN  NS   ns1.target-perimeter.com.
target-perimeter.com.  3600  IN  NS   ns2.target-perimeter.com.
target-perimeter.com.  3600  IN  A    198.51.100.10
target-perimeter.com.  3600  IN  AAAA 2001:db8:1000::10
target-perimeter.com.  3600  IN  MX   10 mail.target-perimeter.com.
target-perimeter.com.  3600  IN  TXT  "v=spf1 mx include:_spf.google.com ~all"
mail.target-perimeter.com.  3600  IN  A    198.51.100.25
www.target-perimeter.com.  3600  IN  CNAME  target-perimeter.com.
api.target-perimeter.com.  3600  IN  A    198.51.100.30
vpn.target-perimeter.com.  3600  IN  A    198.51.100.35
dev.target-perimeter.com.  3600  IN  A    198.51.100.40
;; AXFR record: 11 records received`,
      },
      {
        label: "Certificate Transparency Subdomain Discovery",
        content: `crt.sh returned 23 unique subdomains for target-perimeter.com:

  admin.target-perimeter.com       → 198.51.100.50
  api.target-perimeter.com         → 198.51.100.30
  beta.target-perimeter.com        → 198.51.100.55
  blog.target-perimeter.com        → 198.51.100.60
  cdn.target-perimeter.com         → 198.51.100.65
  dev.target-perimeter.com         → 198.51.100.40
  docs.target-perimeter.com        → 198.51.100.70
  git.target-perimeter.com         → 198.51.100.75
  grafana.target-perimeter.com     → 198.51.100.80
  jenkins.target-perimeter.com     → 198.51.100.85
  jira.target-perimeter.com        → 198.51.100.90
  mail.target-perimeter.com        → 198.51.100.25
  monitor.target-perimeter.com     → 198.51.100.95
  ns1.target-perimeter.com         → 198.51.100.100
  ns2.target-perimeter.com         → 198.51.100.105
  portal.target-perimeter.com      → 198.51.100.110
  staging.target-perimeter.com     → 198.51.100.115
  support.target-perimeter.com     → 198.51.100.120
  vpn.target-perimeter.com         → 198.51.100.35
  webmail.target-perimeter.com     → 198.51.100.125
  www.target-perimeter.com         → 198.51.100.10 (CNAME)
  _dmarc.target-perimeter.com      → TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@target-perimeter.com"
  _domainconnect.target-perimeter.com → TXT "domain-connect-verified"`,
      },
    ],
    status: "locked",
  },
];

// ── Progress bar segments ──
const DAYS_PER_SEGMENT = 5;

// ── Page Component ──
export default function ProgramDay1Page() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { trackAction } = useUserProgress();
  const { recordAction } = useMissionSystem();

  const [tasks, setTasks] = useState<TaskItem[]>(DAY1_TASKS);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [completed, setCompleted] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [showConfetti, setShowConfetti] = useState(false);

  const completedTaskCount = useMemo(
    () => tasks.filter((t) => t.status === "completed").length,
    [tasks],
  );
  const allTasksComplete = completedTaskCount === tasks.length;

  // ── Build 60-day timeline nodes ──
  const dayNodes: DayNode[] = useMemo(
    () =>
      Array.from({ length: TOTAL_DAYS }, (_, i) => {
        const day = i + 1;
        const phase = resolvePhase(day);
        return {
          day,
          label: getMissionTitle(day),
          phaseName: phase.phase.name,
          vectorTrack: phase.vectorTrack,
          status:
            day === 1
              ? "active"
              : "locked",
        } as DayNode;
      }),
    [],
  );

  // ── Toggle task completion ──
  const toggleTask = useCallback(
    (taskId: string) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) {
            const newStatus: TaskStatus = t.status === "completed" ? "active" : "completed";
            return { ...t, status: newStatus };
          }
          // If completing a task, unlock the next one
          if (t.id === taskId && t.status !== "completed") {
            const idx = prev.findIndex((x) => x.id === taskId);
            if (idx >= 0 && idx < prev.length - 1) {
              return { ...t, status: "completed" as TaskStatus };
            }
            return { ...t, status: "completed" as TaskStatus };
          }
          return t;
        }),
      );
    },
    [],
  );

  // ── Unlock next task ──
  useEffect(() => {
    setTasks((prev) => {
      let foundActive = false;
      return prev.map((t) => {
        if (t.status === "active") {
          foundActive = true;
          return t;
        }
        if (t.status === "locked" && !foundActive) {
          return { ...t, status: "active" as TaskStatus };
        }
        return t;
      });
    });
  }, [completedTaskCount]);

  // ── Copy command to clipboard ──
  const copyToClipboard = useCallback(async (command: string, id: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedIndex(id);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // fallback
    }
  }, []);

  // ── Mark Day Complete ──
  const handleMarkComplete = useCallback(async () => {
    setCompleted(true);
    setShowConfetti(true);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore
    }

    await trackAction({
      type: "mission",
      tool: "program",
      query: `day-1-complete`,
      depth: 1,
      success: true,
      metadata: { day: 1, tasks: completedTaskCount },
    }).catch(() => undefined);

    await recordAction("program_day_complete", {
      target: "day-1",
      metadata: {
        title: "Completed Day 1: Foundational Reconnaissance & OPSEC Setup",
        detail: `+40 XP awarded for completing Day 1 through the validated lab flow.`,
        day: 1,
        score: Math.round((completedTaskCount / tasks.length) * 100),
        xp_earned: 40,
      },
    }).catch(() => undefined);

    // Navigate to the program overview after a brief delay
    setTimeout(() => navigate("/program"), 2500);
  }, [completedTaskCount, tasks.length, navigate, trackAction, recordAction]);

  // ── Navigate to program overview ──
  const handleViewAllDays = useCallback(() => {
    navigate("/program");
  }, [navigate]);

  // ── Get phase color for a day node ──
  const getNodeColor = useCallback((node: DayNode) => {
    return getPhaseColor(node.vectorTrack);
  }, []);

  return (
    <div className="page-shell relative min-h-screen">
      <SEOManager
        title="Day 01: Foundational Reconnaissance & OPSEC Setup | ZeroDay Guardian"
        description="Master your first day of cybersecurity training: set up an isolated research environment, harden OPSEC, and execute passive DNS reconnaissance."
        path="/program/day/1"
        keywords="cybersecurity day 1, recon, OPSEC, DNS recon, Kali Linux, Whonix, passive reconnaissance"
      />

      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute inset-0 bg-[#050508]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(52, 211, 153, 0.12) 1px, transparent 1px),
              linear-gradient(90deg, rgba(52, 211, 153, 0.12) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at 50% 30%, black 30%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 30%, black 30%, transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(52, 211, 153, 0.06) 2px, rgba(52, 211, 153, 0.06) 4px)",
            backgroundSize: "100% 4px",
          }}
        />
        <div className="absolute -top-[15%] -left-[8%] w-[45%] aspect-square rounded-full opacity-[0.08] blur-[120px]" style={{ background: "radial-gradient(circle, rgba(52,211,153,0.4), transparent 70%)" }} />
        <div className="absolute -bottom-[10%] -right-[5%] w-[35%] aspect-square rounded-full opacity-[0.05] blur-[100px]" style={{ background: "radial-gradient(circle, rgba(34,211,238,0.3), transparent 70%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.6) 100%)" }} />
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-6xl">
          {/* ── 60-Day Roadmap Timeline ── */}
          <section className="mb-8 rounded-xl border border-slate-800/40 bg-slate-900/20 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300/80">60-Day Roadmap Telemetry</span>
              </div>
              <button
                type="button"
                onClick={handleViewAllDays}
                className="inline-flex items-center gap-1 rounded-full border border-slate-700/50 px-3 py-1 font-mono text-[10px] text-slate-400 transition hover:border-cyan-500/30 hover:text-cyan-300"
              >
                View All Days
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>

            {/* Scrollable timeline */}
            <div className="overflow-x-auto pb-2 scrollbar-thin">
              <div className="flex gap-1.5 min-w-max">
                {dayNodes.map((node) => {
                  const colors = getNodeColor(node);
                  const isActive = node.status === "active";
                  const isCompleted = node.status === "completed";

                  return (
                    <div
                      key={node.day}
                      className={`relative flex flex-col items-center gap-1 px-1 py-2 rounded-lg transition-all duration-200 ${
                        isActive
                          ? "bg-emerald-500/10 border border-emerald-400/30 shadow-[0_0_12px_rgba(52,211,153,0.15)]"
                          : "opacity-40"
                      }`}
                      style={{ minWidth: "44px" }}
                    >
                      {/* Day number */}
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                          isActive
                            ? "bg-emerald-400 text-emerald-950 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                            : isCompleted
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-slate-800/60 text-slate-500"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : isActive ? (
                          <PlayCircle className="h-3.5 w-3.5" />
                        ) : (
                          node.day
                        )}
                      </div>

                      {/* Phase indicator dot */}
                      <div className={`h-1 w-1 rounded-full ${colors.dot} ${isActive ? "animate-pulse" : ""}`} />

                      {/* Day label */}
                      <span className={`font-mono text-[8px] ${isActive ? "text-emerald-300" : "text-slate-600"}`}>
                        Day {String(node.day).padStart(2, "0")}
                      </span>

                      {/* Active pulse ring */}
                      {isActive && (
                        <span className="absolute -inset-1 rounded-lg border border-emerald-400/20 animate-pulse" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Phase legend */}
            <div className="mt-3 flex flex-wrap gap-3">
              {SYLLABUS_PHASES.map((phase) => {
                const colors = getPhaseColor(phase.vectorTrack);
                return (
                  <div key={phase.id} className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
                      {phase.name} ({phase.dayRange[0]}–{phase.dayRange[1]})
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Hero Section ── */}
          <section className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1 mb-4">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-300/80">ACTIVE OPERATION</span>
            </div>

            <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl lg:text-5xl">
              DAY 01:{" "}
              <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-emerald-200 bg-clip-text text-transparent">
                Foundational Reconnaissance &amp; Operational Security (OPSEC) Setup
              </span>
            </h1>

            <p className="mt-4 max-w-3xl text-base text-slate-300/80 md:text-lg">
              No fake learning loops. No clutter. Just real operator momentum. Establish your isolated
              analysis perimeter before executing active target discovery. Every command you run here
              is a building block for Day 2 and beyond.
            </p>

            {/* Stats bar */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Phase", value: "Recon & Network Core", accent: "cyan" },
                { label: "Focus", value: "OPSEC / Passive Recon", accent: "emerald" },
                { label: "Progress", value: `${completedTaskCount}/${tasks.length} tasks`, accent: completedTaskCount === tasks.length ? "emerald" : "slate" },
                { label: "XP Reward", value: allTasksComplete ? "+40 ✓" : "40 XP", accent: allTasksComplete ? "emerald" : "amber" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-slate-800/50 bg-slate-900/30 p-3 backdrop-blur-sm"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">{stat.label}</p>
                  <p className={`mt-1 font-mono text-sm font-bold tracking-wider ${
                    stat.accent === "emerald"
                      ? "text-emerald-300"
                      : stat.accent === "cyan"
                      ? "text-cyan-300"
                      : stat.accent === "amber"
                      ? "text-amber-300"
                      : "text-slate-100"
                  }`}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Overall progress bar */}
            <div className="mt-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-slate-800/60 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${(completedTaskCount / tasks.length) * 100}%`,
                      background: `linear-gradient(90deg, rgba(52,211,153,0.8), rgba(34,211,238,0.8))`,
                      boxShadow: `0 0 8px rgba(52,211,153,0.4)`,
                    }}
                  />
                </div>
                <span className="font-mono text-xs text-slate-400 tabular-nums">
                  {Math.round((completedTaskCount / tasks.length) * 100)}%
                </span>
              </div>
            </div>

            {/* Phase connector arrows */}
            <div className="mt-6 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 font-mono text-[10px] text-emerald-300">
                <TerminalSquare className="h-3 w-3" />
                DAY 01: ACTIVE
              </span>
              <ChevronRight className="h-4 w-4 text-slate-600" />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/40 border border-slate-700/30 px-3 py-1 font-mono text-[10px] text-slate-500 opacity-50">
                <Lock className="h-3 w-3" />
                DAY 02
              </span>
              <ChevronRight className="h-4 w-4 text-slate-700" />
              <span className="rounded-full bg-slate-800/20 border border-slate-700/20 px-3 py-1 font-mono text-[10px] text-slate-600 opacity-30">
                DAY 03–60
              </span>
            </div>
          </section>

          {/* ── OPSEC Warning Banner ── */}
          <section className="mb-8 rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400/70 shrink-0" />
              <div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-amber-300/90">OPSEC Advisory</p>
                <p className="mt-1 text-sm text-slate-400">
                  All reconnaissance in this module targets <span className="font-mono text-amber-200/80">target-perimeter.com</span> —
                  a mock domain owned by ZeroDay Guardian for training purposes. Do <span className="font-semibold text-amber-200/90">not</span> execute these
                  commands against any domain you do not own or have explicit written authorization to test.
                </p>
              </div>
            </div>
          </section>

          {/* ── Task Checklist ── */}
          <section className="mb-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Operation Checklist</h2>
              <span className="font-mono text-xs text-slate-500">
                {completedTaskCount}/{tasks.length} objectives cleared
              </span>
            </div>

            {tasks.map((task, taskIndex) => {
              const isComplete = task.status === "completed";
              const isActive = task.status === "active";
              const isLocked = task.status === "locked";

              return (
                <div
                  key={task.id}
                  className={`rounded-xl border transition-all duration-300 ${
                    isActive
                      ? "border-emerald-500/30 bg-slate-900/40 shadow-[0_0_20px_rgba(52,211,153,0.06)]"
                      : isComplete
                      ? "border-emerald-700/30 bg-slate-900/20 opacity-80"
                      : "border-slate-800/30 bg-slate-900/10 opacity-50"
                  }`}
                >
                  {/* Task Header */}
                  <div className="flex items-start gap-4 p-5">
                    {/* Status toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isLocked) return;
                        toggleTask(task.id);
                      }}
                      disabled={isLocked}
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
                        isComplete
                          ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-400"
                          : isActive
                          ? "border-slate-600 hover:border-emerald-500/50 hover:bg-emerald-500/10 cursor-pointer"
                          : "border-slate-700/30 text-slate-600 cursor-not-allowed"
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : isLocked ? (
                        <Lock className="h-3 w-3" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-emerald-400/50" />
                      )}
                    </button>

                    {/* Task content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.15em] ${
                          isComplete
                            ? "text-emerald-400/70"
                            : isActive
                            ? "text-emerald-300"
                            : "text-slate-600"
                        }`}>
                          Task {String(task.number).padStart(2, "0")}
                        </span>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[8px] text-emerald-300 border border-emerald-500/20">
                            <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <h3 className={`text-base font-semibold ${isComplete ? "text-slate-400 line-through" : "text-slate-100"}`}>
                        {task.title}
                      </h3>
                      <p className={`mt-2 text-sm leading-relaxed ${isComplete ? "text-slate-500" : "text-slate-400"}`}>
                        {task.description}
                      </p>

                      {/* Steps list */}
                      {!isLocked && (
                        <ol className="mt-4 space-y-2">
                          {task.steps.map((step, stepIdx) => (
                            <li key={stepIdx} className="flex items-start gap-2 text-sm text-slate-400">
                              <span className={`mt-0.5 font-mono text-[10px] font-bold shrink-0 ${
                                isComplete ? "text-emerald-500/50" : "text-slate-600"
                              }`}>
                                {String(stepIdx + 1).padStart(2, "0")}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      )}

                      {/* Command blocks */}
                      {!isLocked && task.commandBlocks && task.commandBlocks.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {task.commandBlocks.map((block, blockIdx) => (
                            <div key={blockIdx} className="rounded-lg border border-slate-800/60 bg-[#0a0e1a] overflow-hidden">
                              <div className="flex items-center justify-between border-b border-slate-800/40 bg-slate-900/60 px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <TerminalSquare className="h-3.5 w-3.5 text-cyan-400" />
                                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-300/80">
                                    {block.label}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(block.command, `${task.id}-block-${blockIdx}`)}
                                  className="inline-flex items-center gap-1 rounded border border-slate-700/50 px-2 py-1 font-mono text-[9px] text-slate-500 transition hover:border-cyan-500/30 hover:text-cyan-300"
                                >
                                  {copiedIndex === `${task.id}-block-${blockIdx}` ? (
                                    <>Copied</>
                                  ) : (
                                    <><Copy className="h-3 w-3" /> Copy</>
                                  )}
                                </button>
                              </div>
                              <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-emerald-200/80">
                                <code>{block.command}</code>
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Data set displays */}
                      {!isLocked && task.dataSets && task.dataSets.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {task.dataSets.map((ds, dsIdx) => (
                            <div key={dsIdx} className="rounded-lg border border-slate-800/60 bg-[#0a0e1a] overflow-hidden">
                              <div className="flex items-center gap-2 border-b border-slate-800/40 bg-slate-900/60 px-3 py-2">
                                <Network className="h-3.5 w-3.5 text-amber-400" />
                                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-amber-300/80">
                                  {ds.label}
                                </span>
                              </div>
                              <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-slate-300/80">
                                <code>{ds.content}</code>
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Locked overlay */}
                      {isLocked && (
                        <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-800/30 bg-slate-900/20 px-4 py-3">
                          <Lock className="h-4 w-4 text-slate-600" />
                          <span className="text-sm text-slate-500">
                            Complete Task {String(task.number - 1).padStart(2, "0")} to unlock this objective
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          {/* ── Mark Complete CTA ── */}
          <section className="mb-16">
            <div className={`rounded-xl border p-6 text-center transition-all duration-500 ${
              completed
                ? "border-emerald-500/30 bg-emerald-500/10"
                : allTasksComplete
                ? "border-emerald-500/20 bg-emerald-500/5"
                : "border-slate-800/40 bg-slate-900/20"
            }`}>
              {completed ? (
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 border border-emerald-400/30 px-4 py-1">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="font-mono text-xs font-semibold uppercase tracking-[0.15em] text-emerald-300">
                      DAY 01 COMPLETE
                    </span>
                  </div>
                  <p className="text-lg font-semibold text-emerald-100">
                    Foundational Reconnaissance & OPSEC verified
                  </p>
                  <p className="text-sm text-slate-400">
                    Your isolated perimeter is established. Redirecting to program overview...
                  </p>
                  <div className="flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate("/program/day/2")}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 px-5 py-2.5 text-sm font-semibold transition-all hover:shadow-[0_0_20px_rgba(52,211,153,0.3)]"
                    >
                      Continue to Day 02
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : allTasksComplete ? (
                <div className="space-y-4">
                  <Shield className="mx-auto h-10 w-10 text-emerald-400" />
                  <p className="text-lg font-semibold text-slate-100">
                    All objectives cleared — ready to seal Day 01
                  </p>
                  <p className="text-sm text-slate-400 max-w-lg mx-auto">
                    Your OPSEC perimeter is verified and your passive reconnaissance data is documented.
                    Marking Day 1 complete unlocks Day 2: Digital Footprint Mapping.
                  </p>
                  <button
                    type="button"
                    onClick={handleMarkComplete}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 px-6 py-3 text-sm font-bold transition-all hover:shadow-[0_0_24px_rgba(52,211,153,0.35)] active:scale-95"
                  >
                    Mark Day 1 Complete & Advance
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-500">
                    Complete all {tasks.length} objectives to advance
                  </p>
                  <p className="text-sm text-slate-500">
                    {completedTaskCount}/{tasks.length} objectives cleared ·{" "}
                    {tasks.filter((t) => t.status === "active").length > 0
                      ? `Complete "${tasks.find((t) => t.status === "active")?.title}"`
                      : "Progress pending"}
                  </p>
                  <div className="mx-auto max-w-xs h-1.5 rounded-full bg-slate-800/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-700"
                      style={{ width: `${(completedTaskCount / tasks.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Confetti overlay */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50" aria-hidden="true">
          {Array.from({ length: 50 }, (_, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
                backgroundColor: ["#34d399", "#22d3ee", "#a78bfa", "#fbbf24", "#fb7185"][i % 5],
                animation: `confetti-fall ${1.5 + Math.random() * 2}s ease-in ${Math.random() * 1}s forwards`,
                opacity: 1,
              }}
            />
          ))}
          <style>{`
            @keyframes confetti-fall {
              0% { transform: translateY(0) rotate(0deg) scale(1); opacity: 1; }
              100% { transform: translateY(100vh) rotate(720deg) scale(0); opacity: 0; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
