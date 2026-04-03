import { env } from "../config/env.mjs";
import { getDb } from "../config/db.mjs";
import { runWatchlistScan } from "./osintWatchlistService.mjs";
import { logInfo, logWarn } from "../utils/logger.mjs";

const COLLECTION_WATCHLISTS = "osint_watchlists";

let scheduler = null;
let inFlight = false;

const runBatch = async () => {
  if (inFlight) return;
  inFlight = true;
  try {
    const db = getDb();
    const now = Date.now();
    const limit = Math.max(1, Math.min(Number(env.osintSchedulerBatchLimit || 5), 20));
    const due = await db
      .collection(COLLECTION_WATCHLISTS)
      .find({ active: true, nextRunAt: { $lte: now } })
      .sort({ nextRunAt: 1 })
      .limit(limit)
      .toArray();

    for (const watchlist of due) {
      try {
        await runWatchlistScan({ ownerId: watchlist.ownerId, watchlist });
        logInfo("OSINT watchlist scan complete", { id: watchlist._id, target: watchlist.target });
      } catch (error) {
        logWarn("OSINT watchlist scan failed", { id: watchlist._id, error: String(error?.message || error) });
      }
    }
  } catch (error) {
    logWarn("OSINT scheduler loop failed", { error: String(error?.message || error) });
  } finally {
    inFlight = false;
  }
};

export const startOsintScheduler = ({ intervalMs = 60000 } = {}) => {
  if (!env.osintSchedulerEnabled) return;
  if (scheduler) return;
  logInfo("OSINT scheduler enabled", { intervalMs });
  scheduler = setInterval(() => {
    runBatch().catch(() => undefined);
  }, intervalMs);
  scheduler.unref?.();
};

export const stopOsintScheduler = () => {
  if (!scheduler) return;
  clearInterval(scheduler);
  scheduler = null;
};

