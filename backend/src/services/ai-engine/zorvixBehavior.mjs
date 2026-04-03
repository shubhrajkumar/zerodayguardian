import { logInfo } from "../../utils/logger.mjs";
import { formatAssistantResponse } from "../responseFormatterV2.js";

const queryMode = (queryType = "") => {
  const normalized = String(queryType || "").toLowerCase();
  if (normalized.includes("security")) return "cybersecurity";
  if (normalized.includes("file")) return "file_analysis";
  return "general";
};

export class ZorvixBehavior {
  constructor() {
    this.personality = {
      name: "Zorvix",
      tone: "friendly",
      style: "concise",
      language: "english",
      emojis: "minimal",
      formality: "modern",
      continuity: "adaptive",
      memory: "contextual",
      repetitionControl: "strict",
    };
  }

  generateResponse(content, context = {}) {
    const mode = queryMode(context?.queryType);
    const priorSummary = String(context?.priorSummary || context?.memorySummary || "").trim();
    const refinementGoal = String(context?.refinementGoal || "").trim();
    const adaptedText = [
      priorSummary ? `Conversation context: ${priorSummary}` : "",
      refinementGoal ? `Answer focus: ${refinementGoal}` : "",
      String(content || "").trim(),
    ]
      .filter(Boolean)
      .join("\n");
    const response = formatAssistantResponse({
      text: adaptedText,
      mode,
      variantSeed: refinementGoal || priorSummary || "",
    });

    logInfo("Zorvix response generated", {
      mode,
      queryType: String(context?.queryType || "general"),
      complexity: String(context?.complexity || "normal"),
      continuity: this.personality.continuity,
    });

    return response;
  }

  generateGreeting() {
    return formatAssistantResponse({
      text:
        "ZORVIX is online. Bring me an objective, decision, incident, or lab problem and I will return the clearest next action, the main risk, and the cleanest validation path.",
      mode: "operator",
      variantSeed: "greeting",
    });
  }

  generateHelpResponse() {
    return formatAssistantResponse({
      text: [
        "ZORVIX help",
        "Next Action: Tell me whether you need analysis, a mission plan, debugging, triage, or a security debrief.",
        "Risk: If the scope is vague, the answer will stay broad and lower-value.",
        "Validation: Include the target, symptoms, evidence, or objective so I can anchor the response.",
        "- I can explain, analyze, summarize, troubleshoot, or suggest next steps.",
        "- I keep answers short, structured, practical, and context-aware.",
        "- If something is unclear, I ask one short question.",
      ].join("\n"),
      mode: "operator",
      variantSeed: "help",
    });
  }

  generateErrorResponse(errorInfo = {}) {
    const type = String(errorInfo?.type || "temporary_issue").trim().toLowerCase();
    const retryLine = type === "timeout" ? "- Retry in a moment or ask a shorter follow-up." : "- Retry in a moment.";
    const detailLine =
      type === "timeout"
        ? "- The live model took longer than expected, so Zorvix paused the reply for stability."
        : "- Zorvix hit a short-lived issue while preparing the answer.";
    return formatAssistantResponse({
      text: [
        "ZORVIX recovery mode",
        "Next Action: retry the request or narrow the objective.",
        "Validation: if the same issue repeats, inspect provider health and fallback readiness.",
        detailLine,
        retryLine,
      ]
        .filter(Boolean)
        .join("\n"),
      mode: "operator",
      variantSeed: type,
    });
  }

  updatePersonality(settings) {
    this.personality = { ...this.personality, ...settings };
    logInfo("Zorvix personality updated", this.personality);
  }

  getPersonalityStatus() {
    return {
      ...this.personality,
      availableStyles: ["concise", "balanced"],
      emojiSets: ["minimal"],
      responseMode: "deterministic_high_signal",
    };
  }
}

export const zorvixBehavior = new ZorvixBehavior();
