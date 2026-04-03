import type { AssistantAction } from "@/lib/assistantActions";

export type AssistantHintCategory = "recovery" | "momentum" | "learning" | "navigation" | "analysis" | "skill_path" | "auth";

export type SkillNodeLite = { id: string; label: string };

export type AssistantHint = {
  id: string;
  title: string;
  detail: string;
  actionLabel: string;
  tone: "neutral" | "cyan" | "rose" | "amber";
  category: AssistantHintCategory;
  action: AssistantAction;
};

type BuildAssistantHintsArgs = {
  pathname: string;
  isAuthenticated: boolean;
  mindset: "offense" | "defense";
  weakest?: SkillNodeLite;
  strongest?: SkillNodeLite;
  recommendedPath?: Array<{ skillId: string; label: string; action: string }>;
  frictionSignal: { count: number; latestMessage: string };
  inactive: boolean;
  hintAffinity: Record<string, { shown: number; acted: number }>;
};

export const buildAssistantHints = ({
  pathname,
  isAuthenticated,
  mindset,
  weakest,
  strongest,
  recommendedPath = [],
  frictionSignal,
  inactive,
  hintAffinity,
}: BuildAssistantHintsArgs) => {
  const route = pathname;
  const hints: AssistantHint[] = [];

  if (!isAuthenticated) {
    hints.push({
      id: "auth-recovery",
      title: "Unlock saved guidance",
      detail: "Sign in to keep adaptive recommendations, history, and personalized next steps in sync across the platform.",
      actionLabel: "Open sign in",
      tone: "cyan",
      category: "auth",
      action: { type: "navigate", to: "/auth" },
    });
  }

  if (route === "/dashboard") {
    hints.push({
      id: "dashboard-skill-gap",
      title: weakest ? `Close the ${weakest.label} gap` : "Build your verified signal profile",
      detail: weakest
        ? `Your weakest zone is ${weakest.label}. Run one verified scan or lookup, then use the recommended action trail to sharpen it.`
        : "Run a real OSINT or website check so the platform can start mapping strengths and weaknesses.",
      actionLabel: "Open mentor guidance",
      tone: "amber",
      category: "analysis",
      action: {
        type: "mentor",
        title: "Dashboard Guidance",
        query: weakest
          ? `Give me a short improvement plan for ${weakest.label} using verified dashboard actions only.`
          : "Help me generate my first verified dashboard signals and explain what to run first.",
      },
    });
  }

  if (route === "/learn") {
    hints.push({
      id: "learn-path-optimizer",
      title: weakest ? `Learning path tuned for ${weakest.label}` : "Adaptive learning path ready",
      detail: weakest
        ? `Your current path is reordering around ${weakest.label}. Start the top recommended track before switching topics.`
        : "The engine will tighten recommendations as soon as you complete one track or lab.",
      actionLabel: "Jump to lab",
      tone: "cyan",
      category: "learning",
      action: { type: "navigate", to: `/lab?mindset=${mindset}` },
    });
  }

  if (route === "/lab") {
    hints.push({
      id: "lab-focus",
      title: strongest ? `Use ${strongest.label} as leverage` : "Run one focused mission",
      detail: strongest
        ? `Your strongest zone is ${strongest.label}. Use it to chain into a harder ${mindset} mission, then collect one new weak-skill signal.`
        : "Finish one mission cleanly to unlock stronger adaptive mission recommendations.",
      actionLabel: "Ask Zorvix",
      tone: mindset === "offense" ? "rose" : "cyan",
      category: "learning",
      action: {
        type: "mentor",
        title: "Lab Optimization",
        query: strongest
          ? `Suggest the best next ${mindset} lab using my strongest skill ${strongest.label}, and tell me how to expand into a weaker skill next.`
          : `Recommend the best first ${mindset} lab for a new user and explain why in one short plan.`,
      },
    });
  }

  if (route === "/tools") {
    hints.push({
      id: "tools-guided",
      title: "Turn browsing into a guided workflow",
      detail: "Open a tool with Zorvix guidance when you want explanation, examples, and a practical next move instead of passive reading.",
      actionLabel: "Open guided tools",
      tone: "neutral",
      category: "navigation",
      action: { type: "navigate", to: "/tools?mode=neurobot" },
    });
  }

  if (route === "/resources") {
    hints.push({
      id: "resources-curation",
      title: "Use resources like a mission queue",
      detail: "Pick one high-trust resource, then carry the insight into Learn or Lab immediately so the platform can reinforce it.",
      actionLabel: "Open adaptive mentor",
      tone: "neutral",
      category: "analysis",
      action: {
        type: "mentor",
        title: "Resource Guidance",
        query: "Use the current resources page context to suggest the single best next learning move and one supporting lab.",
      },
    });
  }

  if (route === "/osint") {
    hints.push({
      id: "osint-verified",
      title: "Stay evidence-first",
      detail: "Use domain, DNS, MX, WHOIS, and headers as your base layer, then only escalate when the verified signals justify it.",
      actionLabel: "Open analysis help",
      tone: "amber",
      category: "analysis",
      action: {
        type: "mentor",
        title: "OSINT Guidance",
        query: "Explain how to turn verified OSINT evidence into a clean analyst summary with risk, reasons, and next actions.",
      },
    });
  }

  if (frictionSignal.count >= 2) {
    hints.unshift({
      id: "friction-recovery",
      title: "Looks like this flow hit some friction",
      detail: frictionSignal.latestMessage
        ? `Recent failures are piling up here. Latest issue: ${frictionSignal.latestMessage}. Let me help you recover with the next best move.`
        : "Recent actions are failing repeatedly. Use a guided recovery step instead of retrying blindly.",
      actionLabel: "Open recovery help",
      tone: "amber",
      category: "recovery",
      action: {
        type: "mentor",
        title: "Recovery Guidance",
        query: `I hit repeated failures on ${route}. Latest issue: ${frictionSignal.latestMessage || "unknown error"}. Give me a short recovery plan with the safest next step.`,
      },
    });
  }

  if (inactive && isAuthenticated) {
    hints.push({
      id: "inactivity-nudge",
      title: "Need a smart next step?",
      detail: weakest
        ? `You paused on ${route}. The best next move is to strengthen ${weakest.label} with one focused action.`
        : `You paused on ${route}. I can turn the current page into one clear next action so you keep momentum.`,
      actionLabel: "Resume with guidance",
      tone: "neutral",
      category: "momentum",
      action: {
        type: "mentor",
        title: "Momentum Nudge",
        query: weakest
          ? `I paused on ${route}. Suggest one short action to improve ${weakest.label} and keep momentum.`
          : `I paused on ${route}. Suggest the single best next action based on this page context.`,
      },
    });
  }

  if (recommendedPath.length) {
    const topStep = recommendedPath[0];
    hints.push({
      id: `skill-path-${topStep.skillId}`,
      title: `Next best move: ${topStep.label}`,
      detail: topStep.action,
      actionLabel: "Use recommendation",
      tone: "cyan",
      category: "skill_path",
      action: {
        type: "route_or_mentor",
        to: "/learn",
        title: "Skill Path Guide",
        query: `Turn this recommendation into a short action plan: ${topStep.action}`,
      },
    });
  }

  return hints
    .map((hint) => {
      const affinity = hintAffinity[hint.category];
      const acted = affinity?.acted || 0;
      const shown = affinity?.shown || 0;
      const engagementBoost = shown ? acted / shown : 0.15;
      const urgencyBoost =
        hint.category === "recovery"
          ? 1.2
          : hint.category === "skill_path"
            ? 0.95
            : hint.category === "momentum"
              ? 0.75
              : 0.6;
      return {
        ...hint,
        rankScore: urgencyBoost + engagementBoost,
      };
    })
    .sort((a, b) => b.rankScore - a.rankScore);
};
