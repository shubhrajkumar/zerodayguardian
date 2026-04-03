const MAX_POINTS = 80;

const createState = () => ({
  latencies: [],
  total: 0,
  failures: 0,
  timeouts: 0,
  quotaExceededUntil: 0,
  lastErrorAt: 0,
  usage: {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  },
});

export class ProviderHealthStore {
  constructor(providers = []) {
    this.states = new Map();
    for (const provider of providers) this.states.set(provider, createState());
  }

  ensure(provider) {
    if (!this.states.has(provider)) this.states.set(provider, createState());
    return this.states.get(provider);
  }

  recordSuccess(provider, { latencyMs = 0, usage = null } = {}) {
    const s = this.ensure(provider);
    s.total += 1;
    if (latencyMs > 0) {
      s.latencies.push(latencyMs);
      if (s.latencies.length > MAX_POINTS) s.latencies.shift();
    }
    if (usage) {
      s.usage.promptTokens += Number(usage.promptTokens || 0);
      s.usage.completionTokens += Number(usage.completionTokens || 0);
      s.usage.totalTokens += Number(usage.totalTokens || 0);
    }
  }

  recordFailure(provider, { timeout = false, quotaExceeded = false, retryAfterSec = 0 } = {}) {
    const s = this.ensure(provider);
    s.total += 1;
    s.failures += 1;
    s.lastErrorAt = Date.now();
    if (timeout) s.timeouts += 1;
    if (quotaExceeded) {
      const retryAfterMs = Math.max(30_000, Math.floor(Number(retryAfterSec || 0) * 1000));
      s.quotaExceededUntil = Date.now() + retryAfterMs;
    }
  }

  snapshot(provider) {
    const s = this.ensure(provider);
    const samples = s.latencies.length || 1;
    const avgLatency = s.latencies.length ? s.latencies.reduce((a, b) => a + b, 0) / samples : 9999;
    return {
      avgLatency,
      errorRate: s.total > 0 ? s.failures / s.total : 0,
      timeoutRate: s.total > 0 ? s.timeouts / s.total : 0,
      quotaExceeded: Date.now() < s.quotaExceededUntil,
      usage: { ...s.usage },
    };
  }
}
