import { describe, it, expect } from "vitest";

// ── Extracted logic from ProgramPage.tsx ──
// These mirror the defensive validation and fallback generation added during
// the incident response. We test them in isolation so regressions are caught.

type DayOverviewItem = {
  day: number;
  title: string;
  focus: string;
  difficulty: string;
  unlocked: boolean;
  completed: boolean;
};

type DayOverviewResponse = {
  items: DayOverviewItem[];
  recommended_day: number;
  streak_message: string;
};

/**
 * Normalizes raw API response items into typed DayOverviewItem objects.
 * Returns null for each invalid item, then filters them out.
 * This is the exact logic from ProgramPage.tsx that prevents undefined.find().
 */
function normalizeItems(rawItems: unknown[]): DayOverviewItem[] {
  return rawItems
    .map((item: unknown) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      return {
        day: Number(raw.day) || 1,
        title: String(raw.title || ""),
        focus: String(raw.focus || ""),
        difficulty: String(raw.difficulty || "Beginner"),
        unlocked: Boolean(raw.unlocked),
        completed: Boolean(raw.completed),
      };
    })
    .filter(Boolean) as DayOverviewItem[];
}

/**
 * Simulates the full payload normalization path from ProgramPage.
 * Returns null if no valid payload can be constructed.
 */
function normalizeOverviewPayload(
  expressPayload: { items?: unknown[]; recommended_day?: number; streak_message?: string } | null
): DayOverviewResponse | null {
  if (!expressPayload || !Array.isArray(expressPayload.items) || expressPayload.items.length === 0) {
    return null;
  }
  const items = normalizeItems(expressPayload.items);
  if (items.length === 0) return null;
  return {
    items,
    recommended_day: Number(expressPayload.recommended_day) || 1,
    streak_message: String(expressPayload.streak_message || ""),
  };
}

/**
 * Mirror of the local fallback function in ProgramPage.tsx.
 * Used when the backend is down and the primary API call fails.
 */
function generateFallbackOverview(): DayOverviewResponse {
  const generatedItems: DayOverviewItem[] = Array.from({ length: 60 }, (_, index) => {
    const day = index + 1;
    return {
      day,
      title: `Mission ${String(day).padStart(2, '0')}: Lab ${day}`,
      focus: day <= 20 ? "Reconnaissance" : day <= 40 ? "Web Security" : "Exploitation",
      difficulty: index < 20 ? "Beginner" : index < 40 ? "Intermediate" : "Advanced",
      unlocked: index === 0,
      completed: false,
    };
  });
  return {
    items: generatedItems,
    recommended_day: 1,
    streak_message: "Start with Mission 01 to begin your 60-day journey.",
  };
}

// ── Tests ──

describe("normalizeItems", () => {
  it("converts valid items to typed DayOverviewItem objects", () => {
    const input = [
      { day: 1, title: "Day 1", focus: "Recon", difficulty: "Beginner", unlocked: true, completed: false },
      { day: 2, title: "Day 2", focus: "Web", difficulty: "Intermediate", unlocked: false, completed: false },
    ];
    const result = normalizeItems(input);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      day: 1,
      title: "Day 1",
      focus: "Recon",
      difficulty: "Beginner",
      unlocked: true,
      completed: false,
    });
    expect(result[1].day).toBe(2);
    expect(result[1].unlocked).toBe(false);
  });

  it("handles null items in the array by filtering them out", () => {
    const input = [null, { day: 1, title: "Valid" }, null];
    const result = normalizeItems(input);
    expect(result).toHaveLength(1);
    expect(result[0].day).toBe(1);
    expect(result[0].title).toBe("Valid");
  });

  it("handles undefined items in the array by filtering them out", () => {
    const input = [undefined, { day: 1, title: "Valid" }, undefined];
    const result = normalizeItems(input as unknown[]);
    expect(result).toHaveLength(1);
    expect(result[0].day).toBe(1);
  });

  it("handles string items by filtering them out (not objects)", () => {
    const input = ["not an object", { day: 1, title: "Valid" }, 42];
    const result = normalizeItems(input as unknown[]);
    expect(result).toHaveLength(1);
    expect(result[0].day).toBe(1);
  });

  it("returns defaults for missing fields on valid objects", () => {
    const input = [{ day: 5 }];
    const result = normalizeItems(input);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      day: 5,
      title: "",
      focus: "",
      difficulty: "Beginner",
      unlocked: false,
      completed: false,
    });
  });

  it("coerces string day to number", () => {
    const input = [{ day: "3", title: "Test" }];
    const result = normalizeItems(input as unknown[]);
    expect(result[0].day).toBe(3);
  });

  it("falls back to day=1 when day is NaN or missing", () => {
    const input = [{ day: "not-a-number", title: "Test" }];
    const result = normalizeItems(input as unknown[]);
    expect(result[0].day).toBe(1);
  });

  it("handles empty array without crashing", () => {
    const result = normalizeItems([]);
    expect(result).toEqual([]);
  });

  it("handles array of all invalid items", () => {
    const input = [null, undefined, "string", 42, true, { notADay: true }];
    const result = normalizeItems(input as unknown[]);
    expect(result).toHaveLength(1);
    expect(result[0].day).toBe(1);
  });

  it("preserves completed and unlocked boolean values", () => {
    const input = [
      { day: 1, completed: true, unlocked: true },
      { day: 2, completed: false, unlocked: false },
      { day: 3, completed: 1, unlocked: 0 },
    ];
    const result = normalizeItems(input);
    expect(result[0].completed).toBe(true);
    expect(result[0].unlocked).toBe(true);
    expect(result[1].completed).toBe(false);
    expect(result[1].unlocked).toBe(false);
    expect(result[2].completed).toBe(true); // 1 is truthy
    expect(result[2].unlocked).toBe(false); // 0 is falsy
  });
});

