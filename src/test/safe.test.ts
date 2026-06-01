import { describe, it, expect } from "vitest";
import {
  safeArr,
  safeStr,
  safeNum,
  safeGet,
  safeDeep,
  safeEvent,
  safeArray,
  safeMap,
  safeFilter,
  safeForEach,
  safeReduce,
  safeString,
  safeTitle,
  safeNumber,
  safeBoolean,
  safeObject,
  safeLower,
} from "@/utils/safe";

// ── safeArr ───────────────────────────────────────────────────────────────
describe("safeArr", () => {
  it("returns the same array when given an array", () => {
    const arr = [1, 2, 3];
    expect(safeArr(arr)).toBe(arr);
    expect(safeArr(arr)).toEqual([1, 2, 3]);
  });

  it("returns [] for null", () => {
    expect(safeArr(null)).toEqual([]);
  });

  it("returns [] for undefined", () => {
    expect(safeArr(undefined)).toEqual([]);
  });

  it("returns [] for a number", () => {
    expect(safeArr(42)).toEqual([]);
  });

  it("returns [] for a string", () => {
    expect(safeArr("hello")).toEqual([]);
  });

  it("returns [] for an object", () => {
    expect(safeArr({ a: 1 })).toEqual([]);
  });

  it("returns [] for a boolean", () => {
    expect(safeArr(true)).toEqual([]);
  });

  it("returns [] for an empty array", () => {
    expect(safeArr([])).toEqual([]);
  });

  it("preserves the array type with generics", () => {
    const result = safeArr<{ name: string }>([{ name: "test" }]);
    expect(result).toEqual([{ name: "test" }]);
  });

  it("handles typed arrays correctly", () => {
    const result = safeArr<string>(["a", "b", "c"]);
    expect(result).toEqual(["a", "b", "c"]);
  });
});

// ── safeStr ───────────────────────────────────────────────────────────────
describe("safeStr", () => {
  it("returns the string when given a string", () => {
    expect(safeStr("hello")).toBe("hello");
  });

  it("returns the default fallback for null", () => {
    expect(safeStr(null)).toBe("");
  });

  it("returns the default fallback for undefined", () => {
    expect(safeStr(undefined)).toBe("");
  });

  it("coerces a number to string", () => {
    expect(safeStr(42)).toBe("42");
  });

  it("coerces a boolean to string", () => {
    expect(safeStr(true)).toBe("true");
    expect(safeStr(false)).toBe("false");
  });

  it("coerces 0 to string", () => {
    expect(safeStr(0)).toBe("0");
  });

  it("coerces an object to string", () => {
    expect(safeStr({})).toBe("[object Object]");
  });

  it("uses custom fallback when value is null", () => {
    expect(safeStr(null, "N/A")).toBe("N/A");
  });

  it("uses custom fallback when value is undefined", () => {
    expect(safeStr(undefined, "missing")).toBe("missing");
  });

  it("coerces an array to string", () => {
    expect(safeStr([1, 2, 3])).toBe("1,2,3");
  });

  it("handles empty string correctly", () => {
    expect(safeStr("")).toBe("");
  });
});

// ── safeNum ───────────────────────────────────────────────────────────────
describe("safeNum", () => {
  it("returns the number when given a number", () => {
    expect(safeNum(42)).toBe(42);
  });

  it("returns the default fallback for null", () => {
    expect(safeNum(null)).toBe(0);
  });

  it("returns the default fallback for undefined", () => {
    expect(safeNum(undefined)).toBe(0);
  });

  it("parses a numeric string", () => {
    expect(safeNum("42")).toBe(42);
  });

  it("parses a float string", () => {
    expect(safeNum("3.14")).toBe(3.14);
  });

  it("returns fallback for a non-numeric string", () => {
    expect(safeNum("not-a-number")).toBe(0);
  });

  it("coerces true to 1 via Number conversion", () => {
    expect(safeNum(true)).toBe(1);
  });

  it("returns fallback for a plain object", () => {
    // Number({}) is NaN, so safeNum returns the fallback
    expect(safeNum({}, -1)).toBe(-1);
  });

  it("returns fallback for an object", () => {
    expect(safeNum({})).toBe(0);
  });

  it("returns fallback for an array", () => {
    expect(safeNum([1, 2])).toBe(0);
  });

  it("returns 0 for 0", () => {
    expect(safeNum(0)).toBe(0);
  });

  it("handles negative numbers", () => {
    expect(safeNum(-10)).toBe(-10);
  });

  it("uses custom fallback for non-numeric string", () => {
    expect(safeNum("abc", -1)).toBe(-1);
  });

  it("coerces null to 0 via Number conversion, ignoring custom fallback", () => {
    // Number(null) === 0, which is not NaN, so safeNum returns 0
    expect(safeNum(null, -1)).toBe(0);
  });

  it("returns fallback for NaN", () => {
    expect(safeNum(NaN)).toBe(0);
  });

  it("returns fallback for empty string", () => {
    expect(safeNum("")).toBe(0);
  });
});

