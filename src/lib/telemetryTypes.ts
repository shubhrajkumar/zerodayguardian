/**
 * Runtime Telemetry — BLOCK 1 of the 4-Tier Full Solution Engine
 * ──────────────────────────────────────────────────────────────
 * Parsed from LLM responses when the system prompt includes
 * the ENGINE FREEBUFF_MASTER_V5 executive context block.
 */

export type VectorTrack = "RECON" | "APPSEC" | "BINARY_PWN" | "REV_ENG";

export interface RuntimeTelemetry {
  roadmapDay: number | null;
  difficulty: string;
  vectorTrack: VectorTrack;
  sessionXpReward: number;
  zorvixThemeHex: string;
}

/**
 * The full BLOCK 1 JSON shape emitted by the LLM.
 * The actual LLM output wraps telemetry inside a `telemetry` key.
 */
export interface TelemetryBlock {
  telemetry: RuntimeTelemetry;
}

const VECTOR_TRACKS: Set<string> = new Set(["RECON", "APPSEC", "BINARY_PWN", "REV_ENG"]);
const VALID_THEME_HEXES: Set<string> = new Set(["#00F0FF", "#A124FF"]);

/**
 * Attempt to extract a BLOCK 1 telemetry object from raw assistant text.
 * Looks for a ```json ... ``` code block near the start of the response
 * that contains a `telemetry` key.
 */
export const parseTelemetryFromResponse = (text: string): RuntimeTelemetry | null => {
  if (!text) return null;

  // Look for the first JSON code block in the response
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (!codeBlockMatch) return null;

  try {
    const parsed = JSON.parse(codeBlockMatch[1].trim());
    const telemetry = parsed?.telemetry;
    if (!telemetry || typeof telemetry !== "object") return null;

    // Validate required fields
    if (typeof telemetry.vectorTrack !== "string" || !VECTOR_TRACKS.has(telemetry.vectorTrack)) {
      return null;
    }
    if (typeof telemetry.difficulty !== "string") return null;
    if (typeof telemetry.sessionXpReward !== "number") return null;
    if (typeof telemetry.zorvixThemeHex !== "string" || !VALID_THEME_HEXES.has(telemetry.zorvixThemeHex)) {
      return null;
    }

    return {
      roadmapDay: typeof telemetry.roadmapDay === "number" ? telemetry.roadmapDay : null,
      difficulty: telemetry.difficulty,
      vectorTrack: telemetry.vectorTrack as VectorTrack,
      sessionXpReward: telemetry.sessionXpReward,
      zorvixThemeHex: telemetry.zorvixThemeHex,
    };
  } catch {
    return null;
  }
};

/**
 * Strip the BLOCK 1 telemetry JSON block from the visible response text
 * so the user sees only the analysis, evidence, and next-action blocks.
 * Uses a simple match for the entire first ```json ... ``` code block.
 */
export const stripTelemetryBlock = (text: string): string => {
  if (!text) return text;
  return text.replace(/```json[\s\S]*?```/, "").trimStart();
};

/** Map a VectorTrack to a human-readable label */
export const vectorTrackLabel = (track: VectorTrack): string => {
  switch (track) {
    case "RECON":
      return "Recon & Network";
    case "APPSEC":
      return "Web & AppSec";
    case "BINARY_PWN":
      return "Binary Pwn";
    case "REV_ENG":
      return "Reverse Engineering";
    default:
      return track;
  }
};
