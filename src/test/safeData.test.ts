import { describe, it, expect, vi } from "vitest";
import {
  safeArray,
  safeMap,
  safeFilter,
  safeForEach,
  safeReduce,
  safeGet,
  safeProp,
} from "@/utils/safeData";

// ── safeArray ────────────────────────────────────────────────────────────
describe("safeArray", () => {
  it("returns the same array when given an array", () => {
    const arr = [1, 2, 3];
    expect(safeArray(arr)).toBe(arr);
    expect(safeArray(arr)).toEqual([1, 2, 3]);
  });

  it("returns [] for null", () => {
    expect(safeArray(null)).toEqual([]);
  });

  it("returns [] for undefined", () => {
    expect(safeArray(undefined)).toEqual([]);
  });

  it("returns [] for a number", () => {
    expect(safeArray(42)).toEqual([]);
  });

  it("returns [] for a string", () => {
    expect(safeArray("hello")).toEqual([]);
  });

  it("returns [] for an object", () => {
    expect(safeArray({ a: 1 })).toEqual([]);
  });

  it("returns [] for a boolean", () => {
    expect(safeArray(true)).toEqual([]);
  });

  it("returns [] for an empty array", () => {
    expect(safeArray([])).toEqual([]);
  });

  it("preserves the array type with generics", () => {
    const result = safeArray<{ name: string }>([{ name: "test" }]);
    expect(result).toEqual([{ name: "test" }]);
  });
});

