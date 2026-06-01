/**
 * Safe data access utilities to prevent "Cannot read properties of undefined" runtime crashes.
 *
 * Use these when accessing API response data, optional props, or any value
 * that could be null/undefined at runtime.
 */

/**
 * Safely coerce a value to an array. Returns `[]` for null/undefined/non-array values.
 */
export function safeArray<T>(data: T[]): T[];
export function safeArray<T>(data: null | undefined): T[];
export function safeArray<T>(data: unknown): T[];
export function safeArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  return [];
}

/**
 * Safe `.map()` that won't crash if `data` is undefined/null.
 * Returns `[]` for falsy data.
 */
export function safeMap<T, R>(data: T[], fn: (item: T, index: number) => R): R[];
export function safeMap<T, R>(data: unknown, fn: (item: T, index: number) => R): R[];
export function safeMap<T, R>(data: unknown, fn: (item: T, index: number) => R): R[] {
  return safeArray<T>(data).map(fn);
}

/**
 * Safe `.filter()` that won't crash if `data` is undefined/null.
 * Returns `[]` for falsy data.
 */
export function safeFilter<T>(data: T[], fn: (item: T, index: number) => boolean): T[];
export function safeFilter<T>(data: unknown, fn: (item: T, index: number) => boolean): T[];
export function safeFilter<T>(data: unknown, fn: (item: T, index: number) => boolean): T[] {
  return safeArray<T>(data).filter(fn);
}

/**
 * Safe `.forEach()` that won't crash if `data` is undefined/null.
 */
export function safeForEach<T>(data: T[], fn: (item: T, index: number) => void): void;
export function safeForEach<T>(data: unknown, fn: (item: T, index: number) => void): void;
export function safeForEach<T>(data: unknown, fn: (item: T, index: number) => void): void {
  safeArray<T>(data).forEach(fn);
}

/**
 * Safe `.reduce()` that won't crash if `data` is undefined/null.
 * Returns `initialValue` for falsy data.
 */
export function safeReduce<T, R>(data: T[], fn: (acc: R, item: T, index: number) => R, initialValue: R): R;
export function safeReduce<T, R>(data: unknown, fn: (acc: R, item: T, index: number) => R, initialValue: R): R;
export function safeReduce<T, R>(data: unknown, fn: (acc: R, item: T, index: number) => R, initialValue: R): R {
  return safeArray<T>(data).reduce(fn, initialValue);
}

/**
 * Safely access a nested property using a dot-path string.
 * Returns `fallback` (default `undefined`) if any segment is null/undefined.
 *
 * @example
 *   safeGet(response, 'data.missions', [])  // => response?.data?.missions ?? []
 *   safeGet(user, 'profile.name', 'Unknown') // => user?.profile?.name ?? 'Unknown'
 */
export const safeGet = <T = unknown>(
  obj: unknown,
  path: string,
  fallback?: T
): T | undefined => {
  if (!obj || !path) return fallback;
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return fallback;
    current = (current as Record<string, unknown>)[key];
  }
  return (current as T | undefined) ?? fallback;
};

/**
 * Safely access a property of an object with a default value.
 * Works like `obj?.prop ?? defaultValue`.
 *
 * @example
 *   safeProp(response, 'data', { missions: [] })  // => response?.data ?? { missions: [] }
 */
export const safeProp = <T>(obj: unknown, key: string, fallback: T): T => {
  if (obj == null || typeof obj !== "object") return fallback;
  return (obj as Record<string, unknown>)[key] as T ?? fallback;
};
