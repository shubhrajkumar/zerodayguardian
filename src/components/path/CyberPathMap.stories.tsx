import type { Meta, StoryObj } from "@storybook/react";
import CyberPathMap, { type PathNode } from "./CyberPathMap";
import { action } from "@storybook/addon-actions";

const sampleNodes: PathNode[] = [
  { day: 1, title: "Recon Fundamentals", topic: "Passive reconnaissance, OSINT basics, DNS enumeration", difficulty: "beginner", status: "completed" },
  { day: 2, title: "Network Mapping", topic: "Nmap scanning, port discovery, service fingerprinting", difficulty: "beginner", status: "completed" },
  { day: 3, title: "Protocol Analysis", topic: "HTTP, TCP/IP, packet inspection with Wireshark", difficulty: "beginner", status: "active" },
  { day: 4, title: "Web Enumeration", topic: "Directory busting, subdomain discovery, tech stack detection", difficulty: "beginner", status: "unlocked" },
  { day: 5, title: "Authentication Attacks", topic: "Password spraying, brute force, session hijacking", difficulty: "intermediate", status: "locked" },
  { day: 6, title: "SQL Injection", topic: "Blind & error-based SQLi, parameter tampering", difficulty: "intermediate", status: "locked" },
  { day: 7, title: "XSS & CSRF", topic: "Cross-site scripting, request forgery, cookie security", difficulty: "intermediate", status: "locked" },
  { day: 8, title: "File Inclusion", topic: "LFI/RFI, path traversal, file upload bypass", difficulty: "advanced", status: "locked" },
  { day: 9, title: "Binary Exploitation", topic: "Buffer overflow, ROP chains, shellcode basics", difficulty: "advanced", status: "locked" },
  { day: 10, title: "Post-Exploitation", topic: "Privilege escalation, persistence, lateral movement", difficulty: "advanced", status: "locked" },
  { day: 11, title: "Log Analysis & SIEM", topic: "Splunk queries, log correlation, alert triage", difficulty: "intermediate", status: "locked" },
  { day: 12, title: "Incident Response", topic: "Containment, eradication, recovery, lessons learned", difficulty: "advanced", status: "locked" },
];

const meta: Meta<typeof CyberPathMap> = {
  title: "Path/CyberPathMap",
  component: CyberPathMap,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="dark" style={{ background: "#0a0a0f", padding: "2rem", minHeight: 500 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CyberPathMap>;

/**
 * 12-day path with mixed statuses: completed, active, unlocked, and locked nodes.
 * SVG zigzag path draws on scroll via IntersectionObserver.
 */
export const Default: Story = {
  args: {
    nodes: sampleNodes,
    onNodeClick: action("node-click"),
  },
};

/**
 * First 3 nodes only — all completed. Good for previewing the "done" state.
 */
export const FirstThreeCompleted: Story = {
  args: {
    nodes: sampleNodes.slice(0, 3).map((n) => ({ ...n, status: "completed" as const })),
    onNodeClick: action("node-click"),
  },
};

/**
 * All nodes locked except the first one — fresh start.
 */
export const FreshStart: Story = {
  args: {
    nodes: sampleNodes.slice(0, 6).map((n, i) => ({
      ...n,
      status: (i === 0 ? "active" : "locked") as PathNode["status"],
    })),
    onNodeClick: action("node-click"),
  },
};

/**
 * All completed — every node shows green checkmark.
 */
export const AllCompleted: Story = {
  args: {
    nodes: sampleNodes.slice(0, 6).map((n) => ({ ...n, status: "completed" as const })),
    onNodeClick: action("node-click"),
  },
};

/**
 * Single column layout for mobile-like view.
 */
export const SingleColumn: Story = {
  args: {
    nodes: sampleNodes.slice(0, 4),
    columns: 1,
    onNodeClick: action("node-click"),
  },
};

/**
 * 4-column grid layout for wide screens.
 */
export const WideGrid: Story = {
  args: {
    nodes: sampleNodes,
    columns: 4,
    onNodeClick: action("node-click"),
  },
};
