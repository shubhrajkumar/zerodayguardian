export class TtlCache {
  constructor({ ttlMs = 5000, maxEntries = 256 } = {}) {
    this.ttlMs = Math.max(250, Number(ttlMs || 5000));
    this.maxEntries = Math.max(1, Number(maxEntries || 256));
    this.store = new Map();
    this.inFlight = new Map();
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key, value, ttlOverrideMs = null) {
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    const ttlMs = ttlOverrideMs == null ? this.ttlMs : Math.max(100, Number(ttlOverrideMs || this.ttlMs));
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    return value;
  }

  async getOrCreate(key, producer, ttlOverrideMs = null) {
    const cached = this.get(key);
    if (cached !== null) return cached;

    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }

    const work = Promise.resolve()
      .then(() => producer())
      .then((value) => {
        this.set(key, value, ttlOverrideMs);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, work);
    return work;
  }

  delete(key) {
    this.store.delete(key);
    this.inFlight.delete(key);
  }

  clear() {
    this.store.clear();
    this.inFlight.clear();
  }
}