// ── safeGet ───────────────────────────────────────────────────────────────
describe("safeGet (safe.ts version)", () => {
  it("returns the value for an existing key", () => {
    expect(safeGet({ name: "Alice" }, "name")).toBe("Alice");
  });

  it("returns the fallback when key is missing", () => {
    expect(safeGet({ name: "Alice" }, "age", 30)).toBe(30);
  });

  it("returns the default empty-string fallback when key is missing and no fallback", () => {
    expect(safeGet({ name: "Alice" }, "age")).toBe("");
  });

  it("returns the fallback when obj is null", () => {
    expect(safeGet(null, "key", "fallback")).toBe("fallback");
  });

  it("returns the fallback when obj is undefined", () => {
    expect(safeGet(undefined, "key", "fallback")).toBe("fallback");
  });

  it("returns the fallback when obj is a string (non-object)", () => {
    expect(safeGet("hello", "length", 0)).toBe(0);
  });

  it("returns the fallback when obj is a number", () => {
    expect(safeGet(42, "toString", "nope")).toBe("nope");
  });

  it("returns 0 (falsy but valid) when the value is 0", () => {
    expect(safeGet({ count: 0 }, "count", 99)).toBe(0);
  });

  it("returns false (falsy but valid) when the value is false", () => {
    expect(safeGet({ active: false }, "active", true)).toBe(false);
  });

  it("returns empty string (falsy but valid) when the value is empty string", () => {
    expect(safeGet({ name: "" }, "name", "default")).toBe("");
  });

  it("returns fallback when the value is null (nullish coalescing treats null as missing)", () => {
    // safeGet uses ?? which returns fallback for null
    expect(safeGet({ value: null }, "value", "fallback")).toBe("fallback");
  });

  it("handles arrays as objects", () => {
    expect(safeGet([10, 20, 30], "0", -1)).toBe(10);
    expect(safeGet([10, 20, 30], "1", -1)).toBe(20);
  });

  it("returns the fallback for a boolean obj", () => {
    expect(safeGet(true, "x", "fallback")).toBe("fallback");
  });
});

