# Zorvix Backend Migration Plan (Old -> New)

This document maps legacy paths to the new modular backend structure. Legacy paths remain as compatibility shims.

## Routes
- `backend/src/routes/authRoutes.mjs` -> `backend/api/auth/authRoutes.mjs`
- `backend/src/routes/neurobotRoutes.mjs` -> `backend/api/ai/neurobotRoutes.mjs`
- `backend/src/routes/intelligenceRoutes.mjs` -> `backend/api/tools/intelligenceRoutes.mjs`

## Services
- `backend/src/services/authService.mjs` -> `backend/services/security-service/authService.mjs`
- `backend/src/services/conversationService.mjs` -> `backend/services/memory-service/conversationService.mjs`
- `backend/src/services/memoryService.mjs` -> `backend/services/memory-service/memoryService.mjs`
- `backend/src/services/knowledgeBaseService.mjs` -> `backend/services/knowledge-base/knowledgeBaseService.mjs`
- `backend/src/services/newsService.mjs` -> `backend/services/knowledge-base/newsService.mjs`
- `backend/src/services/llmService.mjs` -> `backend/services/ai-engine/llmService.mjs`
- `backend/src/services/streamService.mjs` -> `backend/services/ai-engine/streamService.mjs`
- `backend/src/services/trainingService.mjs` -> `backend/services/ai-engine/trainingService.mjs`
- `backend/src/services/labSandboxService.mjs` -> `backend/services/ai-engine/labSandboxService.mjs`
- `backend/src/services/ttsService.mjs` -> `backend/services/ai-engine/ttsService.mjs`
- `backend/src/services/intelligenceService.mjs` -> `backend/services/ai-engine/intelligenceService.mjs`
- `backend/src/services/probeService.mjs` -> `backend/monitoring/performance/probeService.mjs`

## Compatibility Shims
Legacy imports still work via thin re-export files in:
- `backend/src/routes/*`
- `backend/src/services/*`

## Import Updates
New modules import shared infra from `backend/src/*` using `../../src/...` paths to avoid relocating core runtime code.

## Next Steps (Optional)
1. Update `backend/src/app.mjs` to import routes directly from `backend/api/*`.
2. Gradually migrate `backend/src/config`, `backend/src/middleware`, and `backend/src/observability` into the new structure if desired.
3. Remove shims after all internal imports are updated to new paths.
