import { env } from "../../config/env.mjs";

const normalizeLatency = (value, threshold) => Math.max(0, Math.min(3, value / Math.max(1, threshold)));
const normalizeCost = (value, min, max) => {
  if (max <= min) return 0;
  return (value - min) / (max - min);
};

export const rankProviders = ({ candidates, snapshots, costs, latencyThresholdMs, userTier }) => {
  const tierOrder =
    userTier === "premium" ? env.premiumTierProviderOrder : userTier === "free" ? env.freeTierProviderOrder : [];
  const effective = [...candidates].sort((a, b) => {
    const ai = tierOrder.indexOf(a);
    const bi = tierOrder.indexOf(b);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const range = {
    min: Math.min(...effective.map((p) => costs[p] || 1)),
    max: Math.max(...effective.map((p) => costs[p] || 1)),
  };

  return effective
    .map((provider) => {
      const stats = snapshots[provider] || {};
      const quotaPenalty = stats.quotaExceeded ? 3 : 0;
      const costScore = normalizeCost(costs[provider] || 1, range.min, range.max);
      const latencyScore = normalizeLatency(stats.avgLatency || latencyThresholdMs * 2, latencyThresholdMs);
      const errorScore = Math.max(0, Math.min(1, stats.errorRate || 0));
      const score =
        costScore * env.llmCostWeight +
        latencyScore * env.llmLatencyWeight +
        errorScore * env.llmErrorWeight +
        quotaPenalty;
      return { provider, score };
    })
    .sort((a, b) => a.score - b.score);
};