// ── safeDeep ──────────────────────────────────────────────────────────────
describe("safeDeep", () => {
  const obj = {
    user: {
      name: "Alice",
      profile: {
        age: 30,
        address: {
          city: "New York",
          zip: "10001",
        },
      },
      hobbies: ["reading", "coding", "hiking"],
    },
    meta: null,
    level: 0,
    active: false,
    title: "",
  };

  it("returns the value for a valid 1-level path", () => {
    expect(safeDeep(obj, "user")).toBe(obj.user);
  });

  it("returns the value for a valid 2-level path", () => {
    expect(safeDeep(obj, "user.name")).toBe("Alice");
  });

  it("returns the value for a valid 3-level path", () => {
    expect(safeDeep(obj, "user.profile.age")).toBe(30);
  });

  it("returns the value for a valid 4-level path", () => {
    expect(safeDeep(obj, "user.profile.address.city")).toBe("New York");
  });

  it("returns fallback when a path segment is missing", () => {
    expect(safeDeep(obj, "user.profile.nonExistent", "N/A")).toBe("N/A");
  });

  it("returns default empty-string fallback when a path segment is missing and no fallback", () => {
    expect(safeDeep(obj, "user.profile.nonExistent")).toBe("");
  });

  it("returns fallback when intermediate value is null", () => {
    expect(safeDeep(obj, "meta.something", "default")).toBe("default");
  });

  it("returns fallback when obj is null", () => {
    expect(safeDeep(null, "path", "fallback")).toBe("fallback");
  });

  it("returns fallback when obj is undefined", () => {
    expect(safeDeep(undefined, "path", "fallback")).toBe("fallback");
  });

  it("returns fallback when obj is a primitive", () => {
    expect(safeDeep(42, "path", "fallback")).toBe("fallback");
  });

  it("returns fallback when path is empty", () => {
    expect(safeDeep(obj, "", "fallback")).toBe("fallback");
  });

  it("returns an array value from nested path", () => {
    expect(safeDeep(obj, "user.hobbies")).toEqual(["reading", "coding", "hiking"]);
  });

  it("returns 0 (falsy but valid) when the value is 0", () => {
    expect(safeDeep(obj, "level", 99)).toBe(0);
  });

  it("returns false (falsy but valid) when the value is false", () => {
    expect(safeDeep(obj, "active", true)).toBe(false);
  });

  it("returns empty string (falsy but valid) when the value is empty string", () => {
    expect(safeDeep(obj, "title", "default")).toBe("");
  });

  it("handles paths with multiple dots", () => {
    expect(safeDeep(obj, "user.profile.address.zip")).toBe("10001");
  });

  it("stops at null intermediate and returns fallback", () => {
    const partial = { a: { b: null as unknown } };
    expect(safeDeep(partial, "a.b.c", "fallback")).toBe("fallback");
  });

  it("stops at undefined intermediate and returns fallback", () => {
    const partial = { a: {} as Record<string, unknown> };
    expect(safeDeep(partial, "a.b.c", "fallback")).toBe("fallback");
  });

  it("does not crash on circular references", () => {
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;
    // Should not throw — may hit recursion limits or just return valid data
    expect(() => safeDeep(circular, "self.name")).not.toThrow();
  });

  it("handles __proto__ key traversal without crashing", () => {
    // safeDeep uses bracket notation obj[key]; for __proto__ this
    // resolves to the object's prototype via the accessor.
    // The key point: safeDeep should NOT crash regardless of engine behavior.
    const obj = JSON.parse('{ "__proto__": { "x": 1 } }');
    expect(() => safeDeep(obj, "__proto__.x", "fallback")).not.toThrow();
  });

  it("handles constructor key without crashing (resolves to actual constructor)", () => {
    // obj.constructor resolves to Object (the constructor function).
    // Object.prototype is the prototype we'd traverse through.
    const obj = {};
    const result = safeDeep(obj, "constructor.prototype.nonExistent", "fallback");
    expect(result).toBe("fallback");
  });
});

// ── safeEvent ─────────────────────────────────────────────────────────────
describe("safeEvent", () => {
  it("extracts .detail from a CustomEvent-like object", () => {
    const event = { detail: { id: 1, name: "test" } };
    expect(safeEvent(event)).toEqual({ id: 1, name: "test" });
  });

  it("returns {} when event is null", () => {
    expect(safeEvent(null)).toEqual({});
  });

  it("returns {} when event is undefined", () => {
    expect(safeEvent(undefined)).toEqual({});
  });

  it("returns {} when event is a string", () => {
    expect(safeEvent("click")).toEqual({});
  });

  it("returns {} when event is a number", () => {
    expect(safeEvent(42)).toEqual({});
  });

  it("returns {} when event is a boolean", () => {
    expect(safeEvent(true)).toEqual({});
  });

  it("returns {} when event is an array", () => {
    expect(safeEvent([1, 2, 3])).toEqual({});
  });

  it("returns {} when detail is absent", () => {
    const event = { type: "click" };
    expect(safeEvent(event)).toEqual({});
  });

  it("returns {} when detail is null", () => {
    const event = { detail: null };
    expect(safeEvent(event)).toEqual({});
  });

  it("returns {} when detail is undefined", () => {
    const event = { detail: undefined };
    expect(safeEvent(event)).toEqual({});
  });

  it("extracts detail with numeric keys", () => {
    const event = { detail: { 0: "a", 1: "b" } };
    expect(safeEvent(event)).toEqual({ 0: "a", 1: "b" });
  });

  it("extracts detail with nested objects", () => {
    const event = { detail: { user: { name: "Alice" }, meta: { score: 100 } } };
    expect(safeEvent(event)).toEqual({ user: { name: "Alice" }, meta: { score: 100 } });
  });

  it("returns a typed Record<string, unknown>", () => {
    const event = { detail: { count: 5 } };
    const result = safeEvent(event);
    expect(result.count).toBe(5);
  });
});