// ── safeMap ──────────────────────────────────────────────────────────────
describe("safeMap", () => {
  it("maps over a valid array", () => {
    const result = safeMap<number, number>([1, 2, 3], (n) => n * 2);
    expect(result).toEqual([2, 4, 6]);
  });

  it("returns [] when data is null", () => {
    const spy = vi.fn();
    const result = safeMap(null, spy);
    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns [] when data is undefined", () => {
    const spy = vi.fn();
    const result = safeMap(undefined, spy);
    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns [] when data is a string (non-array)", () => {
    const spy = vi.fn();
    const result = safeMap("not-an-array", spy);
    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("passes the correct index to the callback", () => {
    const indices: number[] = [];
    safeMap(["a", "b", "c"], (_item, index) => {
      indices.push(index);
      return "";
    });
    expect(indices).toEqual([0, 1, 2]);
  });

  it("maps typed objects correctly", () => {
    interface User {
      name: string;
      age: number;
    }
    const users: User[] = [
      { name: "Alice", age: 30 },
      { name: "Bob", age: 25 },
    ];
    const names = safeMap(users, (u) => u.name);
    expect(names).toEqual(["Alice", "Bob"]);
  });
});

// ── safeFilter ───────────────────────────────────────────────────────────
describe("safeFilter", () => {
  it("filters a valid array", () => {
    const result = safeFilter([1, 2, 3, 4, 5], (n) => n > 2);
    expect(result).toEqual([3, 4, 5]);
  });

  it("returns [] when data is null", () => {
    const spy = vi.fn();
    const result = safeFilter(null, spy);
    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns [] when data is undefined", () => {
    const spy = vi.fn();
    const result = safeFilter(undefined, spy);
    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns [] when data is a number (non-array)", () => {
    const spy = vi.fn();
    const result = safeFilter(0, spy);
    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("filters objects by property", () => {
    interface Item {
      id: number;
      active: boolean;
    }
    const items: Item[] = [
      { id: 1, active: true },
      { id: 2, active: false },
      { id: 3, active: true },
    ];
    const active = safeFilter(items, (item) => item.active);
    expect(active).toEqual([
      { id: 1, active: true },
      { id: 3, active: true },
    ]);
  });
});

// ── safeForEach ──────────────────────────────────────────────────────────
describe("safeForEach", () => {
  it("iterates over a valid array", () => {
    const acc: number[] = [];
    safeForEach([1, 2, 3], (n) => {
      acc.push(n * 10);
    });
    expect(acc).toEqual([10, 20, 30]);
  });

  it("does nothing when data is null", () => {
    const spy = vi.fn();
    safeForEach(null, spy);
    expect(spy).not.toHaveBeenCalled();
  });

  it("does nothing when data is undefined", () => {
    const spy = vi.fn();
    safeForEach(undefined, spy);
    expect(spy).not.toHaveBeenCalled();
  });

  it("does nothing when data is a boolean (non-array)", () => {
    const spy = vi.fn();
    safeForEach(false, spy);
    expect(spy).not.toHaveBeenCalled();
  });

  it("passes the correct index", () => {
    const indices: number[] = [];
    safeForEach(["x", "y", "z"], (_item, index) => {
      indices.push(index);
    });
    expect(indices).toEqual([0, 1, 2]);
  });
});

// ── safeReduce ───────────────────────────────────────────────────────────
describe("safeReduce", () => {
  it("reduces a valid array with initial value", () => {
    const sum = safeReduce<number, number>(
      [1, 2, 3, 4, 5],
      (acc, n) => acc + n,
      0
    );
    expect(sum).toBe(15);
  });

  it("returns initial value when data is null", () => {
    const spy = vi.fn();
    const result = safeReduce(null, spy, "default");
    expect(result).toBe("default");
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns initial value when data is undefined", () => {
    const spy = vi.fn();
    const result = safeReduce(undefined, spy, []);
    expect(result).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns initial value when data is a string (non-array)", () => {
    const spy = vi.fn();
    const result = safeReduce("oops", spy, { fallback: true });
    expect(result).toEqual({ fallback: true });
    expect(spy).not.toHaveBeenCalled();
  });

  it("reduces objects to a map", () => {
    interface Pet {
      name: string;
      species: string;
    }
    const pets: Pet[] = [
      { name: "Rex", species: "dog" },
      { name: "Whiskers", species: "cat" },
      { name: "Buddy", species: "dog" },
    ];
    const grouped = safeReduce(
      pets,
      (acc: Record<string, Pet[]>, pet) => {
        (acc[pet.species] ??= []).push(pet);
        return acc;
      },
      {} as Record<string, Pet[]>
    );
    expect(grouped.dog).toHaveLength(2);
    expect(grouped.cat).toHaveLength(1);
  });

  it("reduces with an explicit initial value", () => {
    const result = safeReduce<number, number>([5, 10, 15], (acc, n) => acc + n, 0);
    expect(result).toBe(30);
  });

  it("returns initialValue for empty array", () => {
    const result = safeReduce<number, number>([], (_acc, _n) => _acc + _n, 42);
    expect(result).toBe(42);
  });
});

// ── safeGet ──────────────────────────────────────────────────────────────
describe("safeGet", () => {
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
  };

  it("returns the value for a valid 1-level path", () => {
    expect(safeGet(obj, "user")).toBe(obj.user);
  });

  it("returns the value for a valid 2-level path", () => {
    expect(safeGet(obj, "user.name")).toBe("Alice");
  });

  it("returns the value for a valid 3-level path", () => {
    expect(safeGet(obj, "user.profile.age")).toBe(30);
  });

  it("returns the value for a valid 4-level path", () => {
    expect(safeGet(obj, "user.profile.address.city")).toBe("New York");
  });

  it("returns fallback when a path segment is missing", () => {
    expect(safeGet(obj, "user.profile.nonExistent", "N/A")).toBe("N/A");
  });

  it("returns undefined when a path segment is missing and no fallback", () => {
    expect(safeGet(obj, "user.profile.nonExistent")).toBeUndefined();
  });

  it("returns fallback when intermediate value is null", () => {
    expect(safeGet(obj, "meta.something", "default")).toBe("default");
  });

  it("returns fallback when obj is null", () => {
    expect(safeGet(null, "path", "fallback")).toBe("fallback");
  });

  it("returns fallback when obj is undefined", () => {
    expect(safeGet(undefined, "path", "fallback")).toBe("fallback");
  });

  it("returns fallback when obj is a primitive", () => {
    expect(safeGet(42, "path", "fallback")).toBe("fallback");
  });

  it("returns fallback when path is empty string", () => {
    expect(safeGet(obj, "", "fallback")).toBe("fallback");
  });

  it("returns fallback when path is null", () => {
    expect(safeGet(obj, null as unknown as string, "fallback")).toBe("fallback");
  });

  it("returns fallback when path is undefined", () => {
    expect(safeGet(obj, undefined as unknown as string, "fallback")).toBe("fallback");
  });

  it("returns an array value from nested path", () => {
    expect(safeGet(obj, "user.hobbies")).toEqual(["reading", "coding", "hiking"]);
  });

  it("returns 0 (falsy but valid) when the value is 0", () => {
    const testObj = { level: 0 };
    expect(safeGet(testObj, "level", 99)).toBe(0);
  });

  it("returns false (falsy but valid) when the value is false", () => {
    const testObj = { active: false };
    expect(safeGet(testObj, "active", true)).toBe(false);
  });

  it("returns empty string (falsy but valid) when the value is empty string", () => {
    const testObj = { name: "" };
    expect(safeGet(testObj, "name", "default")).toBe("");
  });
});

// ── safeProp ─────────────────────────────────────────────────────────────
describe("safeProp", () => {
  it("returns the property value when it exists", () => {
    const obj = { name: "Alice", age: 30 };
    expect(safeProp(obj, "name", "Unknown")).toBe("Alice");
  });

  it("returns the fallback when property is missing", () => {
    const obj = { name: "Alice" };
    expect(safeProp(obj, "missing" as string, "fallback")).toBe("fallback");
  });

  it("returns the fallback when obj is null", () => {
    expect(safeProp(null, "x", "fallback")).toBe("fallback");
  });

  it("returns the fallback when obj is undefined", () => {
    expect(safeProp(undefined, "x", "fallback")).toBe("fallback");
  });

  it("returns the fallback when obj is a string (non-object)", () => {
    expect(safeProp("hello", "length", "fallback")).toBe("fallback");
  });

  it("returns the fallback when obj is a number", () => {
    expect(safeProp(42, "toString", "fallback")).toBe("fallback");
  });

  it("returns 0 (falsy but valid) when the value is 0", () => {
    const obj = { count: 0 };
    expect(safeProp(obj, "count", 99)).toBe(0);
  });

  it("returns false (falsy but valid) when the value is false", () => {
    const obj = { enabled: false };
    expect(safeProp(obj, "enabled", true)).toBe(false);
  });

  it("returns the fallback when the property value is null (coerces null to safe default)", () => {
    const obj = { value: null };
    expect(safeProp(obj, "value", "fallback")).toBe("fallback");
  });

  it("returns an empty array fallback when property is missing", () => {
    const obj = {};
    expect(safeProp(obj, "items", [])).toEqual([]);
  });

  it("preserves the returned type via generic", () => {
    const obj = { data: { id: 1 } };
    const result = safeProp<{ id: number }>(obj, "data", { id: 0 });
    expect(result.id).toBe(1);
  });
});
