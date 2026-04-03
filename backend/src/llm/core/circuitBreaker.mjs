import { getRedis } from "../../config/redis.mjs";
import { CIRCUIT_STATES } from "./constants.mjs";

const keyFor = (provider) => `llm:circuit:${provider}`;

const localState = new Map();

const now = () => Date.now();

const defaultState = () => ({
  state: CIRCUIT_STATES.CLOSED,
  failures: 0,
  openUntil: 0,
  halfOpenSuccesses: 0,
  halfOpenAttempts: 0,
  updatedAt: now(),
});

const normalize = (raw) => {
  if (!raw) return defaultState();
  const state = raw.state || CIRCUIT_STATES.CLOSED;
  return {
    state,
    failures: Number(raw.failures || 0),
    openUntil: Number(raw.openUntil || 0),
    halfOpenSuccesses: Number(raw.halfOpenSuccesses || 0),
    halfOpenAttempts: Number(raw.halfOpenAttempts || 0),
    updatedAt: Number(raw.updatedAt || now()),
  };
};

const safeRedis = () => {
  try {
    return getRedis();
  } catch {
    return null;
  }
};
const flattenHash = (record = {}) =>
  Object.entries(record).flatMap(([field, value]) => [field, String(value ?? "")]);

const read = async (provider) => {
  const redis = safeRedis();
  if (!redis) {
    if (!localState.has(provider)) localState.set(provider, defaultState());
    return normalize(localState.get(provider));
  }
  const raw = await redis.hGetAll(keyFor(provider));
  if (!raw || !raw.state) {
    const fallback = defaultState();
    await redis.hSet(keyFor(provider), ...flattenHash(fallback));
    await redis.expire(keyFor(provider), 3600);
    return fallback;
  }
  return normalize(raw);
};

const write = async (provider, state) => {
  const next = { ...state, updatedAt: now() };
  localState.set(provider, next);
  const redis = safeRedis();
  if (!redis) return next;
  await redis.hSet(keyFor(provider), ...flattenHash(next));
  await redis.expire(keyFor(provider), 3600);
  return next;
};

export class CircuitBreakerRegistry {
  constructor({ failureThreshold, openMs, halfOpenProbeCount }) {
    this.failureThreshold = failureThreshold;
    this.openMs = openMs;
    this.halfOpenProbeCount = halfOpenProbeCount;
  }

  async canAttempt(provider) {
    const state = await read(provider);
    if (state.state === CIRCUIT_STATES.CLOSED) return true;
    if (state.state === CIRCUIT_STATES.OPEN) {
      if (now() < state.openUntil) return false;
      await write(provider, {
        ...state,
        state: CIRCUIT_STATES.HALF_OPEN,
        failures: 0,
        halfOpenAttempts: 0,
        halfOpenSuccesses: 0,
        openUntil: 0,
      });
      return true;
    }
    if (state.state === CIRCUIT_STATES.HALF_OPEN) {
      return state.halfOpenAttempts < this.halfOpenProbeCount;
    }
    return false;
  }

  async markSuccess(provider) {
    const state = await read(provider);
    if (state.state === CIRCUIT_STATES.HALF_OPEN) {
      const next = {
        ...state,
        halfOpenAttempts: state.halfOpenAttempts + 1,
        halfOpenSuccesses: state.halfOpenSuccesses + 1,
      };
      if (next.halfOpenSuccesses >= this.halfOpenProbeCount) {
        await write(provider, {
          ...next,
          state: CIRCUIT_STATES.CLOSED,
          failures: 0,
          halfOpenAttempts: 0,
          halfOpenSuccesses: 0,
          openUntil: 0,
        });
        return;
      }
      await write(provider, next);
      return;
    }
    await write(provider, { ...state, state: CIRCUIT_STATES.CLOSED, failures: 0, openUntil: 0 });
  }

  async markFailure(provider, options = {}) {
    const openMs = Math.max(this.openMs, Number(options.openMs || 0) || 0);
    const immediateOpen = options.immediateOpen === true;
    const state = await read(provider);
    if (state.state === CIRCUIT_STATES.HALF_OPEN) {
      await write(provider, {
        ...state,
        state: CIRCUIT_STATES.OPEN,
        failures: 0,
        openUntil: now() + openMs,
        halfOpenAttempts: 0,
        halfOpenSuccesses: 0,
      });
      return;
    }

    const failures = state.failures + 1;
    if (immediateOpen || failures >= this.failureThreshold) {
      await write(provider, {
        ...state,
        state: CIRCUIT_STATES.OPEN,
        failures,
        openUntil: now() + openMs,
      });
      return;
    }
    await write(provider, { ...state, failures });
  }

  async getState(provider) {
    return read(provider);
  }
}