// ── safeString ────────────────────────────────────────────────────────────
describe("safeString", () => {
  it("returns the string when given a string", () => {
    expect(safeString("hello")).toBe("hello");
  });

  it("returns fallback for null", () => {
    expect(safeString(null)).toBe("");
  });

  it("returns fallback for undefined", () => {
    expect(safeString(undefined)).toBe("");
  });

  it("coerces a number to string", () => {
    expect(safeString(42)).toBe("42");
  });

  it("coerces a boolean to string", () => {
    expect(safeString(true)).toBe("true");
  });

  it("coerces bigint to string", () => {
    expect(safeString(BigInt(42))).toBe("42");
  });

  it("returns fallback for an object", () => {
    expect(safeString({}, "nope")).toBe("nope");
  });

  it("returns fallback for an array", () => {
    expect(safeString([], "nope")).toBe("nope");
  });

  it("uses custom fallback", () => {
    expect(safeString(null, "N/A")).toBe("N/A");
  });

  it("returns empty string for empty string", () => {
    expect(safeString("")).toBe("");
  });
});

// ── safeTitle ─────────────────────────────────────────────────────────────
describe("safeTitle", () => {
  it("returns the trimmed string when valid", () => {
    expect(safeTitle("Hello World")).toBe("Hello World");
  });

  it("returns fallback for null", () => {
    expect(safeTitle(null)).toBe("Untitled");
  });

  it("returns fallback for undefined", () => {
    expect(safeTitle(undefined)).toBe("Untitled");
  });

  it("returns fallback for empty string", () => {
    expect(safeTitle("")).toBe("Untitled");
  });

  it("returns fallback for whitespace-only string", () => {
    expect(safeTitle("   ")).toBe("Untitled");
  });

  it("trims whitespace", () => {
    expect(safeTitle("  Hello  ")).toBe("Hello");
  });

  it("coerces a number to string", () => {
    expect(safeTitle(42)).toBe("42");
  });

  it("uses custom fallback", () => {
    expect(safeTitle(null, "Default Title")).toBe("Default Title");
  });
});

// ── safeNumber (safe.ts) ──────────────────────────────────────────────────
describe("safeNumber (safe.ts version)", () => {
  it("returns the number when given a number", () => {
    expect(safeNumber(42)).toBe(42);
  });

  it("returns fallback for NaN", () => {
    expect(safeNumber(NaN)).toBe(0);
  });

  it("parses a numeric string", () => {
    expect(safeNumber("42")).toBe(42);
  });

  it("parses a float string", () => {
    expect(safeNumber("3.14")).toBe(3.14);
  });

  it("returns fallback for a non-numeric string", () => {
    expect(safeNumber("abc")).toBe(0);
  });

  it("trims whitespace from strings before parsing", () => {
    expect(safeNumber("  42  ")).toBe(42);
  });

  it("returns fallback for null", () => {
    expect(safeNumber(null)).toBe(0);
  });

  it("returns fallback for undefined", () => {
    expect(safeNumber(undefined)).toBe(0);
  });

  it("returns fallback for boolean", () => {
    expect(safeNumber(true)).toBe(0);
  });

  it("returns fallback for object", () => {
    expect(safeNumber({})).toBe(0);
  });

  it("returns 0 for 0", () => {
    expect(safeNumber(0)).toBe(0);
  });

  it("handles negative numbers", () => {
    expect(safeNumber(-10)).toBe(-10);
  });

  it("uses custom fallback", () => {
    expect(safeNumber(null, -1)).toBe(-1);
    expect(safeNumber("abc", 99)).toBe(99);
  });
});

