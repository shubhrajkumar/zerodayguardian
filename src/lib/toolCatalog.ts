import {
  BookOpenText,
  BrainCircuit,
  Code2,
  FlaskConical,
  Globe2,
  GraduationCap,
  MonitorCog,
  Radar,
  SearchCode,
  ServerCog,
  Shield,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { apiGetJson } from "@/lib/apiClient";

export type ToolDefinition = {
  id: number;
  name: string;
  category: string;
  group: string;
  icon: string;
  rating: number;
  featured: boolean;
  workspace: string;
  description: string;
  detail: string;
  tags?: string[];
  capabilities?: string[];
  prompt?: string;
};

export const TOOL_FILTERS = [
  "All Tools",
  "AI Tools",
  "Security Tools",
  "Research Tools",
  "Learning Tools",
] as const;

export type ToolFilter = (typeof TOOL_FILTERS)[number];

export const TOOL_GROUP_ORDER = [
  "AI Command",
  "Security Analysis",
  "Research & OSINT",
  "Learning & Lab",
] as const;

export const TOOL_GROUP_META: Record<
  (typeof TOOL_GROUP_ORDER)[number],
  { eyebrow: string; description: string }
> = {
  "AI Command": {
    eyebrow: "AI Tools",
    description: "Prompt builders, code guidance, and knowledge systems for faster security reasoning.",
  },
  "Security Analysis": {
    eyebrow: "Cybersecurity Tools",
    description: "Focused workflows for vulnerability review, endpoint triage, and server hardening decisions.",
  },
  "Research & OSINT": {
    eyebrow: "Research & OSINT Tools",
    description: "Investigation workspaces for domains, search intelligence, and open-source evidence gathering.",
  },
  "Learning & Lab": {
    eyebrow: "Learning & Lab Tools",
    description: "Guided learning flows and practice environments for hands-on cybersecurity skill building.",
  },
};

const iconMap: Record<string, LucideIcon> = {
  "book-open-text": BookOpenText,
  "brain-circuit": BrainCircuit,
  "code-2": Code2,
  "flask-conical": FlaskConical,
  "globe-2": Globe2,
  "graduation-cap": GraduationCap,
  "monitor-cog": MonitorCog,
  radar: Radar,
  "search-code": SearchCode,
  "server-cog": ServerCog,
  shield: Shield,
  "shield-alert": ShieldAlert,
};

export const getToolIcon = (icon = ""): LucideIcon => iconMap[String(icon || "").toLowerCase()] || Shield;

export const toolMatchesFilter = (tool: ToolDefinition, filter: ToolFilter) => {
  if (filter === "All Tools") return true;
  if (filter === "Security Tools") return tool.category === "Cybersecurity Tools";
  if (filter === "Research Tools") return tool.category === "Research & OSINT Tools";
  if (filter === "Learning Tools") return tool.category === "Learning & Lab Tools";
  return tool.category === filter;
};

export const toolSearchIndex = (tool: ToolDefinition) =>
  [
    tool.name,
    tool.category,
    tool.group,
    tool.description,
    tool.detail,
    ...(tool.tags || []),
    ...(tool.capabilities || []),
  ]
    .join(" ")
    .toLowerCase();

export const getToolById = (tools: ToolDefinition[], id: number) => tools.find((tool) => tool.id === id);

export const relatedToolsFor = (tools: ToolDefinition[], tool: ToolDefinition, limit = 3) =>
  tools.filter((item) => item.id !== tool.id && item.category === tool.category).slice(0, limit);

export const getToolsCatalog = async () => {
  const payload = await apiGetJson<{ tools?: ToolDefinition[] }>("/api/intelligence/tools/catalog");
  return Array.isArray(payload.tools) ? payload.tools : [];
};
