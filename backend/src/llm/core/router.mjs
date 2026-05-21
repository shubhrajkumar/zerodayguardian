import { env } from "../../config/env.mjs";
import { ROUTING_MODES } from "./constants.mjs";
import { rankProviders } from "./decisionEngine.mjs";

const uniq = (items) => [...new Set(items.filter(Boolean))];

const weightedList = (weights) => {
  const out = [];
  for (const [name, weight] of Object.entries(weights)) {
    const count = Math.max(1, Math.floor(weight));
    for (let i = 0; i < count; i += 1) out.push(name);
  }
  return out;
};

export class ProviderRouter {
  constructor({ healthStore, circuitBreaker, providers, costs }) {
    this.healthStore = healthStore;
    this.circuitBreaker = circuitBreaker;
    this.providers = providers;
    this.costs = costs;
    this.pointer = 0;
    this.weightedPool = weightedList(env.providerWeights);
  }

  async healthyCandidates(order) {
    const result = [];
    for (const provider of order) {
      if (!this.providers[provider]) continue;
      const allowed = await this.circuitBreaker.canAttempt(provider);
      if (!allowed) continue;
      result.push(provider);
    }
    return uniq(result);
  }

  nextWeighted() {
    if (!this.weightedPool.length) return [];
    this.pointer = (this.pointer + 1) % this.weightedPool.length;
    const first = this.weightedPool[this.pointer];
    return uniq([first, ...this.weightedPool.slice(this.pointer + 1), ...this.weightedPool.slice(0, this.pointer)]);
  }

  orderedByMode(request = {}) {
    const activeProviders = env.activeProviderOrder?.length ? env.activeProviderOrder : ["ollama"];

    if (env.routingMode === ROUTING_MODES.FAILOVER) {
      return activeProviders;
    }
    if (env.routingMode === ROUTING_MODES.WEIGHTED) {
      return this.nextWeighted().filter((provider) => activeProviders.includes(provider));
    }
    return activeProviders;
  }

  async choose(request = {}) {
    const baseOrder = this.orderedByMode(request);
    const candidates = await this.healthyCandidates(baseOrder);
    if (!candidates.length) return [];
    if (env.llmMode !== "auto") return candidates;
    if (env.routingMode === ROUTING_MODES.FAILOVER || env.routingMode === ROUTING_MODES.PRIMARY) return candidates;

    const snapshots = {};
    for (const provider of candidates) snapshots[provider] = this.healthStore.snapshot(provider);
    const ranked = rankProviders({
      candidates,
      snapshots,
      costs: this.costs,
      latencyThresholdMs: env.llmMaxLatencyMs,
      userTier: request.userTier || "free",
    });
    return ranked.map((item) => item.provider);
  }
}
