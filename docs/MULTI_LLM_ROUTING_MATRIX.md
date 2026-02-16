# Multi-LLM Routing Matrix

Spawner uses capability-aware routing when `Auto-route by task type` is enabled.

## Task Pattern -> Capability

- code/api/backend/frontend/refactor/fix -> `code_analysis`
- test/qa/verify/regression -> `code_analysis`
- image/logo/banner/thumbnail -> `image_gen`
- video/reel/animation/clip -> `video_gen`
- audio/voice/podcast/music -> `audio_gen`
- search/research/discover -> `web_search`
- database/schema/migration/sql -> `database`
- deploy/release/infra/ci/cd -> `deployment`

## Capability -> Typical Provider

- `code_analysis`: Codex, Claude, OpenAI, Minimax, Kimi
- `image_gen`: OpenAI, Replicate
- `video_gen`: Runway, Replicate
- `audio_gen`: OpenAI
- `web_search`: Kimi, OpenAI
- `database`: Codex (+ database MCPs)
- `deployment`: Codex (+ deployment MCPs)

## MCP Capability Boosts

Connected MCP capabilities are injected into routing context:
- `database` MCPs strengthen DB task routing.
- `image_gen`/`video_gen` MCPs strengthen media routing.
- `web_search` MCPs strengthen research routing.
- `deployment` MCPs strengthen release/infra routing.

## Practical Recommendation

For best results:
1. Configure API keys for at least one code model and one media model.
2. Keep `Auto-enable by API keys` on.
3. Keep `Auto-route by task type` on.
4. Connect relevant MCPs for your workflow domain.
