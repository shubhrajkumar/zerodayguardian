import { randomUUID } from "node:crypto";
import { getRedis } from "../../src/config/redis.mjs";
import { withSpan } from "../../src/observability/telemetry.mjs";

const MAX_EVENTS = 2200;
const STREAM_TTL_SEC = 60 * 60 * 6;
const LOCK_TTL_MS = 30000;
const renewTimers = new Map();
const localControllers = new Map();
const localJobs = new Map();

const checkpointKey = (id) => `stream:checkpoint:${id}`;
const eventsKey = (id) => `stream:events:${id}`;
const lockKey = (id) => `stream:lock:${id}`;
const flattenHash = (record = {}) =>
  Object.entries(record).flatMap(([field, value]) => [field, String(value ?? "")]);

const parseCheckpoint = (raw = {}) => {
  if (!raw || !raw.streamId) return null;
  return {
    streamId: raw.streamId,
    sessionId: raw.sessionId,
    userId: raw.userId || null,
    status: raw.status || "running",
    seq: Number(raw.seq || 0),
    minSeq: Number(raw.minSeq || 1),
    partialText: raw.partialText || "",
    finalText: raw.finalText || "",
    degraded: raw.degraded === "1",
    errorCode: raw.errorCode || "",
    requestMessage: raw.requestMessage || "",
    activeTopic: raw.activeTopic ? JSON.parse(raw.activeTopic) : null,
    createdAt: Number(raw.createdAt || 0),
    updatedAt: Number(raw.updatedAt || 0),
  };
};

const ownerAllowed = (stream, sessionId, userId = null) => {
  if (!stream || stream.sessionId !== sessionId) return false;
  if (!stream.userId) return true;
  return !!userId && stream.userId === userId;
};

const releaseLockScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

const renewLockScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("PEXPIRE", KEYS[1], ARGV[2])
else
  return 0