describe("normalizeOverviewPayload", () => {
  it("returns null for null input", () => {
    expect(normalizeOverviewPayload(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(normalizeOverviewPayload(undefined as unknown as null)).toBeNull();
  });

  it("returns null when items is not an array", () => {
    expect(normalizeOverviewPayload({ items: "not an array" } as unknown as { items: unknown[] })).toBeNull();
  });

  it("returns null when items is an empty array", () => {
    expect(normalizeOverviewPayload({ items: [] })).toBeNull();
  });

  it("returns null when all items are invalid (filtered to empty)", () => {
    expect(normalizeOverviewPayload({ items: [null, undefined, "string"] })).toBeNull();
  });

  it("returns valid payload for good data", () => {
    const result = normalizeOverviewPayload({
      items: [{ day: 1, title: "Day 1", focus: "Recon", unlocked: true, completed: false }],
      recommended_day: 1,
      streak_message: "Keep going!",
    });
    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(1);
    expect(result!.recommended_day).toBe(1);
    expect(result!.streak_message).toBe("Keep going!");
  });

  it("defaults recommended_day to 1 when missing", () => {
    const result = normalizeOverviewPayload({
      items: [{ day: 1, title: "Day 1" }],
    });
    expect(result!.recommended_day).toBe(1);
  });

  it("defaults streak_message to empty string when missing", () => {
    const result = normalizeOverviewPayload({
      items: [{ day: 1, title: "Day 1" }],
    });
    expect(result!.streak_message).toBe("");
  });

  it("handles mixed valid and invalid items by keeping only valid ones", () => {
    const result = normalizeOverviewPayload({
      items: [
        null,
        { day: 1, title: "Day 1" },
        undefined,
        { day: 2, title: "Day 2" },
        "garbage",
      ],
      recommended_day: 1,
    });
    expect(result!.items).toHaveLength(2);
    expect(result!.items[0].day).toBe(1);
    expect(result!.items[1].day).toBe(2);
  });

  it("does NOT crash when called with the exact shape from the undefined.find() incident", () => {
    const malformedPayload = {
      items: [{ id: "1", name: "Lab 1" }],
      total: 1,
      categories: [{ name: "Web", count: 1 }],
    };
    const result = normalizeOverviewPayload(malformedPayload);
    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(1);
    expect(result!.items[0].day).toBe(1);
    expect(result!.items[0].title).toBe("");
    expect(result!.items[0].difficulty).toBe("Beginner");
  });
});

describe("generateFallbackOverview", () => {
  it("generates exactly 60 items", () => {
    const result = generateFallbackOverview();
    expect(result.items).toHaveLength(60);
  });

  it("sets recommended_day to 1", () => {
    const result = generateFallbackOverview();
    expect(result.recommended_day).toBe(1);
  });

  it("has a non-empty streak_message mentioning Mission 01", () => {
    const result = generateFallbackOverview();
    expect(result.streak_message.length).toBeGreaterThan(0);
    expect(result.streak_message).toContain("Mission 01");
  });

  it("day numbers are sequential starting from 1", () => {
    const result = generateFallbackOverview();
    result.items.forEach((item, index) => {
      expect(item.day).toBe(index + 1);
    });
  });

  it("day 1 is unlocked, all others are locked", () => {
    const result = generateFallbackOverview();
    expect(result.items[0].unlocked).toBe(true);
    result.items.slice(1).forEach((item) => {
      expect(item.unlocked).toBe(false);
    });
  });

  it("all items have completed=false", () => {
    const result = generateFallbackOverview();
    result.items.forEach((item) => {
      expect(item.completed).toBe(false);
    });
  });

  it("days 1-20 are Beginner difficulty", () => {
    const result = generateFallbackOverview();
    result.items.slice(0, 20).forEach((item) => {
      expect(item.difficulty).toBe("Beginner");
    });
  });

  it("days 21-40 are Intermediate difficulty", () => {
    const result = generateFallbackOverview();
    result.items.slice(20, 40).forEach((item) => {
      expect(item.difficulty).toBe("Intermediate");
    });
  });

  it("days 41-60 are Advanced difficulty", () => {
    const result = generateFallbackOverview();
    result.items.slice(40, 60).forEach((item) => {
      expect(item.difficulty).toBe("Advanced");
    });
  });

  it("every item has a title matching Mission NN pattern", () => {
    const result = generateFallbackOverview();
    result.items.forEach((item) => {
      expect(item.title).toContain(`Mission ${String(item.day).padStart(2, '0')}:`);
    });
  });

  it("returns a new object on each call (no shared references)", () => {
    const a = generateFallbackOverview();
    const b = generateFallbackOverview();
    expect(a).not.toBe(b);
    expect(a.items).not.toBe(b.items);
    a.items[0].completed = true;
    expect(b.items[0].completed).toBe(false);
  });

  it("produces items that work with safeArray + find() without crashing", () => {
    const result = generateFallbackOverview();
    const items = Array.isArray(result.items) ? result.items : [];
    const day1 = items.find((item) => item.day === 1);
    expect(day1).toBeDefined();
    expect(day1!.unlocked).toBe(true);
    const day60 = items.find((item) => item.day === 60);
    expect(day60).toBeDefined();
    expect(day60!.difficulty).toBe("Advanced");
  });

  it("produces items that survive normalizeOverviewPayload validation", () => {
    const result = generateFallbackOverview();
    const items = normalizeItems(result.items);
    expect(items).toHaveLength(60);
    expect(items[0].day).toBe(1);
    expect(items[59].day).toBe(60);
  });
});

describe("safeArray integration (simulating ProgramPage useMemo)", () => {
  function safeArray<T>(data: unknown): T[] {
    if (Array.isArray(data)) return data as T[];
    return [];
  }

  it("safeArray returns [] for null overview", () => {
    const overview = null;
    const items = safeArray(overview?.items);
    expect(items).toEqual([]);
    const selected = items.find((item: any) => item.day === 1) || items[0] || null;
    expect(selected).toBeNull();
  });

  it("safeArray returns [] for undefined items", () => {
    const overview = { items: undefined };
    const items = safeArray(overview?.items);
    expect(items).toEqual([]);
    const selected = items.find((item: any) => item.day === 1) || items[0] || null;
    expect(selected).toBeNull();
  });

  it("safeArray returns [] for non-array items", () => {
    const overview = { items: "not an array" };
    const items = safeArray(overview?.items);
    expect(items).toEqual([]);
  });

  it("safeArray preserves valid array", () => {
    const overview = { items: [{ day: 1 }, { day: 2 }] };
    const items = safeArray(overview?.items);
    expect(items).toHaveLength(2);
    const selected = items.find((item: any) => item.day === 2);
    expect(selected).toEqual({ day: 2 });
  });

  it("items.find() does not crash on empty array from safeArray", () => {
    const items = safeArray(undefined);
    expect(() => items.find((item: any) => item.day === 1)).not.toThrow();
    expect(items.find((item: any) => item.day === 1)).toBeUndefined();
  });
});
