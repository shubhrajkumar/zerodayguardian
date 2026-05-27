import { getDb } from "../config/db.mjs";
import { logInfo, logWarn, logError } from "../utils/logger.mjs";

const PYTHON_API_BASE_URL = String(
  process.env.PY_API_INTERNAL_URL ||
  `http://127.0.0.1:${process.env.PY_API_PORT || "8000"}`
).replace(/\/+$/, "");

const SYNC_TIMEOUT_MS = 8_000;
const BATCH_SIZE = 50;

const COLLECTIONS = {
  DAY_LAB_STATES: "py_day_lab_states",
  DAILY_PROGRESS: "py_daily_progress",
  USER_EVENTS: "py_user_events",
  THREAT_EVENTS: "py_threat_events",
};

/**
 * Post a sync payload to a Python sync endpoint.
 */
const postSync = async (path, payload) => {
  const url = `${PYTHON_API_BASE_URL}${path}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logWarn("Python sync endpoint returned error", {
        path,
        status: response.status,
        body: text.slice(0, 200),
      });
      return { synced: 0, failed: payload.records?.length || 0, errors: [text] };
    }
    return await response.json();
  } catch (error) {
    logWarn("Python sync endpoint unreachable", {
      path,
      error: String(error?.message || error),
    });
    return { synced: 0, failed: payload.records?.length || 0, errors: [String(error?.message || "unreachable")] };
  }
};

/**
 * Collect day_lab_states for a user from MongoDB and push to Python.
 */
export const syncDayLabStates = async (authSub) => {
  try {
    const db = getDb();
    const rows = await db
      .collection(COLLECTIONS.DAY_LAB_STATES)
      .find({ userId: authSub })
      .sort({ dayNumber: 1 })
      .limit(BATCH_SIZE)
      .toArray();

    if (!rows.length) return { synced: 0, failed: 0, errors: [] };

    const records = rows.map((row) => ({
      day_number: Number(row.dayNumber || 0),
      current_task_index: Number(row.currentTaskIndex || 0),
      unlocked: Boolean(row.unlocked),
      completed: Boolean(row.completed),
      score: Number(row.score || 0),
      xp_earned: Number(row.xpEarned || 0),
      attempts: Number(row.attempts || 0),
      completed_task_ids: Array.isArray(row.completedTaskIds) ? row.completedTaskIds : [],
      terminal_log: Array.isArray(row.terminalLog) ? row.terminalLog : [],
      last_feedback: row.lastFeedback || null,
      updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    }));

    return await postSync("/pyapi/sync/day_lab_states", {
      auth_sub: authSub,
      records,
    });
  } catch (error) {
    logError("syncDayLabStates failed", error, { authSub });
    return { synced: 0, failed: 1, errors: [String(error?.message || error)] };
  }
};

/**
 * Collect daily_progress for a user from MongoDB and push to Python.
 */
export const syncDailyProgress = async (authSub) => {
  try {
    const db = getDb();
    const rows = await db
      .collection(COLLECTIONS.DAILY_PROGRESS)
      .find({ userId: authSub })
      .sort({ day: -1 })
      .limit(BATCH_SIZE)
      .toArray();

    if (!rows.length) return { synced: 0, failed: 0, errors: [] };

    const records = rows.map((row) => ({
      day: String(row.day || ""),
      missions_completed: Number(row.missionsCompleted || 0),
      xp_earned: Number(row.xpEarned || 0),
      streak_day: Number(row.streakDay || 0),
      updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    }));

    return await postSync("/pyapi/sync/daily_progress", {
      auth_sub: authSub,
      records,
    });
  } catch (error) {
    logError("syncDailyProgress failed", error, { authSub });
    return { synced: 0, failed: 1, errors: [String(error?.message || error)] };
  }
};

/**
 * Collect user_events for a user from MongoDB and push to Python.
 */
export const syncUserEvents = async (authSub) => {
  try {
    const db = getDb();
    const rows = await db
      .collection(COLLECTIONS.USER_EVENTS)
      .find({ userId: authSub })
      .sort({ createdAt: -1 })
      .limit(BATCH_SIZE)
      .toArray();

    if (!rows.length) return { synced: 0, failed: 0, errors: [] };

    const records = rows.map((row) => ({
      event_type: String(row.eventType || ""),
      surface: String(row.surface || ""),
      target: row.target ? String(row.target) : null,
      metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
      created_at: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    }));

    return await postSync("/pyapi/sync/user_events", {
      auth_sub: authSub,
      records,
    });
  } catch (error) {
    logError("syncUserEvents failed", error, { authSub });
    return { synced: 0, failed: 1, errors: [String(error?.message || error)] };
  }
};

/**
 * Collect threat_events for a user from MongoDB and push to Python.
 */
export const syncThreatEvents = async (authSub) => {
  try {
    const db = getDb();
    const rows = await db
      .collection(COLLECTIONS.THREAT_EVENTS)
      .find({ userId: authSub })
      .sort({ createdAt: -1 })
      .limit(BATCH_SIZE)
      .toArray();

    if (!rows.length) return { synced: 0, failed: 0, errors: [] };

    const records = rows.map((row) => ({
      input_metrics: row.input_metrics && typeof row.input_metrics === "object" ? row.input_metrics : {},
      risk_level: String(row.risk_level || "low"),
      reasons: Array.isArray(row.reasons) ? row.reasons : [],
      created_at: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    }));

    return await postSync("/pyapi/sync/threat_events", {
      auth_sub: authSub,
      records,
    });
  } catch (error) {
    logError("syncThreatEvents failed", error, { authSub });
    return { synced: 0, failed: 1, errors: [String(error?.message || error)] };
  }
};

/**
 * Run all sync operations for a given user auth sub.
 * This is a fire-and-forget operation — it logs results but does not block.
 */
export const syncAllForUser = async (authSub) => {
  if (!authSub || typeof authSub !== "string" || !authSub.trim()) {
    logWarn("syncAllForUser skipped: no authSub provided");
    return;
  }

  const results = await Promise.allSettled([
    syncDayLabStates(authSub),
    syncDailyProgress(authSub),
    syncUserEvents(authSub),
    syncThreatEvents(authSub),
  ]);

  const summary = results.map((r, i) => {
    const labels = ["day_lab_states", "daily_progress", "user_events", "threat_events"];
    if (r.status === "fulfilled") {
      return `${labels[i]}: synced=${r.value.synced} failed=${r.value.failed}`;
    }
    return `${labels[i]}: error=${r.reason?.message || r.reason}`;
  });

  logInfo("User data sync completed", {
    authSub,
    summary: summary.join(" | "),
  });
};