end
`;

export const createStreamCheckpoint = async ({ sessionId, userId = null, requestMessage, activeTopic = null }) => {
  const redis = getRedis();
  const streamId = randomUUID();
  const now = Date.now();
  const checkpoint = {
    streamId,
    sessionId,
    userId: userId || "",
    status: "running",
    seq: "0",
    minSeq: "1",
    partialText: "",
    finalText: "",
    degraded: "0",
    errorCode: "",
    requestMessage: requestMessage || "",
    activeTopic: activeTopic ? JSON.stringify(activeTopic) : "",
    createdAt: String(now),
    updatedAt: String(now),
  };

  await withSpan("redis.stream.create", { stream_id: streamId }, async () => {
    const multi = redis.multi();
    multi.hSet(checkpointKey(streamId), ...flattenHash(checkpoint));
    multi.expire(checkpointKey(streamId), STREAM_TTL_SEC);
    multi.expire(eventsKey(streamId), STREAM_TTL_SEC);
    await multi.exec();
  });

  return parseCheckpoint(checkpoint);
};

export const getStreamCheckpoint = async ({ streamId, sessionId, userId = null }) => {
  const redis = getRedis();
  const [raw, rawEvents] = await withSpan("redis.stream.get", { stream_id: streamId }, () =>
    Promise.all([redis.hGetAll(checkpointKey(streamId)), redis.lRange(eventsKey(streamId), 0, -1)])
  );
  const checkpoint = parseCheckpoint(raw);
  if (!ownerAllowed(checkpoint, sessionId, userId)) return null;
  const events = rawEvents
    .map((entry) => {
      try {
        return JSON.parse(entry);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return { ...checkpoint, events };
};

export const appendStreamToken = async ({ streamId, sessionId, userId = null, seq, token, partialText }) => {
  const redis = getRedis();
  const checkpoint = await getStreamCheckpoint({ streamId, sessionId, userId });
  if (!checkpoint) return null;
  const event = { seq, token, ts: Date.now() };
  const minSeq = Math.max(1, seq - MAX_EVENTS + 1);
  await withSpan("redis.stream.append_token", { stream_id: streamId, seq }, async () => {
    const multi = redis.multi();
    multi.rPush(eventsKey(streamId), JSON.stringify(event));
    multi.lTrim(eventsKey(streamId), -MAX_EVENTS, -1);
    multi.hSet(
      checkpointKey(streamId),
      ...flattenHash({
        seq: String(seq),
        minSeq: String(minSeq),
        partialText,
        updatedAt: String(Date.now()),
      })
    );
    multi.expire(checkpointKey(streamId), STREAM_TTL_SEC);
    multi.expire(eventsKey(streamId), STREAM_TTL_SEC);
    await multi.exec();
  });
  return event;
};

export const completeStreamCheckpoint = async ({
  streamId,
  sessionId,
  userId = null,
  finalText,
  degraded = false,
  errorCode = "",
}) => {
  const redis = getRedis();
  const checkpoint = await getStreamCheckpoint({ streamId, sessionId, userId });
  if (!checkpoint) return;
  await withSpan("redis.stream.complete", { stream_id: streamId }, async () => {
    await redis.hSet(
      checkpointKey(streamId),
      ...flattenHash({
        status: "done",
        finalText: finalText || "",
        degraded: degraded ? "1" : "0",
        errorCode: errorCode || "",
        updatedAt: String(Date.now()),
      })
    );
    await redis.expire(checkpointKey(streamId), STREAM_TTL_SEC);
  });
};

export const failStreamCheckpoint = async ({ streamId, sessionId, userId = null, errorCode = "stream_failed" }) => {
  const redis = getRedis();
  const checkpoint = await getStreamCheckpoint({ streamId, sessionId, userId });
  if (!checkpoint) return;
  await withSpan("redis.stream.fail", { stream_id: streamId }, async () => {
    await redis.hSet(
      checkpointKey(streamId),
      ...flattenHash({
        status: "error",
        errorCode,
        updatedAt: String(Date.now()),
      })
    );
    await redis.expire(checkpointKey(streamId), STREAM_TTL_SEC);
  });
};

export const replayEventsAfter = (stream, seq) =>
  (stream?.events || []).filter((event) => Number(event.seq || 0) > Number(seq || 0));

const acquireStreamLock = async (streamId, ownerId, ttlMs = LOCK_TTL_MS) => {
  const redis = getRedis();
  const result = await redis.set(lockKey(streamId), ownerId, { PX: ttlMs, NX: true });
  return result === "OK";
};

const renewStreamLock = async (streamId, ownerId, ttlMs = LOCK_TTL_MS) => {
  const redis = getRedis();
  const result = await redis.eval(renewLockScript, {
    keys: [lockKey(streamId)],
    arguments: [ownerId, String(ttlMs)],
  });
  return Number(result || 0) > 0;
};

const releaseStreamLock = async (streamId, ownerId) => {
  const redis = getRedis();
  await redis.eval(releaseLockScript, {
    keys: [lockKey(streamId)],
    arguments: [ownerId],
  });
};

const clearRenewTimer = (streamId) => {
  const timer = renewTimers.get(streamId);
  if (timer) {
    clearInterval(timer);
    renewTimers.delete(streamId);
  }
};

export const startStreamGenerator = async (streamId, runner) => {
  const ownerId = randomUUID();
  const acquired = await acquireStreamLock(streamId, ownerId);
  if (!acquired) return { started: false };
  if (localJobs.has(streamId)) {
    await releaseStreamLock(streamId, ownerId);
    return { started: false };
  }

  const renewTimer = setInterval(async () => {
    const ok = await renewStreamLock(streamId, ownerId);
    if (!ok) clearRenewTimer(streamId);
  }, Math.floor(LOCK_TTL_MS / 3));
  renewTimers.set(streamId, renewTimer);

  const job = Promise.resolve()
    .then(() =>
      runner({
        registerAbortController: (controller) => localControllers.set(streamId, controller),
      })
    )
    .finally(async () => {
      clearRenewTimer(streamId);
      localControllers.delete(streamId);
      localJobs.delete(streamId);
      await releaseStreamLock(streamId, ownerId);
    });

  localJobs.set(streamId, job);
  return { started: true, ownerId, job };
};

export const isStreamGenerating = async (streamId) => {
  if (localJobs.has(streamId)) return true;
  const redis = getRedis();
  return !!(await redis.get(lockKey(streamId)));
};

export const attachStreamAbortController = (streamId, controller) => {
  localControllers.set(streamId, controller);
};

export const abortStreamGeneration = (streamId) => {
  const controller = localControllers.get(streamId);
  if (controller) controller.abort();
};

export const hasStreamStore = () => {
  try {
    getRedis();
    return true;
  } catch {
    return false;
  }
};
