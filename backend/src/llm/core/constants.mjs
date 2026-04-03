export const PROVIDERS = Object.freeze({
  OLLAMA: "ollama",
  OLLAMA_BACKUP: "ollama_backup",
});

export const CIRCUIT_STATES = Object.freeze({
  CLOSED: "CLOSED",
  OPEN: "OPEN",
  HALF_OPEN: "HALF_OPEN",
});

export const ROUTING_MODES = Object.freeze({
  PRIMARY: "primary",
  WEIGHTED: "weighted",
  FAILOVER: "failover",
});
