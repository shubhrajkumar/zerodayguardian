import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DocumentData } from "firebase/firestore";

// ── Mocks ──
// gamificationSystem.ts imports Firebase via `const loadFirestore = () => import("firebase/firestore")`
// and static imports from @/lib/firebase. We mock both so the transaction
// code can be exercised deterministically without a real Firestore instance.

const { firestoreMocks } = vi.hoisted(() => ({
  firestoreMocks: {
    runTransaction: vi.fn(),
    doc: vi.fn(),
    serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
  },
}));

vi.mock("firebase/firestore", () => firestoreMocks);

vi.mock("@/lib/firebase", () => ({
  firebaseAuth: { currentUser: { uid: "user-1" } },
  firestoreDb: { type: "mock-firestore" },
  isFirebaseConfigured: true,
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import {
  loadGamificationSnapshot,
  completeGamifiedMission,
  submitGamifiedQuizAnswer,
} from "@/lib/gamificationSystem";

// ── Helpers ──

type MockTx = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

const makeTx = (exists: boolean, data?: DocumentData | null): MockTx => ({
  get: vi.fn(async () => ({ exists: () => exists, data: () => data })),
  set: vi.fn(),
  update: vi.fn(),
});

const withRunTransaction = (tx: MockTx) => {
  firestoreMocks.runTransaction.mockImplementation(async (_db: unknown, fn: (t: unknown) => unknown) => fn(tx));
};

const mission = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  kind: "port_scan",
  title: "Test Mission",
  briefing: "briefing",
  cta: "cta",
  route: "/lab",
  xp: 120,
  badgeId: null,
  completed: false,
  completedAt: null,
  ...overrides,
});

const quizQuestion = {
  id: "quiz-1",
  prompt: "Which scan is quietest?",
  explanation: "SYN scans avoid full handshakes.",
  correctOptionId: "syn",
  options: [{ id: "syn", emoji: "🔐", label: "SYN scan" }],
};

const existingDoc = (): DocumentData => {
  const now = new Date();
  const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return {
    handle: "operator",
    dailyKey: dayKey,
    weeklyKey: "2026-W99",
    totalXp: 0,
    streakDays: 0,
    completedDays: 0,
    dailyMissions: [mission("mission-1")],
    weeklyMissions: [],
    quizQuestions: [quizQuestion],
    quizAnswers: {},
    badges: [],
    recentRewards: [],
    level: 1,
  };
};

describe("gamificationSystem Firestore race-safety", () => {
  beforeEach(() => {
    // resetAllMocks clears implementations too, so each test starts clean
    // (no leaked mockRejectedValue / mockImplementation from previous tests).
    vi.resetAllMocks();
    firestoreMocks.doc.mockImplementation((_db: unknown, _collection: string, userId: string) => ({
      path: `gamification_users/${userId}`,
      id: userId,
    }));
    firestoreMocks.serverTimestamp.mockReturnValue({ __serverTimestamp: true });
  });

  // ── writeUserState exists-branch ──

  it("updates an existing user document via transaction.update (no set)", async () => {
    const tx = makeTx(true, existingDoc());
    withRunTransaction(tx);

    const snapshot = await loadGamificationSnapshot("user-1", "Test");

    expect(snapshot.serviceStatus).toBe("ready");
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(tx.set).not.toHaveBeenCalled();
  });

  it("merge-creates a missing user document with { merge: true } (no update)", async () => {
    const tx = makeTx(false);
    withRunTransaction(tx);

    const snapshot = await loadGamificationSnapshot("user-1", "Test");

    expect(snapshot.serviceStatus).toBe("ready");
    expect(tx.set).toHaveBeenCalledTimes(1);
    expect(tx.update).not.toHaveBeenCalled();

    const [, data, options] = tx.set.mock.calls[0] as [unknown, Record<string, unknown>, { merge: boolean }];
    expect(options).toEqual({ merge: true });
    expect(data.userId).toBe("user-1");
  });

  // ── in-flight dedup (StrictMode double-effect / multi-component mounts) ──

  it("dedupes concurrent loads for the same user into one transaction", async () => {
    let transactionCalls = 0;
    firestoreMocks.runTransaction.mockImplementation(async (_db: unknown, fn: (t: unknown) => unknown) => {
      transactionCalls += 1;
      return fn(makeTx(false));
    });

    const [first, second] = await Promise.all([
      loadGamificationSnapshot("user-1", "Test"),
      loadGamificationSnapshot("user-1", "Test"),
    ]);

    expect(transactionCalls).toBe(1);
    expect(second).toBe(first);
  });

  it("allows a fresh load after the previous one settles", async () => {
    const tx = makeTx(true, existingDoc());
    withRunTransaction(tx);

    await loadGamificationSnapshot("user-1", "Test");
    const again = await loadGamificationSnapshot("user-1", "Test");

    expect(firestoreMocks.runTransaction).toHaveBeenCalledTimes(2);
    expect(again.serviceStatus).toBe("ready");
  });

  // ── runUserTransaction already-exists retry ──

  it("retries when a concurrent transaction wins the create race (already-exists)", async () => {
    const alreadyExists = Object.assign(new Error("already-exists"), {
      code: "already-exists",
      name: "FirebaseError",
    });
    let attempt = 0;
    firestoreMocks.runTransaction.mockImplementation(async (_db: unknown, fn: (t: unknown) => unknown) => {
      attempt += 1;
      if (attempt === 1) throw alreadyExists;
      return fn(makeTx(true, existingDoc()));
    });

    const snapshot = await loadGamificationSnapshot("user-1", "Test");

    expect(attempt).toBe(2);
    expect(snapshot.serviceStatus).toBe("ready");
  });

  it("gives up after 3 attempts when the race never resolves", async () => {
    const alreadyExists = Object.assign(new Error("already-exists"), {
      code: "already-exists",
      name: "FirebaseError",
    });
    firestoreMocks.runTransaction.mockRejectedValue(alreadyExists);

    await expect(loadGamificationSnapshot("user-1", "Test")).rejects.toThrow(/already-exists/);
    expect(firestoreMocks.runTransaction).toHaveBeenCalledTimes(3);
  });

  // ── write paths use the same race-safe writer ──

  it("writes mission completion via update on an existing doc", async () => {
    const tx = makeTx(true, existingDoc());
    withRunTransaction(tx);

    const result = await completeGamifiedMission("user-1", "daily", "mission-1", "Test");

    expect(tx.update).toHaveBeenCalled();
    expect(tx.set).not.toHaveBeenCalled();
    expect(result.reward).not.toBeNull();
    expect(result.snapshot.dailyMissions[0].completed).toBe(true);

    // Lock in the badgeId fix: the written payload must contain no undefined
    // values (Firestore rejects undefined with "invalid data"). toStrictEqual
    // is required — toEqual ignores undefined properties.
    const writtenData = tx.update.mock.calls[0][1] as { dailyMissions: Array<Record<string, unknown>> };
    expect(writtenData.dailyMissions[0].badgeId).toBeNull();
    expect(JSON.parse(JSON.stringify(writtenData))).toStrictEqual(writtenData);
  });

  it("normalizes a mission with no badgeId to null before writing", async () => {
    const doc = existingDoc();
    // Simulate legacy data: a mission object without a badgeId key at all.
    doc.dailyMissions = [
      {
        id: "mission-1",
        kind: "port_scan",
        title: "Legacy mission",
        briefing: "briefing",
        cta: "cta",
        route: "/lab",
        xp: 100,
        completed: false,
        completedAt: null,
      },
    ];
    const tx = makeTx(true, doc);
    withRunTransaction(tx);

    await loadGamificationSnapshot("user-1", "Test");

    const writtenData = tx.update.mock.calls[0][1] as { dailyMissions: Array<{ badgeId?: string | null }> };
    expect(writtenData.dailyMissions[0].badgeId).toBeNull();
  });

  it("merge-creates a missing doc when a mission completes before first load", async () => {
    const tx = makeTx(false);
    withRunTransaction(tx);

    // A missing user doc gets freshly built daily missions with ids of the
    // form `${dayKey}-daily-1-${kind}`. Replicate the deterministic seeded
    // order used by buildDailyMissions to target the first mission.
    const now = new Date();
    const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const kinds = ["port_scan", "cve_read", "ctf"];
    const shuffled = [...kinds];
    let hash = 0;
    for (const char of dayKey) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      hash = (hash * 1664525 + 1013904223) >>> 0;
      const swapIndex = hash % (index + 1);
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    const firstMissionId = `${dayKey}-daily-1-${shuffled[0]}`;

    const result = await completeGamifiedMission("user-1", "daily", firstMissionId, "Test");

    expect(tx.set).toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
    expect(result.snapshot.serviceStatus).toBe("ready");
    expect(result.reward).not.toBeNull();

    const [, , options] = tx.set.mock.calls[0] as [unknown, unknown, { merge: boolean }];
    expect(options).toEqual({ merge: true });
  });

  it("persists a quiz answer on an existing doc without tripping already-exists", async () => {
    const tx = makeTx(true, existingDoc());
    withRunTransaction(tx);

    const result = await submitGamifiedQuizAnswer("user-1", "quiz-1", "syn", "Test");

    expect(tx.update).toHaveBeenCalled();
    expect(tx.set).not.toHaveBeenCalled();
    expect(result.answer?.correct).toBe(true);
    expect(result.reward).not.toBeNull();
  });
});
