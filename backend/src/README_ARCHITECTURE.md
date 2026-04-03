# ZeroDay-Guardian Backend Architecture

This backend is organized by functional layers with stable boundaries:

- `routes/`: stable HTTP and SSE contracts for the frontend.
- `ai-engine/`: Zorvix orchestration layer.
- `tools/`: isolated cybersecurity, search, research, and learning modules.
- `services/llm*`: provider routing, retries, health, and streaming.
- `services/conversation*`: persistence and session memory.
- `labs/`: sandbox and learning-lab execution boundary.
- `auth/`: auth middleware/service boundary and session trust model.
- `telemetry/`: logging, metrics, tracing, and alerting.

Zorvix request flow:

1. User request enters `routes/neurobotRoutes.mjs`.
2. The AI orchestration layer prepares tool context and a response blueprint.
3. Tool modules execute independently with per-module timeouts.
4. The LLM layer streams or generates a response with provider failover.
5. Route handlers validate output and return either a normal reply, a graceful degraded reply, or a structured transport error.

Compatibility note:
- Existing route contracts are preserved; layered modules wrap current services to avoid frontend breakage.

## Platform Architecture Endpoint

The backend exposes a secure architecture summary for operational tooling:

- `GET /api/platform/architecture`

This returns the active service modules, AI routing strategy, performance targets, and extensibility guarantees from `backend/src/config/platform.mjs`.