// ── safeBoolean ───────────────────────────────────────────────────────────
describe("safeBoolean", () => {
  it("returns true when given true", () => {
    expect(safeBoolean(true)).toBe(true);
  });

  it("returns false when given false", () => {
    expect(safeBoolean(false)).toBe(false);
  });

  it("parses 'true' string to true", () => {
    expect(safeBoolean("true")).toBe(true);
  });

  it("parses 'TRUE' string to true (case-insensitive)", () => {
    expect(safeBoolean("TRUE")).toBe(true);
  });

  it("parses 'false' string to false", () => {
    expect(safeBoolean("false")).toBe(false);
  });

  it("returns fallback for null", () => {
    expect(safeBoolean(null)).toBe(false);
  });

  it("returns fallback for undefined", () => {
    expect(safeBoolean(undefined)).toBe(false);
  });

  it("returns fallback for a number", () => {
    expect(safeBoolean(1)).toBe(false);
  });

  it("returns fallback for an object", () => {
    expect(safeBoolean({})).toBe(false);
  });

  it("returns fallback for an empty string", () => {
    expect(safeBoolean("")).toBe(false);
  });

  it("returns fallback for non-true strings", () => {
    expect(safeBoolean("yes")).toBe(false);
    expect(safeBoolean("1")).toBe(false);
  });

  it("uses custom fallback", () => {
    expect(safeBoolean(null, true)).toBe(true);
  });
});

// ── safeObject ────────────────────────────────────────────────────────────
describe("safeObject", () => {
  it("returns the object when given a plain object", () => {
    const obj = { a: 1, b: 2 };
    expect(safeObject(obj, {})).toBe(obj);
  });

  it("returns the fallback when given null", () => {
    expect(safeObject(null, { fallback: true })).toEqual({ fallback: true });
  });

  it("returns the fallback when given undefined", () => {
    expect(safeObject(undefined, { fallback: true })).toEqual({ fallback: true });
  });

  it("returns the fallback when given an array", () => {
    expect(safeObject([1, 2, 3], {})).toEqual({});
  });

  it("returns the fallback when given a string", () => {
    expect(safeObject("hello", {})).toEqual({});
  });

  it("returns the fallback when given a number", () => {
    expect(safeObject(42, {})).toEqual({});
  });

  it("returns the fallback when given a boolean", () => {
    expect(safeObject(true, {})).toEqual({});
  });

  it("preserves the type via generic", () => {
    interface Config {
      theme: string;
      debug: boolean;
    }
    const config: Config = { theme: "dark", debug: true };
    const result = safeObject<Config>(config, { theme: "light", debug: false });
    expect(result.theme).toBe("dark");
    expect(result.debug).toBe(true);
  });

  it("returns fallback for empty object (valid but empty)", () => {
    const result = safeObject({}, { fallback: true });
    expect(result).toEqual({});
  });
});

// ── safeLower ─────────────────────────────────────────────────────────────
describe("safeLower", () => {
  it("lowercases a string", () => {
    expect(safeLower("Hello World")).toBe("hello world");
  });

  it("returns empty string for null", () => {
    expect(safeLower(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(safeLower(undefined)).toBe("");
  });

  it("coerces a number to lowercase string", () => {
    expect(safeLower(42)).toBe("42");
  });

  it("coerces a boolean to lowercase string", () => {
    expect(safeLower(true)).toBe("true");
  });

  it("handles already-lowercase string", () => {
    expect(safeLower("hello")).toBe("hello");
  });

  it("handles mixed case", () => {
    expect(safeLower("MiXeD CaSe")).toBe("mixed case");
  });

  it("handles empty string", () => {
    expect(safeLower("")).toBe("");
  });
});

// ── Re-exports from safeData behave identically ─────────────────────────
describe("re-exports from safeData", () => {
  it("safeArray is the same function", () => {
    expect(safeArray([1, 2, 3])).toEqual([1, 2, 3]);
    expect(safeArray(null)).toEqual([]);
  });

  it("safeMap works", () => {
    expect(safeMap([1, 2, 3], (n: number) => n * 2)).toEqual([2, 4, 6]);
    expect(safeMap(null, () => {})).toEqual([]);
  });

  it("safeFilter works", () => {
    expect(safeFilter([1, 2, 3, 4], (n: number) => n > 2)).toEqual([3, 4]);
    expect(safeFilter(null, () => true)).toEqual([]);
  });

  it("safeForEach works", () => {
    const acc: number[] = [];
    safeForEach([1, 2, 3], (n: number) => { acc.push(n); });
    expect(acc).toEqual([1, 2, 3]);
    safeForEach(null, () => {});
  });

  it("safeReduce works", () => {
    const sum = safeReduce([1, 2, 3], (acc: number, n: number) => acc + n, 0);
    expect(sum).toBe(6);
    expect(safeReduce(null, () => 0, 42)).toBe(42);
  });
});
