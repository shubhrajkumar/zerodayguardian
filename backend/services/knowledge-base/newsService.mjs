import { EventEmitter } from "node:events";
import { getDb } from "../../src/config/db.mjs";
import { logWarn } from "../../src/utils/logger.mjs";
import { incMetric, observeMetric } from "../../src/observability/telemetry.mjs";

const feeds = [
  { source: "CISA Alerts", url: "https://www.cisa.gov/cybersecurity-advisories/all.xml", credibility: "high" },
  { source: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews", credibility: "medium" },
  { source: "SecurityWeek", url: "https://feeds.feedburner.com/securityweek", credibility: "medium" },
];

const COLLECTION_NEWS = "cyber_news_items";
const COLLECTION_STATE = "cyber_news_state";
const emitter = new EventEmitter();
let scheduler = null;
let inFlight = false;
let memoryCache = [];
const NEWS_STALE_MS = 15 * 60 * 1000;

const decodeXml = (value = "") =>
  String(value || "")
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const extractItems = (xml = "") => {
  const blocks = String(xml).match(/<item[\s\S]*?<\/item>/gi) || [];
  return blocks.map((block) => {
    const pick = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return decodeXml(m?.[1] || "");
    };
    return {
      title: pick("title").trim(),
      link: pick("link").trim(),
      description: pick("description").replace(/\s+/g, " ").trim().slice(0, 500),
      publishedAt: pick("pubDate"),
    };
  });
};

const normalizeDate = (value) => {
  const ts = Date.parse(String(value || ""));
  return Number.isFinite(ts) ? ts : Date.now();
};

const categoryFor = (title = "", description = "") => {
  const text = `${title} ${description}`.toLowerCase();
  if (/zero.?day|cve-\d{4}-\d+/i.test(text)) return "zero-day";
  if (/breach|data leak|stolen|compromised|incident/i.test(text)) return "breaches";
  if (/ai|llm|model|prompt injection/i.test(text)) return "ai-security";
  if (/malware|ransomware|trojan|botnet/i.test(text)) return "malware";
  return "threat-intel";
};

const dbSafe = () => {
  try {
    return getDb();
  } catch {
    return null;
  }
};

const mapCredibility = (sourceCredibility, ageHours) => {
  if (sourceCredibility === "high" && ageHours <= 72) return "verified";
  if (sourceCredibility === "high" || ageHours <= 48) return "trusted";
  return "community";
};

export const refreshNewsFeed = async ({ trigger = "manual" } = {}) => {
  if (inFlight) return { updated: false, reason: "in_flight" };
  const started = Date.now();
  inFlight = true;
  try {
    const batches = await Promise.all(
      feeds.map(async (feed) => {
        try {
          const response = await fetch(feed.url, { method: "GET" });
          if (!response.ok) return [];
          const xml = await response.text();
          return extractItems(xml).map((item) => ({
            ...item,
            source: feed.source,
            sourceCredibility: feed.credibility,
          }));
        } catch {
          return [];
        }
      })
    );

    const now = Date.now();
    const merged = batches
      .flat()
      .filter((item) => item.title && item.link)
      .map((item) => {
        const publishedTs = normalizeDate(item.publishedAt);
        const ageHours = Math.max(0, Math.floor((now - publishedTs) / 3_600_000));
        return {
          ...item,
          id: item.link,
          category: categoryFor(item.title, item.description),
          publishedTs,
          credibility: mapCredibility(item.sourceCredibility, ageHours),
          ageHours,
          updatedAt: now,
        };
      })
      .sort((a, b) => b.publishedTs - a.publishedTs)
      .slice(0, 180);

      const db = dbSafe();
      if (db) {
        const col = db.collection(COLLECTION_NEWS);
        for (const item of merged) {
          await col.updateOne({ id: item.id }, { $set: item }, { upsert: true });
        }
      await db.collection(COLLECTION_STATE).updateOne(
        { key: "news_feed" },
        {
          $set: {
            key: "news_feed",
            updatedAt: now,
            count: merged.length,
            trigger,
          },
        },
        { upsert: true }
      );
    } else {
      memoryCache = merged;
    }

    const payload = { updatedAt: now, count: merged.length, trigger };
    emitter.emit("news:update", payload);
    incMetric("neurobot_news_refresh_total", 1, { trigger, status: "ok" });
    observeMetric("neurobot_news_refresh_ms", Date.now() - started, { trigger });
    return { updated: true, count: merged.length, updatedAt: now };
  } catch (error) {
    logWarn("News refresh failed", { reason: String(error?.message || error) });
    incMetric("neurobot_news_refresh_total", 1, { trigger, status: "failed" });
    return { updated: false, reason: "failed" };
  } finally {
    inFlight = false;
  }
};

export const getNewsFeed = async ({ category = "all", limit = 20 } = {}) => {
  const db = dbSafe();
  if (!db) {
    const filtered = (category === "all" ? memoryCache : memoryCache.filter((item) => item.category === category)).slice(0, limit);
    const updatedAt = filtered[0]?.updatedAt || null;
    const stale = !updatedAt || Date.now() - Number(updatedAt) > NEWS_STALE_MS;
    return { items: filtered, updatedAt, source: "memory", stale, count: filtered.length };
  }

  const state = await db.collection(COLLECTION_STATE).findOne({ key: "news_feed" });
  const stateUpdatedAt = Number(state?.updatedAt || 0) || 0;
  const stale = !stateUpdatedAt || Date.now() - stateUpdatedAt > NEWS_STALE_MS;

  if (stale) {
    await refreshNewsFeed({ trigger: stateUpdatedAt ? "stale_read" : "cold_read" });
  }

  const filter = category === "all" ? {} : { category };
  const [items, refreshedState] = await Promise.all([
    db.collection(COLLECTION_NEWS).find(filter).sort({ publishedTs: -1 }).limit(limit).toArray(),
    db.collection(COLLECTION_STATE).findOne({ key: "news_feed" }),
  ]);
  const updatedAt = refreshedState?.updatedAt || state?.updatedAt || null;
  const isStale = !updatedAt || Date.now() - Number(updatedAt) > NEWS_STALE_MS;
  return { items, updatedAt, source: "db", stale: isStale, count: items.length };
};

export const subscribeNewsUpdates = (listener) => {
  emitter.on("news:update", listener);
  return () => emitter.off("news:update", listener);
};

export const startNewsIngestionScheduler = ({ intervalMs = 15 * 60 * 1000 } = {}) => {
  if (scheduler) return;
  refreshNewsFeed({ trigger: "startup" }).catch(() => undefined);
  scheduler = setInterval(() => {
    refreshNewsFeed({ trigger: "scheduled" }).catch(() => undefined);
  }, intervalMs);
  scheduler.unref?.();
};

export const stopNewsIngestionScheduler = () => {
  if (!scheduler) return;
  clearInterval(scheduler);
  scheduler = null;
};
