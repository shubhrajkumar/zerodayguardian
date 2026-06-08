import { describe, it, expect } from "vitest";
import {
  parseTelemetryFromResponse,
  stripTelemetryBlock,
  vectorTrackLabel,
} from "@/lib/telemetryTypes";

// ── parseTelemetryFromResponse ──────────────────────────────────────────
describe("parseTelemetryFromResponse", () => {
  const validJson = `
\`\`\`json
{
  "telemetry": {
    "roadmapDay": 5,
    "difficulty": "3_STARS",
    "vectorTrack": "RECON",
    "sessionXpReward": 20,
    "zorvixThemeHex": "#00F0FF"
  }
}
\`\`\`
`;

  it("parses a valid telemetry block from a full response", () => {
    const result = parseTelemetryFromResponse(validJson);
    expect(result).toEqual({
      roadmapDay: 5,
      difficulty: "3_STARS",
      vectorTrack: "RECON",
      sessionXpReward: 20,
      zorvixThemeHex: "#00F0FF",
    });
  });

  it("parses telemetry when roadmapDay is null", () => {
    const text = `
\`\`\`json
{
  "telemetry": {
    "roadmapDay": null,
    "difficulty": "1_STARS",
    "vectorTrack": "APPSEC",
    "sessionXpReward": 0,
    "zorvixThemeHex": "#A124FF"
  }
}
\`\`\`
`;
    const result = parseTelemetryFromResponse(text);
    expect(result).toEqual({
      roadmapDay: null,
      difficulty: "1_STARS",
      vectorTrack: "APPSEC",
      sessionXpReward: 0,
      zorvixThemeHex: "#A124FF",
    });
  });

  it("parses the first JSON block when multiple code blocks exist", () => {
    const text = `
\`\`\`json
{
  "telemetry": {
    "roadmapDay": 12,
    "difficulty": "4_STARS",
    "vectorTrack": "BINARY_PWN",
    "sessionXpReward": 50,
    "zorvixThemeHex": "#A124FF"
  }
}
\`\`\`

Here is some analysis text.

\`\`\`python
print("not telemetry")
\`\`\`
`;
    const result = parseTelemetryFromResponse(text);
    expect(result).not.toBeNull();
    expect(result!.vectorTrack).toBe("BINARY_PWN");
  });

  it("returns null for empty string", () => {
    expect(parseTelemetryFromResponse("")).toBeNull();
  });

  it("returns null when no code block is present", () => {
    expect(parseTelemetryFromResponse("Just some plain text response")).toBeNull();
  });

  it("returns null when code block is not json", () => {
    const text = `
\`\`\`python
{"telemetry": {"roadmapDay": 1}}
\`\`\`
`;
    expect(parseTelemetryFromResponse(text)).toBeNull();
  });

  it("returns null when JSON has no telemetry key", () => {
    const text = `
\`\`\`json
{
  "answer": "some text",
  "score": 100
}
\`\`\`
`;
    expect(parseTelemetryFromResponse(text)).toBeNull();
  });

  it("returns null when telemetry is not an object", () => {
    const text = `
\`\`\`json
{
  "telemetry": "not-an-object"
}
\`\`\`
`;
    expect(parseTelemetryFromResponse(text)).toBeNull();
  });

  it("returns null when vectorTrack is invalid", () => {
    const text = `
\`\`\`json
{
  "telemetry": {
    "roadmapDay": 1,
    "difficulty": "2_STARS",
    "vectorTrack": "INVALID_TRACK",
    "sessionXpReward": 10,
    "zorvixThemeHex": "#00F0FF"
  }
}
\`\`\`
`;
    expect(parseTelemetryFromResponse(text)).toBeNull();
  });

  it("returns null when difficulty is missing", () => {
    const text = `
\`\`\`json
{
  "telemetry": {
    "roadmapDay": 1,
    "vectorTrack": "RECON",
    "sessionXpReward": 10,
    "zorvixThemeHex": "#00F0FF"
  }
}
\`\`\`
`;
    expect(parseTelemetryFromResponse(text)).toBeNull();
  });

  it("returns null when sessionXpReward is not a number", () => {
    const text = `
\`\`\`json
{
  "telemetry": {
    "roadmapDay": 1,
    "difficulty": "1_STARS",
    "vectorTrack": "RECON",
    "sessionXpReward": "ten",
    "zorvixThemeHex": "#00F0FF"
  }
}
\`\`\`
`;
    expect(parseTelemetryFromResponse(text)).toBeNull();
  });

  it("returns null when zorvixThemeHex is invalid", () => {
    const text = `
\`\`\`json
{
  "telemetry": {
    "roadmapDay": 1,
    "difficulty": "1_STARS",
    "vectorTrack": "RECON",
    "sessionXpReward": 10,
    "zorvixThemeHex": "#FF0000"
  }
}
\`\`\`
`;
    expect(parseTelemetryFromResponse(text)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    const text = `
\`\`\`json
{
  "telemetry": {
    "roadmapDay": 1,
    "difficulty": "1_STARS",
    // missing closing brace
`;
    expect(parseTelemetryFromResponse(text)).toBeNull();
  });

  it("accepts all valid vectorTrack values", () => {
    const tracks = ["RECON", "APPSEC", "BINARY_PWN", "REV_ENG"] as const;
    for (const track of tracks) {
      const text = `
\`\`\`json
{
  "telemetry": {
    "roadmapDay": 1,
    "difficulty": "1_STARS",
    "vectorTrack": "${track}",
    "sessionXpReward": 0,
    "zorvixThemeHex": "#00F0FF"
  }
}
\`\`\`
`;
      const result = parseTelemetryFromResponse(text);
      expect(result).not.toBeNull();
      expect(result!.vectorTrack).toBe(track);
    }
  });

  it("accepts both valid theme hexes", () => {
    for (const hex of ["#00F0FF", "#A124FF"]) {
      const text = `
\`\`\`json
{
  "telemetry": {
    "roadmapDay": 1,
    "difficulty": "1_STARS",
    "vectorTrack": "RECON",
    "sessionXpReward": 0,
    "zorvixThemeHex": "${hex}"
  }
}
\`\`\`
`;
      const result = parseTelemetryFromResponse(text);
      expect(result).not.toBeNull();
      expect(result!.zorvixThemeHex).toBe(hex);
    }
  });

  it("defaults roadmapDay to null when it is a string", () => {
    const text = `
\`\`\`json
{
  "telemetry": {
    "roadmapDay": "not-a-number",
    "difficulty": "2_STARS",
    "vectorTrack": "APPSEC",
    "sessionXpReward": 5,
    "zorvixThemeHex": "#00F0FF"
  }
}
\`\`\`
`;
    const result = parseTelemetryFromResponse(text);
    expect(result).not.toBeNull();
    expect(result!.roadmapDay).toBeNull();
  });
});

// ── stripTelemetryBlock ────────────────────────────────────────────────
describe("stripTelemetryBlock", () => {
  it("strips the first JSON code block and returns the rest", () => {
    const text = `
\`\`\`json
{"telemetry": {"roadmapDay": 1, "difficulty": "1_STARS", "vectorTrack": "RECON", "sessionXpReward": 10, "zorvixThemeHex": "#00F0FF"}}
\`\`\`

## Analysis

This is the analysis block.
`;
    const result = stripTelemetryBlock(text);
    expect(result).not.toContain("```json");
    expect(result).toContain("## Analysis");
    expect(result).toContain("This is the analysis block.");
  });

  it("returns empty string when input is only the telemetry block", () => {
    const text = `
\`\`\`json
{"telemetry": {"roadmapDay": 1}}
\`\`\`
`;
    const result = stripTelemetryBlock(text);
    expect(result).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(stripTelemetryBlock("")).toBe("");
  });

  it("returns the text unchanged when no code block exists", () => {
    const text = "Just a plain text response with no JSON.";
    expect(stripTelemetryBlock(text)).toBe(text);
  });

  it("only strips the first JSON code block, not subsequent ones", () => {
    const text = `
\`\`\`json
{"telemetry": {"roadmapDay": 3}}
\`\`\`

Some analysis.

\`\`\`json
{"other": "data"}
\`\`\`
`;
    const result = stripTelemetryBlock(text);
    expect(result).toContain('"other": "data"');
    expect(result).not.toContain("telemetry");
  });

  it("strips telemetry block that appears mid-response", () => {
    const text = `Before text

\`\`\`json
{"telemetry": {"roadmapDay": 7, "difficulty": "3_STARS", "vectorTrack": "BINARY_PWN", "sessionXpReward": 30, "zorvixThemeHex": "#A124FF"}}
\`\`\`

After text`;
    const result = stripTelemetryBlock(text);
    expect(result).toContain("Before text");
    expect(result).toContain("After text");
    expect(result).not.toContain("telemetry");
  });

  it("strips the entire code block including fences", () => {
    const text = "Text before\n\n```json\n{\"telemetry\": {\"roadmapDay\": 1}}\n```\n\nText after";
    const result = stripTelemetryBlock(text);
    expect(result).not.toContain("```");
    expect(result).toContain("Text before");
    expect(result).toContain("Text after");
  });

  it("handles text with no telemetry but has other code blocks", () => {
    const text = `
\`\`\`python
print("hello")
\`\`\`

Some text.
`;
    const result = stripTelemetryBlock(text);
    // Should strip the first json code block — but there isn't one with ```json
    // The regex only matches ```json, not ```python
    expect(result).toContain("```python");
    expect(result).toContain("Some text.");
  });

  it("does not strip non-json code blocks", () => {
    const text = `
\`\`\`bash
nmap -sV target
\`\`\`

Some analysis.
`;
    const result = stripTelemetryBlock(text);
    expect(result).toContain("```bash");
  });
});

// ── vectorTrackLabel ───────────────────────────────────────────────────
describe("vectorTrackLabel", () => {
  it("returns correct label for RECON", () => {
    expect(vectorTrackLabel("RECON")).toBe("Recon & Network");
  });

  it("returns correct label for APPSEC", () => {
    expect(vectorTrackLabel("APPSEC")).toBe("Web & AppSec");
  });

  it("returns correct label for BINARY_PWN", () => {
    expect(vectorTrackLabel("BINARY_PWN")).toBe("Binary Pwn");
  });

  it("returns correct label for REV_ENG", () => {
    expect(vectorTrackLabel("REV_ENG")).toBe("Reverse Engineering");
  });
});
