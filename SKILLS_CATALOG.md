# Spawner UI - Skills Catalog

**Generated:** 2026-05-03
**Totals:** 613 skills across 37 categories

## Canonical Locations

**Primary source of truth:** `spark-skill-graphs` repo - https://github.com/vibeforge1111/spark-skill-graphs

| What | Path |
|---|---|
| **Primary source (YAML, H70-C+ format)** | `<workspace>/spark-skill-graphs/{category}/{skill-id}.yaml` |
| **Upstream repo** | `https://github.com/vibeforge1111/spark-skill-graphs` (remote `origin`) |
| **Build-script env override** | `SPAWNER_H70_SKILLS_DIR` or `H70_SKILLS_LAB_DIR` |
| **UI metadata index (built from source)** | `<workspace>/spawner-ui/static/skills.json` |
| **Collaboration graph** | `<workspace>/spawner-ui/static/skill-collaboration.json` |
| **Skill catalog (owns + context for Claude)** | `<workspace>/spawner-ui/src/lib/data/skill-catalog.json` |
| **Matcher catalog** | `<workspace>/spawner-ui/src/lib/data/skill-matcher-catalog.json` |
| **Catalog/index builders** | `spawner-ui/scripts/sync-spark-skill-graphs.cjs`, `build-skill-catalog.cjs`, `build-skill-index.cjs` |
| **API (single skill, full YAML)** | `GET http://localhost:5173/api/h70-skills/{skillId}` |
| **MCP fallback** | `https://mcp.vibeship.co/mcp` |

**Loading order at runtime:** local YAML in `spark-skill-graphs` (via `/api/h70-skills/[skillId]`) -> MCP fallback. Local wins; MCP is only hit if the skill is not in the repo.

**How to open a skill on disk:** `<workspace>/spark-skill-graphs/<category>/<id>.yaml` - the `<category>` column below matches the folder name exactly.

> Note: `<workspace>/vibeship-skills-lab` is the authoring/tooling workspace (validator, graph builder, MCP server). The spawner UI reads directly from `spark-skill-graphs`, not from the lab.

## Category Summary

| Category | Count |
|---|---|
| [`ai`](#ai) | 35 |
| [`ai-agents`](#ai-agents) | 28 |
| [`architecture`](#architecture) | 2 |
| [`backend`](#backend) | 65 |
| [`biotech`](#biotech) | 6 |
| [`blockchain`](#blockchain) | 21 |
| [`business`](#business) | 13 |
| [`climate`](#climate) | 5 |
| [`communications`](#communications) | 8 |
| [`community`](#community) | 14 |
| [`creative`](#creative) | 21 |
| [`data`](#data) | 22 |
| [`design`](#design) | 14 |
| [`development`](#development) | 27 |
| [`devops`](#devops) | 35 |
| [`ecommerce`](#ecommerce) | 3 |
| [`education`](#education) | 3 |
| [`engineering`](#engineering) | 11 |
| [`enterprise`](#enterprise) | 5 |
| [`finance`](#finance) | 7 |
| [`frameworks`](#frameworks) | 13 |
| [`frontend`](#frontend) | 40 |
| [`game-dev`](#game-dev) | 45 |
| [`infrastructure`](#infrastructure) | 4 |
| [`integrations`](#integrations) | 27 |
| [`marketing`](#marketing) | 43 |
| [`mcp`](#mcp) | 4 |
| [`methodology`](#methodology) | 1 |
| [`performance`](#performance) | 1 |
| [`product`](#product) | 13 |
| [`science`](#science) | 1 |
| [`security`](#security) | 24 |
| [`space`](#space) | 6 |
| [`startup`](#startup) | 4 |
| [`strategy`](#strategy) | 28 |
| [`testing`](#testing) | 9 |
| [`trading`](#trading) | 5 |

## ai

_35 skills_

- **`ai-code-generation`** (premium) - Production-hardened patterns for AI code generation, function calling, automated refactoring, and structured output. Built from 6 years of shipping AI coding tools to 50,000+ developers.
- **`ai-for-learning`** (premium) - Expert in applying AI to education - AI tutors, personalized learning paths, content generation, automated assessments, and adaptive learning systems that enhance human instruction.
- **`ai-function-calling`** (premium) - LLM tool use and function calling patterns including schema definition, parallel calls, sequential chains, validation, sandboxing, and MCP integration
- **`ai-image-editing`** (premium) - Expert patterns for AI-powered image editing including inpainting, outpainting, ControlNet, image-to-image, and API integration with Replicate, Stability AI, and Fal
- **`ai-music-audio`** (premium) - Production patterns for AI audio generation including text-to-music (MusicGen, Lyria), voice synthesis (ElevenLabs), TTS pipelines, sound effects (AudioGen), and audio watermarking (AudioSeal). Built from 6 years shipping audio-first products.
- **`ai-observability`** (free) - Implement comprehensive observability for LLM applications including tracing (Langfuse/Helicone), cost tracking, token optimization, RAG evaluation metrics (RAGAS), hallucination detection, and production monitoring. Essential for debugging, optimizing costs, and ensuring AI output quality.
- **`ai-personalization`** (premium) - Building AI-powered personalization systems: recommendation engines, collaborative filtering, content-based filtering, user preference learning, cold-start solutions, and LLM-enhanced personalized experiences.
- **`ai-safety-alignment`** (premium) - Implement comprehensive safety guardrails for LLM applications including content moderation (OpenAI Moderation API), jailbreak prevention, prompt injection defense, PII detection, topic guardrails, and output validation. Essential for production AI applications handling user-generated content.
- **`ai-sdk-vercel`** (premium) - Vercel AI SDK patterns for building production AI-powered applications with streaming, tool calling, and multi-provider support
- **`ai-wrapper-product`** (premium) - Expert in building AI-powered products that wrap LLM APIs into focused, paid tools
- **`art-consistency`** (premium) - World-class character and art style consistency for AI-generated images and videos - ensures visual coherence across series, maintains character identity, and provides rigorous QA before delivery
- **`causal-scientist`** (premium) - Causal inference specialist for causal discovery, counterfactual reasoning, and effect estimation
- **`claude-api-integration`** (premium) - Anthropic Claude API integration patterns for production applications including Messages API, streaming, tool use, prompt caching, and cost management
- **`computer-vision-deep`** (premium) - Use when implementing object detection, semantic/instance segmentation, 3D vision, or video understanding - covers YOLO, SAM, depth estimation, and multi-modal vision
- **`cursor-ai`** (premium) - Expert in Cursor AI IDE - the leading AI-powered code editor covering Rules files, Plan Mode, Background Agents, and advanced AI-assisted development workflows
- **`development-ai-tools`** (premium) - Master AI coding assistants, code generation tools, and developer productivity automation
- **`distributed-training`** (premium) - Use when training models across multiple GPUs or nodes, handling large models that don't fit in memory, or optimizing training throughput - covers DDP, FSDP, DeepSpeed ZeRO, model/data parallelism, and gradient checkpointing
- **`document-ai`** (premium) - Comprehensive patterns for AI-powered document understanding including PDF parsing, OCR, invoice/receipt extraction, table extraction, multimodal RAG with vision models, and structured data output.
- **`llm-architect`** (free) - LLM application architecture expert for RAG, prompting, agents, and production AI systems
- **`llm-fine-tuning`** (premium) - Use when adapting large language models to specific tasks, domains, or behaviors - covers LoRA, QLoRA, PEFT, instruction tuning, and full fine-tuning strategies
- **`ml-memory`** (premium) - Memory systems specialist for hierarchical memory, consolidation, and outcome-based learning
- **`ml-ops`** (premium) - Production ML operations covering model training pipelines, registry, deployment, drift detection, A/B rollouts, and the observability gap between "model performs in notebook" and "model performs at 3am on Black Friday".
- **`model-optimization`** (premium) - Use when reducing model size, improving inference speed, or deploying to edge devices - covers quantization, pruning, knowledge distillation, ONNX export, and TensorRT optimization
- **`multimodal-ai`** (premium) - Production multimodal systems for text, image, audio, and document workflows with cost control, preprocessing, and reliability guardrails.
- **`neural-architecture-search`** (premium) - Use when automating model architecture design, optimizing hyperparameters, or exploring neural network configurations - covers NAS algorithms, search spaces, Bayesian optimization, and AutoML tools
- **`nlp-advanced`** (premium) - Use when extracting structured information from text - named entity recognition, relation extraction, coreference resolution, knowledge graph construction, and information extraction pipelines
- **`on-device-ai`** (premium) - Browser and edge on-device AI with WebGPU and WASM inference, quantization, caching, and offline-first model delivery.
- **`openai-api-patterns`** (premium) - OpenAI API integration patterns for production applications including Chat Completions, function calling, structured outputs, embeddings, and multimodal APIs
- **`reinforcement-learning`** (premium) - Use when implementing RL algorithms, training agents with rewards, or aligning LLMs with human feedback - covers policy gradients, PPO, Q-learning, RLHF, and GRPO
- **`semantic-search`** (premium) - Production-ready semantic search systems with vector databases, embeddings, RAG, and hybrid search
- **`spark-intelligence`** (premium) - Self-evolving AI memory and learning system - captures patterns, learns from mistakes, builds personality over time
- **`synthetic-data`** (premium) - Production-grade patterns for generating synthetic data for ML training, testing, and privacy-preserving analytics. Covers LLM-based generation, statistical tabular synthesis, quality validation, and privacy guarantees.
- **`text-to-video`** (premium) - Expert patterns for AI video generation including text-to-video, image-to-video, video editing, and API integration with Runway, Kling, Luma, Wan, and Replicate
- **`transformer-architecture`** (premium) - Use when implementing attention mechanisms, building custom transformer models, understanding positional encoding, or optimizing transformer inference - covers self-attention, multi-head attention, RoPE, ALiBi, FlashAttention, and architecture variants
- **`v0-dev`** (premium) - Expert in v0.dev AI-powered UI generation, prompt engineering, shadcn/ui integration, and production component workflows

## ai-agents

_28 skills_

- **`agent-communication`** (premium) - Inter-agent communication patterns including message passing, shared memory, blackboard systems, and event-driven architectures for LLM agents
- **`agent-evaluation`** (premium) - Testing and benchmarking LLM agents including behavioral testing, capability assessment, reliability metrics, and production monitoring - built from 7 years of agent failures
- **`agent-memory-systems`** (premium) - Persistent memory architectures for AI agents across short-term, semantic, episodic, and long-term recall without retrieval poisoning.
- **`agent-tool-builder`** (premium) - Build AI agent tools that work - not tools that hallucinate, loop, or fail silently
- **`ai-agent-permissions-sandboxing`** (premium) - Tool permissions, approval gates, and sandboxing for AI agents: declarative tool catalogs, per-action allowlists, side-effect classification, human-in-the-loop confirmations, filesystem/network containment, audit trails, and the patterns that prevent an agent from melting production via a clever prompt injection.
- **`ai-chatbot-builder`** (premium) - Building production chatbots with LLMs including conversation memory, guardrails, streaming UI, RAG integration, and multi-turn tool use
- **`ai-evals-dataset-curation`** (premium) - Eval dataset curation for LLM applications: golden sets, drift cases, adversarial examples, label quality, eval taxonomy, regression tracking, and the workflows that turn "vibes-driven" prompt iteration into measurable, defensible model + prompt changes.
- **`autonomous-agents`** (premium) - Autonomous agent loops with planning, reflection, guardrails, checkpoints, and human interrupt controls for production use.
- **`browser-automation`** (premium) - Expert in browser automation for testing, scraping, and AI agent interactions. Covers Playwright (recommended) and Puppeteer with production patterns for reliability, anti-detection, and debugging. Critical insight: 73% of automation failures come from bad selectors, 19% from timing issues, 8% from detection.
- **`computer-use-agents`** (premium) - Build AI agents that interact with computers like humans do - viewing screens, moving cursors, clicking buttons, and typing text. Covers Anthropic's Computer Use, OpenAI's Operator/CUA, and open-source alternatives. Critical focus on sandboxing, security, and handling the unique challenges of vision-based control.
- **`context-window-management`** (premium) - Production strategies for managing LLM context windows including summarization, trimming, routing, and avoiding the $3.2M context rot disaster
- **`conversation-memory`** (premium) - Persistent memory systems for LLM conversations including short-term, long-term, and entity-based memory with production-hardened patterns
- **`conversational-intent-design`** (premium) - Expert at designing conversational intent systems that feel like a human, not a help-desk form. Covers hybrid rule+LLM routing, disjoint intent taxonomy, confidence gating, disambiguation turns, tone mirroring, and humanized outputs. Builds chat surfaces that read the room and match the user's energy instead of dumping fields.
- **`crewai`** (premium) - Expert in CrewAI - the leading role-based multi-agent framework used by 60% of Fortune 500 companies. Covers agent design with roles and goals, task definition, crew orchestration, process types (sequential, hierarchical, parallel), memory systems, and flows for complex workflows. Essential for building collaborative AI agent teams.
- **`human-in-the-loop-review`** (premium) - Human-in-the-loop (HITL) review systems for AI agents and ML pipelines: review queues, confidence thresholds, escalation policies, reviewer UX, inter-rater agreement, throughput SLAs, and the workflows that turn AI output into auditable human-supervised decisions without burning out reviewers.
- **`langfuse`** (premium) - Expert in Langfuse - the open-source LLM observability platform. Covers tracing, prompt management, evaluation, datasets, and integration with LangChain, LlamaIndex, and OpenAI. Essential for debugging, monitoring, and improving LLM applications in production.
- **`langgraph`** (premium) - Expert in LangGraph - the production-grade framework for building stateful, multi-actor AI applications. Covers graph construction, state management, cycles and branches, persistence with checkpointers, human-in-the-loop patterns, and the ReAct agent pattern. Used in production at LinkedIn, Uber, and 400+ companies.
- **`llm-cost-governance`** (premium) - LLM cost governance: budgets per user / tenant / feature, prompt caching, model routing (cheap vs expensive), per-call cost attribution, cost anomaly detection, and the patterns that prevent a single bug from burning $50K of OpenAI credits before sunrise.
- **`multi-agent-orchestration`** (premium) - Production patterns for coordinating multiple LLM agents - sequential, parallel, router, and hierarchical architectures
- **`multi-modal-upload-intake`** (premium) - Multi-modal upload intake for AI workflows: images, audio, video, PDFs, spreadsheets normalized into a canonical representation the model can consume. Format detection, conversion (HEIC→JPEG, WebM→WAV), size bounds, OCR/transcription gates, and the safety + cost discipline that prevents adversarial inputs from melting the pipeline.
- **`prompt-caching`** (premium) - Caching strategies for LLM prompts including Anthropic prompt caching, response caching, and CAG (Cache Augmented Generation)
- **`prompt-engineer`** (free) - Expert in designing effective prompts for LLM-powered applications. Masters prompt structure, context management, output formatting, few-shot design, chain-of-thought reasoning, and systematic prompt evaluation. Used to build prompts at scale for customer-facing AI products serving millions of users.
- **`prompt-versioning-release-management`** (premium) - Prompt registry, versioning, A/B-able rollout, rollback, and changelog management. Treats prompts as code: reviewed in PRs, eval-gated, versioned, deployable per-environment, with per-prompt-version observability and clean rollback.
- **`rag-implementation`** (premium) - Retrieval-Augmented Generation patterns including chunking, embeddings, vector stores, reranking, and production-grade retrieval optimization
- **`voice-agents`** (premium) - Production voice agent systems with STT, TTS, turn-taking, interruption handling, realtime APIs, and low-latency voice UX.
- **`voice-ai-development`** (premium) - Expert in building voice AI applications - from real-time voice agents to voice-enabled apps. Covers OpenAI Realtime API, Vapi for voice agents, Deepgram for transcription, ElevenLabs for synthesis, LiveKit for real-time infrastructure, and WebRTC fundamentals.
- **`workflow-automation`** (premium) - Durable execution and event-driven workflow orchestration for production AI systems
- **`zapier-make-patterns`** (premium) - Expert in no-code automation platforms - Zapier (7000+ integrations, simplicity-first) and Make/Integromat (visual branching, operations-based pricing). Covers trigger-action workflows, multi-step automations, error handling, and knowing when to graduate to code. Used by 10M+ businesses for process automation.

## architecture

_2 skills_

- **`edge-first-architecture`** (premium) - Edge computing with Vercel Edge, Cloudflare Workers, edge databases, geo-routing, and caching
- **`local-first-sync`** (premium) - Local-first apps with CRDTs, sync engines, offline-first patterns, and conflict resolution

## backend

_65 skills_

- **`algolia-search`** (premium) - Expert patterns for Algolia search implementation, React InstantSearch, indexing strategies, and relevance tuning
- **`api-design`** (free) - Expert at designing clean, consistent, and developer-friendly APIs. Covers RESTful conventions, versioning strategies, error handling, pagination, rate limiting, and OpenAPI documentation. Designs APIs that are intuitive to use and easy to evolve.
- **`api-designer`** (premium) - API design specialist for REST, GraphQL, gRPC, versioning strategies, OpenAPI/Swagger, pagination, rate limiting, and developer experience
- **`audit-trail-activity-feed`** (premium) - Append-only audit trails and user-visible activity feeds: data model for events, action catalog, actor/target/diff capture, tamper resistance, retention, redaction, and the read API that powers admin investigations, customer trust dashboards, and compliance exports.
- **`automation`** (premium) - Mass-production workflow automation engineer with battle scars from broken Zaps, infinite loops, and silent failures that cost real money.
- **`backend-engineer`** (premium) - World-class backend engineering - distributed systems, database architecture, API design, and the battle scars from scaling systems that handle millions of requests
- **`caching-patterns`** (premium) - World-class caching strategies - cache invalidation, Redis patterns, CDN caching, and the battle scars from cache bugs that served stale data for hours
- **`calendar-booking-systems`** (premium) - Production-grade booking, availability, and scheduling systems with timezone-safe math, double-booking prevention, rescheduling, reminders, and calendar provider integrations (Google Calendar, Microsoft Graph, CalDAV).
- **`cloudflare-workers-deep`** (premium) - Production-grade Cloudflare Workers expertise covering V8 isolates, KV, R2, D1, Durable Objects, edge frameworks, and cost optimization
- **`cron-scheduled-jobs`** (premium) - Scheduled jobs with node-cron, Vercel Cron, Inngest, job locking, monitoring, and timezone handling
- **`database-architect`** (free) - Database design specialist for schema modeling, query optimization, indexing strategies, and data integrity - battle-tested across billions of rows and countless production incidents
- **`email-deliverability`** (premium) - Expert guidance on email infrastructure, authentication, reputation management, and deliverability optimization for transactional and marketing emails at scale
- **`error-handling`** (free) - Expert at building resilient applications through proper error handling, Result types, error boundaries, typed errors, and graceful degradation
- **`event-architect`** (premium) - Event sourcing and CQRS expert who has built event stores processing millions of events per second
- **`file-processing-pipelines`** (premium) - Async file-processing pipelines that run after upload: virus scanning, format conversion, image thumbnails, EXIF stripping, OCR, metadata extraction, content moderation. Built on durable queues with idempotency and partial-failure recovery.
- **`file-uploads`** (premium) - S3, R2, presigned URLs, multipart uploads, and secure file handling for production systems
- **`firebase`** (premium) - Production Firebase development - Firestore, Auth, Cloud Functions, and security rules
- **`gcp-cloud-run`** (premium) - Expert patterns for GCP Cloud Run services, functions, cold start optimization, and event-driven architecture
- **`go-services`** (premium) - Production Go service development with idiomatic patterns, concurrency safety, and battle-tested architectures
- **`graphql`** (premium) - Type-safe API layer with flexible queries - schema design, resolvers, DataLoader, federation, and client integration
- **`graphql-architect`** (premium) - GraphQL API specialist for schema design, resolvers, federation, and performance optimization
- **`import-export-workflows`** (premium) - CSV/JSON import and export workflows: file upload, schema mapping, preview, per-row validation, partial-success commits, async processing, error reporting, and exports with streaming + cursor stability.
- **`infrastructure-as-code`** (premium) - Mass-production infrastructure architect with terminal paranoia. Has provisioned systems handling billions of requests. Has been on-call when terraform apply deleted the production database. Has watched state drift cause silent outages. Has cleaned up after secrets committed to state files. Knows that infrastructure code is forever - bad decisions in v1 haunt you for years.
- **`logging-strategies`** (premium) - Production logging expertise - structured JSON, correlation IDs, log aggregation, and secrets redaction
- **`media-transcoding-pipeline`** (premium) - Video and audio transcoding pipelines: FFmpeg-driven format/bitrate conversion, HLS/DASH packaging, thumbnail extraction, audio normalization, captions, DRM hand-off. Built for queue-based async execution with cost-aware concurrency.
- **`microservices-patterns`** (premium) - Battle-tested microservices architecture covering service boundaries, async communication, resilience patterns, sagas, and observability.
- **`monorepo-management`** (premium) - Expert at organizing and optimizing monorepos with Turborepo, Nx, pnpm workspaces
- **`multi-region-deployment`** (premium) - Deploy globally distributed applications with data residency, failover, and latency optimization
- **`neon-postgres`** (premium) - Expert patterns for Neon serverless Postgres, database branching, connection pooling, and Prisma/Drizzle integration
- **`notification-preferences`** (premium) - User-facing notification preferences: per-channel opt-in, per-category granularity, unsubscribe links, digests, quiet hours, regulatory compliance (CAN-SPAM, CASL, GDPR), and the data model that supports it. Covers the policy engine that decides whether to actually send a given notification.
- **`notifications-orchestration`** (premium) - Cross-channel notification orchestration: routing decisions across email, SMS, push, in-app, webhook; deduplication; retries; failover; delivery logs; per-user channel preferences resolved at send-time. The plumbing layer that turns "notify the user about X" into actual deliveries.
- **`observability`** (free) - Expert at making systems observable and debuggable through logging, metrics, tracing, and alerting
- **`pdf-generation`** (premium) - Production PDF generation for invoices, contracts, receipts, and reports. Covers HTML-to-PDF (Chromium/Puppeteer), programmatic generation (PDFKit/pdf-lib), templating, fonts, page breaks, accessibility, signing, and storage workflows.
- **`permissioned-file-sharing`** (premium) - File sharing with permissions: signed URLs with expiry, share-link ACLs, password-protected links, view-only vs download, watermarking, workspace files with role-based access, link revocation, and the audit trail proving who accessed what.
- **`presence-indicators`** (premium) - Real-time presence systems for online status, typing indicators, last-seen tracking, privacy controls, and multi-device coordination.
- **`prisma`** (premium) - Type-safe Prisma schema design, migrations, queries, transactions, and serverless-safe performance optimization.
- **`push-notifications`** (premium) - Web and mobile push notification systems covering service workers, FCM and VAPID, delivery UX, and subscription lifecycle management.
- **`python-backend`** (premium) - Production Python backend development with Django and FastAPI. This skill covers the hard-won lessons from building APIs that handle millions of requests, the async pitfalls that crash production, and the ORM mistakes that bring databases to their knees.
- **`python-craftsman`** (premium) - Python excellence specialist for type safety, async patterns, packaging, and idiomatic production code
- **`queue-workers`** (free) - Reliable background job systems with queues, retries, DLQs, idempotency, scheduling, and worker observability.
- **`rate-limiting`** (free) - Distributed rate limiting and throttling with quota design, Redis-backed enforcement, abuse prevention, and tier-aware controls.
- **`realtime-chat-systems`** (premium) - Production real-time chat backends with WebSockets, presence, persistence, unread state, moderation, and media handling.
- **`realtime-collab-conflict-resolution`** (premium) - Real-time collaboration: CRDT vs OT choice, presence + awareness, cursor/selection broadcast, persistent document sync, offline merge, conflict resolution UX, and the patterns that prevent two users editing the same paragraph from corrupting each other's work.
- **`realtime-engineer`** (premium) - Real-time systems expert for WebSockets, SSE, presence, and live synchronization
- **`reviews-ratings-systems`** (premium) - Customer reviews and ratings: data model, eligibility (verified buyer), moderation, anti-fraud signals, response/edit windows, aggregate scoring (Bayesian average / Wilson lower bound), helpful-vote signals, and the trust-and-safety operations needed to keep ratings honest.
- **`rust-craftsman`** (premium) - Systems programming specialist for Rust - ownership model, memory safety, concurrency, and performance optimization
- **`saas-teams-organizations`** (premium) - Multi-team/org SaaS architecture with RBAC, invitations, billing isolation, and data tenancy
- **`search-implementation`** (premium) - Full-text search with PostgreSQL, Elasticsearch, Meilisearch, autocomplete, and ranking
- **`server-sent-events`** (premium) - SSE for real-time streaming with EventSource, reconnection, scaling, and proxy handling
- **`social-features`** (premium) - Backend systems for likes, follows, feeds, notifications, ranking, and social graph queries at scale.
- **`structured-output`** (free) - Expert in extracting reliable, typed outputs from LLMs. Covers JSON mode, function calling, Instructor library, Outlines for constrained generation, Pydantic validation, and retry strategies. Essential for building production AI applications that integrate with typed systems.
- **`supabase-backend`** (premium) - Supabase database, RLS policies, storage, and backend patterns
- **`supabase-security`** (premium) - Deep expertise in securing Supabase applications with RLS, auth tokens, storage security, and multi-tenant isolation
- **`support-ticketing-workflows`** (premium) - Customer-support ticketing systems: ticket lifecycle, assignment routing, SLA tracking, internal notes vs public replies, macros/canned responses, merging, escalation, and the data model that supports it. Covers in-app, email, and chat ticket sources.
- **`team-invites-membership`** (premium) - Team/org membership lifecycle: invite issuance, signed tokens, seat enforcement, pending vs accepted vs expired states, resend and revoke, domain-claim and SSO auto-join, role assignment on accept, and membership transfers / removals.
- **`tenant-provisioning-lifecycle`** (premium) - Tenant (org/workspace) lifecycle: creation, seeding defaults, domain claim, plan changes, suspension, deletion, sandbox-vs-production separation, multi-tenant isolation, and the data model that supports per-tenant config + lifecycle state machine.
- **`trpc-fullstack`** (premium) - Expert in building type-safe APIs with tRPC. Router composition, procedure definitions, context creation, middleware, error handling, subscriptions, and end-to-end type safety from database to frontend.
- **`usage-metering-entitlements`** (premium) - Usage metering and entitlement enforcement: counter aggregation, quota policies, plan/feature gates, soft-cap vs hard-cap, overage billing, per-tenant limits, and the data model that prevents customers from exceeding plan without being silently throttled.
- **`video-streaming-infrastructure`** (premium) - Build video streaming systems with transcoding pipelines, adaptive bitrate delivery, and live streaming at scale
- **`webflow-development`** (premium) - Build production websites in Webflow with custom code, CMS collections, animations, and client handoff
- **`webhook-processing`** (free) - Webhook handling with signature verification, idempotency, retry logic, and dead letter queues
- **`webhook-provider-platform`** (premium) - Outbound webhook delivery for customer integrations: subscription model, signing, retries with exponential backoff, ordered vs unordered delivery, customer-side replay protection, customer dashboard for inspection, delivery logs, and the platform that lets customers wire up your events to their systems.
- **`websocket-realtime`** (premium) - Expert guidance for building reliable real-time systems that survive production
- **`websockets-realtime`** (premium) - WebSocket and SSE infrastructure for real-time apps with reconnection, scaling, auth, message ordering, and fallback strategies.
- **`zod-validation`** (premium) - Expert in runtime type validation with Zod. Schema composition, transformations, refinements, error handling, form integration, API validation, and building type-safe applications with runtime guarantees.

## biotech

_6 skills_

- **`bioinformatics-workflows`** (premium) - Production patterns for building, maintaining, and scaling bioinformatics workflows. Covers Nextflow, Snakemake, WDL/Cromwell, container orchestration, HPC/cloud deployment, and battle-tested practices for reproducible computational biology that survives audits.
- **`clinical-trial-analysis`** (premium) - Production-ready patterns for clinical trial design, survival analysis, endpoint selection, sample size calculation, interim analyses, and regulatory submissions (FDA/EMA)
- **`drug-discovery-informatics`** (premium) - Computational drug discovery workflows covering virtual screening, docking, ADMET, SAR, QSAR, and lead optimization.
- **`genomics-pipelines`** (premium) - Expert at building NGS data processing pipelines, variant calling workflows, RNA-seq analysis, and production genomics bioinformatics - covers Nextflow, Snakemake, GATK, STAR, Salmon, and clinical-grade pipeline patterns
- **`lab-automation`** (premium) - Production patterns for laboratory automation including liquid handling robotics, LIMS integration, protocol development, quality control, and high-throughput workflows
- **`protein-structure`** (premium) - Expert at protein structure prediction using AlphaFold2/ColabFold, structural analysis, model quality assessment, and drug discovery pipelines - covers pLDDT/PAE interpretation, molecular dynamics, and experimental data integration

## blockchain

_21 skills_

- **`account-abstraction`** (premium) - Comprehensive expertise in ERC-4337 account abstraction, smart contract wallets, paymasters, bundlers, and user operation handling. Covers social recovery, session keys, gas sponsorship, and wallet SDKs.
- **`blockchain-defi`** (premium) - Expert guidance for DeFi protocols - AMMs, yield farming, lending, and smart contract security patterns
- **`blockchain-privacy`** (premium) - Expert in on-chain privacy technologies - ZK-SNARKs, ZK-STARKs, mixers, stealth addresses, ring signatures, and confidential transactions for building privacy-preserving blockchain applications
- **`cross-chain`** (premium) - Comprehensive expertise in cross-chain infrastructure, including LayerZero, Wormhole, Axelar, and custom bridge implementations. Covers omnichain token standards, message passing, bridge security, and cross-chain application architecture.
- **`crypto-trading-bots`** (premium) - Expert at automated crypto trading systems including DEX sniping, arbitrage detection, MEV protection, sandwich attack defense, and production trading bot architecture
- **`dao-governance`** (premium) - Production patterns for DAO governance including Snapshot voting, OpenZeppelin Governor, timelocks, treasury multi-sigs, delegation systems, and governance attack prevention
- **`defi-architect`** (premium) - DeFi protocol specialist for AMMs, lending protocols, yield strategies, and economic security
- **`evm-deep-dive`** (premium) - Expert in Ethereum Virtual Machine internals - gas optimization, assembly/Yul, opcode-level optimization, and low-level EVM patterns
- **`layer2-scaling`** (premium) - Expert in Ethereum L2 solutions - Optimism, Arbitrum, zkSync, Base, and rollup architecture for scalable dApp development
- **`nft-engineer`** (premium) - Battle-hardened NFT developer specializing in ERC-721/1155 implementations, gas-optimized minting, reveal mechanics, and marketplace integration.
- **`nft-systems`** (premium) - Expert in NFT development - minting infrastructure, metadata standards, marketplaces, royalties, and collection management across EVM and Solana
- **`onchain-analytics`** (premium) - Production patterns for blockchain data analysis using Dune Analytics, Flipside, The Graph subgraphs, custom indexers, SQL for blockchain, protocol metrics, TVL tracking, and alpha discovery
- **`perpetuals-trading`** (premium) - Production patterns for perpetual futures protocols including GMX, dYdX, Hyperliquid, funding rate arbitrage, liquidation mechanics, delta-neutral strategies, and risk management
- **`prediction-markets`** (premium) - Production patterns for decentralized prediction markets including Polymarket-style platforms, UMA Optimistic Oracle, Conditional Tokens Framework, LMSR/CPMM market makers, resolution mechanisms, and regulatory compliance
- **`rwa-tokenization`** (premium) - Real-world asset tokenization systems with compliance-aware security tokens, transfer controls, on-chain identity, and corporate actions.
- **`smart-contract-auditor`** (premium) - Elite security researcher who hunts vulnerabilities in smart contracts. Has found critical bugs worth millions in TVL. Specializes in reentrancy, access control, oracle manipulation, and economic exploits across EVM and Solana.
- **`solana-development`** (premium) - Expert in Solana blockchain development - Anchor framework, SPL tokens, program development, and high-performance dApp architecture
- **`token-launch`** (premium) - Production-grade expertise in launching tokens through IDOs, implementing secure vesting contracts, designing sustainable tokenomics, and ensuring fair launch mechanics. Covers launchpad integrations, cliff/unlock schedules, anti-bot protection, and regulatory considerations.
- **`tokenomics-design`** (premium) - Expert in token economics - distribution models, vesting schedules, incentive mechanisms, emission curves, and sustainable protocol design
- **`web3-gaming`** (premium) - Production expertise in blockchain game development including play-to-earn mechanics, dual token economies, NFT gaming assets, anti-cheat systems, and sustainable tokenomics that don't collapse.
- **`x402-payments`** (premium) - Expert in HTTP 402 Payment Required protocol implementation - crypto micropayments, Lightning Network integration, L2 payment channels, and the future of web monetization

## business

_13 skills_

- **`api-monetization`** (premium) - Selling API access including key management, usage tracking, tiered rate limiting, billing integration, developer portal, and overage handling
- **`billing-invoices-receipts`** (premium) - Invoice and receipt generation, numbering, immutability, credit notes, basic tax handling, payment reconciliation, dunning, and the data model that satisfies tax regulators and auditors. Built around the principle that issued invoices are immutable.
- **`demo-day-theater`** (premium) - Making your work look as good as it actually is - technical presentation mastery
- **`education-business`** (premium) - Expert in the business of online education - pricing strategies, launch playbooks, revenue models, positioning, and building sustainable education businesses
- **`education-platforms`** (premium) - Expert in course platform selection and implementation - comparing Teachable, Kajabi, Thinkific, and custom solutions, LMS selection, platform migrations, and build vs buy decisions
- **`hiring-strategy`** (premium) - Building world-class teams through strategic hiring decisions, compensation, and closing
- **`hr-recruiting`** (premium) - AI-powered hiring, talent acquisition, and HR operations with compliance focus
- **`notion-template-business`** (premium) - Expert in building and selling Notion templates as a business - template design, pricing, marketplaces, marketing, and scaling to real revenue
- **`sales-ai-tools`** (premium) - CRM automation, outreach, lead scoring, and sales intelligence tools
- **`salesforce-development`** (premium) - Lightning Web Components, Apex, REST/Bulk APIs, and Salesforce DX with scratch orgs and 2GP packages
- **`sox-compliance`** (premium) - Sarbanes-Oxley compliance - internal controls, audit trails, segregation of duties, and ITGC
- **`subscription-billing`** (free) - Production-grade subscription billing with Stripe, usage metering, dunning, tax compliance, and revenue recognition
- **`web-payments-wallets`** (premium) - Web payment integrations: Apple Pay, Google Pay, Link, Payment Request API, browser-native wallet UX, fallback to card-form, 3DS handling, network tokens, and the patterns that prevent a smooth-looking checkout from quietly losing 18% of conversions.

## climate

_5 skills_

- **`carbon-accounting`** (premium) - Calculate, track, and report greenhouse gas emissions following GHG Protocol standards, including Scope 1, 2, and 3 emissions and science-based targets.
- **`climate-modeling`** (premium) - Work with climate data, models, and projections for climate impact assessment, downscaling, and scenario analysis using CMIP6 and other climate datasets.
- **`energy-systems`** (premium) - Power systems engineering covering grid modeling, power flow analysis, energy storage dispatch, demand response, and electricity market economics. Spans transmission/distribution planning to real-time operations.
- **`renewable-energy`** (premium) - Design, model, and optimize renewable energy systems including solar PV, wind power, energy storage, and grid integration.
- **`sustainability-metrics`** (premium) - ESG performance measurement, sustainability reporting frameworks, materiality assessment, and impact quantification. Covers CDP, TCFD, GRI, SASB, CSRD/ESRS, and emerging disclosure requirements.

## communications

_8 skills_

- **`community-building`** (premium) - Your most loyal users aren't just customers - they're potential advocates, contributors, and community members who can become the engine of your growth. Community-led growth isn't about broadcasting to an audience - it's about creating a space where your users connect with each other, share knowledge, and become invested in your success.
- **`crisis-communications`** (premium) - When things go wrong - and they will - how you communicate determines whether you lose customers for a day or lose trust forever. Crisis communications isn't about spin or damage control. It's about being human when your company is at its most vulnerable.
- **`dev-communications`** (premium) - The craft of communicating technical concepts clearly to developers. Developer communications isn't marketing - it's about building trust through transparency, accuracy, and genuine utility. The best devrel content helps developers solve real problems. This skill covers technical documentation, developer tutorials, API references, changelog writing, developer blog posts, and developer community engagement. Great developer communications treats developers as peers, not leads to convert.
- **`documentation-that-slaps`** (premium) - Writing docs people actually want to read - developer empathy meets technical writing
- **`knowledge-base-engineering`** (premium) - Build self-service knowledge bases with search optimization, content architecture, and AI integration that deflect support tickets
- **`stakeholder-management`** (premium) - Your startup isn't just your team - it's an ecosystem of people who have a stake in your success. Investors, board members, advisors, partners, vendors. Each group has different needs, different communication rhythms, and different expectations. Get it wrong, and you lose credibility. Get it right, and you have an army of advocates multiplying your reach.
- **`team-communications`** (premium) - Your team can't execute what they don't understand. And they won't buy in to what they don't feel part of. Internal communications isn't about memos and announcements - it's about creating the information flow that makes a team function as one organism.
- **`technical-writer`** (premium) - Effective technical documentation - knowing what to write, for whom, and when. From code comments to architecture docs, making knowledge accessible and maintainable

## community

_14 skills_

- **`ambassador-programs`** (premium) - Expert in designing and running ambassador, champion, and advocacy programs. Covers recruiting community leaders, structuring tiers and rewards, managing at scale, and turning passionate users into official representatives.
- **`community-analytics`** (premium) - Expert in community health metrics, engagement analytics, sentiment analysis, cohort tracking, and actionable reporting.
- **`community-growth`** (premium) - Expert in growing and engaging communities sustainably. Covers acquisition channels, activation strategies, engagement programs, events, content, and retention tactics. Knows that healthy growth is about depth, not just numbers.
- **`community-operations`** (premium) - Expert in running the day-to-day operations of thriving communities. Covers moderation systems, onboarding flows, crisis management, scaling operations, and team management. The engine room that keeps communities healthy and safe.
- **`community-strategy`** (premium) - Mass-production community strategist who has launched 50+ communities and watched 30+ die painful deaths. Expert in community-market fit validation, culture architecture, governance evolution, and member journey design. Knows that communities are intentionally designed, not accidentally grown.
- **`community-tooling`** (premium) - Expert in community tool selection and implementation - Discord bots, community platforms, analytics tools, CRMs, moderation systems, and automation. Knows the tool landscape, integration patterns, and how to build a cohesive community tech stack.
- **`customer-support`** (premium) - AI tools and strategies for customer support - helpdesks, chatbots, ticketing, and service automation
- **`developer-community`** (premium) - Expert in building and nurturing developer communities - DevRel strategy, developer experience, technical content, documentation communities, and turning developers into advocates. Covers OSS community building, API ecosystems, and developer-first go-to-market.
- **`discord-mastery`** (premium) - Expert in building and managing thriving Discord communities. Covers server architecture, role systems, bot ecosystems, engagement features, and moderation at scale. Understands Discord-specific culture and patterns.
- **`referral-program-engineering`** (premium) - Build viral referral systems with fraud prevention, attribution tracking, and reward optimization
- **`social-community`** (premium) - Expert in building community presence across social platforms - Twitter/X, Reddit, Farcaster, and forums. Covers platform-specific strategies, cross-platform coordination, and leveraging social for community growth. Knows each platform's culture and how to build native presence.
- **`student-success`** (premium) - Expert in measuring and driving student outcomes - completion optimization, outcome tracking, testimonial systems, certifications, and alumni programs
- **`telegram-mastery`** (premium) - Expert in building and managing Telegram communities from startup to 100K+ members
- **`web3-community`** (premium) - Expert in building crypto-native communities - token holder communities, NFT communities, DAO governance, alpha groups, and navigating the unique dynamics of Web3 culture. Covers managing speculation, building through bear markets, and creating genuine value beyond price.

## creative

_21 skills_

- **`3d-modeling`** (premium) - Expert 3D modeling for games and film - topology, UV mapping, retopology, LOD systems, and DCC workflows
- **`3d-web-experience`** (premium) - Expert in building 3D experiences for the web - Three.js, React Three Fiber, Spline, WebGL, and interactive 3D scenes
- **`absurdist-voice`** (premium) - Expert in crafting deliberately weird, unhinged brand voices that convert. Duolingo owl energy meets strategic chaos. The art of being memorably weird without being off-putting. Weaponized absurdism for brand differentiation.
- **`ai-game-art-generation`** (premium) - AI-powered game asset pipelines using ComfyUI, Stable Diffusion, FLUX, ControlNet, IP-Adapter for production-ready sprites, textures, UI, and environments
- **`board-game-design`** (premium) - Designing tabletop games - from core mechanics to manufacturing, from prototyping to playtesting
- **`card-game-design`** (premium) - Expert TCG/CCG design - mana curves, set skeletons, rarity distribution, and the dark arts of metagame cultivation
- **`character-design`** (premium) - Designing memorable game characters with clear silhouettes, readable personalities, and production-ready specifications
- **`cliffhanger-craft`** (premium) - Expert in creating endings that demand continuation - making audiences need to see what happens next
- **`concept-art`** (premium) - Expert visual development and concept art - pre-production workflows, design exploration, and production-ready deliverables
- **`content-creation`** (premium) - Master AI content generation tools - images, video, audio, and writing at production scale
- **`cultural-remix`** (premium) - Expert in riding cultural moments and trends without looking like a tourist - knowing when to jump in and when to sit out
- **`incident-postmortem`** (premium) - Expert in running effective incident postmortems. Covers blameless analysis, root cause investigation, action item prioritization, and building a learning culture. Understands that incidents are opportunities to improve systems, not punish people.
- **`legacy-archaeology`** (premium) - Expert in understanding and navigating legacy codebases. Covers code archaeology techniques, finding hidden knowledge, mapping dependencies, and extracting understanding from code without documentation. Knows how to read the stories that old code tells - and how to avoid the graves that previous archaeologists dug for themselves.
- **`lore-building`** (premium) - Expert in creating rich backstories, fictional universes, and ARGs (Alternate Reality Games). Covers world-building, mystery construction, community-driven storytelling, and transmedia narratives. Knows how to create depth that rewards exploration without overwhelming.
- **`meme-engineering`** (premium) - Expert in meme creation and virality - understanding why certain ideas spread while others die. Covers meme formats, timing, adaptation, meta-commentary, and platform-specific optimization. Knows the difference between forcing a meme and engineering conditions for organic spread.
- **`regex-whisperer`** (premium) - Expert in writing, debugging, and explaining regular expressions. Covers readable regex patterns, performance optimization, debugging techniques, and knowing when NOT to use regex. Understands that regex is powerful but often overused.
- **`roast-writing`** (premium) - Expert in comedic roasts, witty insults, and self-deprecating humor that lands. Covers the craft of punching up vs down, timing, target selection, and knowing the line between funny and mean. Knows how to be savage while staying lovable.
- **`scope-creep-defense`** (premium) - Expert in protecting projects from scope creep. Covers requirement management, stakeholder negotiation, saying no diplomatically, and keeping projects focused. Understands that scope creep kills more projects than technical debt.
- **`side-project-shipping`** (premium) - Expert in actually finishing and shipping side projects. Covers MVP scoping, motivation management, perfectionism killing, and the art of "good enough." Understands why side projects die and how to keep them alive long enough to ship.
- **`tech-debt-negotiation`** (premium) - Expert in making the business case for technical debt reduction, quantifying costs, and negotiating engineering time for maintenance
- **`viral-hooks`** (premium) - Expert in creating opening lines, thumbnails, and hooks that stop the scroll. Covers curiosity gaps, pattern interrupts, emotional triggers, and platform-specific hooks. Knows how to earn attention in the first 3 seconds without resorting to clickbait.

## data

_22 skills_

- **`agent-based-modeling`** (premium) - Design and implement ABM for complex systems with emergent behavior from individual agent interactions
- **`analytics-architecture`** (premium) - Product analytics engineer who has built data systems at scale, knows that the tracking you skip today is the insight you can't have tomorrow, and designs schemas carefully with privacy in mind
- **`convex-backend`** (premium) - Expert at building reactive backends with Convex. Covers queries, mutations, actions, schema validation, real-time subscriptions, file storage, scheduled functions, HTTP actions, auth integration, pagination, indexes, and relations.
- **`data-engineer`** (premium) - Data pipeline specialist for ETL design, data quality, CDC patterns, and batch/stream processing
- **`data-governance`** (premium) - Data ownership, quality, lineage, and cataloging - the enterprise patterns that prevent the $4B analytics disaster and keep you GDPR compliant
- **`data-pipeline`** (free) - ETL/ELT pipeline design and operation covering ingestion, transformation, idempotent backfills, schema drift handling, and end-to-end observability for analytics and ML workloads.
- **`data-quality-monitoring`** (premium) - Data-quality monitoring: freshness checks, row-count assertions, schema drift detection, anomaly alerts, dimensional reconciliation, lineage, and the SLI/SLO frame that turns "is the data right?" from anxiety into evidence.
- **`data-reproducibility`** (premium) - Reproducible computational research with environment management, data versioning, seed control, and sharing protocols
- **`database-migrations`** (premium) - Expert at evolving database schemas safely with zero-downtime deployments
- **`database-schema-design`** (premium) - World-class database schema design - data modeling, migrations, relationships, and the battle scars from scaling databases that store billions of rows
- **`drizzle-orm`** (premium) - Expert knowledge for Drizzle ORM - the lightweight, type-safe SQL ORM for edge and serverless
- **`experimental-design`** (premium) - Design of Experiments (DOE) methodology for rigorous research and efficient experimentation
- **`graph-engineer`** (premium) - Knowledge graph specialist for entity and causal relationship modeling
- **`graphile-worker`** (premium) - Graphile Worker expert for high-performance PostgreSQL job queues with trigger-based job creation and millisecond job pickup via LISTEN/NOTIFY.
- **`pg-boss`** (premium) - pg-boss expert for PostgreSQL-backed job queues with exactly-once delivery, perfect for applications already using Postgres (Supabase, Neon, etc.).
- **`planetscale-vitess`** (premium) - Expert at PlanetScale MySQL database operations. Covers branching workflows, deploy requests, zero-downtime schema migrations, connection pooling, Prisma integration, read replicas, boost caching, foreign key alternatives, and Vitess sharding patterns.
- **`postgres-wizard`** (premium) - PostgreSQL internals specialist for query optimization, indexing, partitioning, and advanced features. Knows when to add an index and when an index makes things worse. Understands VACUUM, autovacuum tuning, and why your database slows down at 3am on Sundays.
- **`redis-specialist`** (free) - Redis expert for caching, pub/sub, data structures, and distributed systems patterns
- **`temporal-craftsman`** (premium) - Workflow orchestration expert using Temporal.io for durable execution
- **`turso-libsql`** (premium) - Turso/LibSQL edge database patterns including embedded replicas, edge deployment, sync protocol, branching, migrations, Drizzle ORM integration, and offline-first patterns
- **`vector-database-pinecone`** (premium) - Vector database patterns for semantic search including pgvector, Pinecone, Chroma, embedding generation, similarity search, hybrid search, chunking strategies, and retrieval evaluation
- **`vector-specialist`** (free) - Embedding and vector retrieval expert for semantic search, hybrid retrieval, and production vector systems. Knows when dense vectors win, when sparse vectors win, and when you need both. Understands chunking strategies, reranking, and why your RAG system returns nonsense.

## design

_14 skills_

- **`accessibility-design`** (premium) - World-class accessibility design expertise - WCAG compliance, screen reader optimization, keyboard navigation, and inclusive design patterns
- **`branding`** (premium) - The craft of creating and maintaining cohesive brand identity systems. Branding translates brand strategy into tangible visual and verbal identity - logos, color systems, typography, imagery, and voice guidelines that work together to make a brand recognizable and memorable.
- **`color-theory`** (premium) - World-class color theory expertise combining the scientific precision of Josef Albers' "Interaction of Color," the systematic thinking of color systems from Pantone and RAL, and the perceptual psychology insights from researchers like Bevil Conway. Color is not just aesthetics - it's communication, emotion, and usability compressed into wavelengths.
- **`design-systems`** (free) - World-class design systems architecture - tokens, components, documentation, and governance. Design systems create the shared language between design and engineering that makes products feel cohesive at any scale.
- **`figma-developer`** (premium) - Expert in Figma for developers - Dev Mode, design-to-code workflows, CSS extraction, design tokens, auto-layout to CSS, and building Figma plugins. Bridging the gap between design and implementation.
- **`game-ui-design`** (premium) - World-class game UI design expertise combining the clarity of Nintendo's UI philosophy, the immersive diegetic interfaces of Dead Space and Metroid Prime, and the competitive readability principles from esports titles. Game UI is the invisible bridge between player intent and game response.
- **`icon-design`** (premium) - The craft of designing icons that communicate instantly across cultures, contexts, and scales. Icon design bridges semiotics, cognitive psychology, and visual craft to create symbols that users understand without thinking. Great icons are invisible in the best way - they convey meaning so naturally that users never pause to decode them.
- **`landing-page-design`** (premium) - World-class landing page expertise combining conversion rate optimization science, persuasive design psychology, and the craft of pages that turn visitors into customers.
- **`motion-design`** (premium) - World-class motion design expertise combining Disney's 12 principles of animation, Material Design's motion system, and the performance-first philosophy of production interfaces. Motion is the language of cause and effect in digital interfaces - every transition tells a story of where things came from and where they're going.
- **`storybook-components`** (premium) - Expert in Storybook - the industry standard for building, documenting, and testing UI components in isolation. Component development environment, visual testing, interaction testing, and design system documentation.
- **`tailwind-css`** (premium) - Utility-first CSS framework for building production-ready, responsive, dark-mode-enabled interfaces at scale
- **`typography`** (premium) - Expert in typography for digital interfaces - font selection, type scales, hierarchy systems, and cross-platform rendering. Covers web fonts, variable fonts, accessibility compliance, and performance optimization.
- **`ui-design`** (free) - Expert in user interface design for web and mobile applications. Covers component design, visual hierarchy, spacing systems, responsive layouts, and design-to-code handoff. Production focus on scalable, consistent interfaces.
- **`ux-design`** (free) - User experience design specialist covering research, flows, journey mapping, and interaction design. Expert in understanding user needs, creating intuitive flows, and validating designs through testing.

## development

_27 skills_

- **`ai-agents-architect`** (premium) - Multi-agent AI system design - orchestration patterns, agent communication, state management, and failure handling for production autonomous systems
- **`ai-product`** (premium) - AI-native product development - building products with LLMs as core capability, not bolted-on feature, with focus on reliability and user trust
- **`android-kotlin-specialist`** (premium) - Production Android development with Kotlin covering Jetpack Compose, coroutines, lifecycle, dependency injection, app size, and the gap between "works on my Pixel" and "works across 18,000 Android device models with 7 different OS versions still in active use".
- **`backend`** (premium) - Server-side application architecture - API development, database integration, caching, background jobs, and production reliability
- **`bubble-nocode`** (premium) - Expert guidance for building production-grade applications on Bubble.io - the leading no-code platform
- **`code-architecture-review`** (premium) - Architecture review practices - evaluating system designs, identifying technical debt, and making build vs buy decisions
- **`code-cleanup`** (premium) - Code hygiene practices - removing dead code, fixing inconsistencies, improving readability, and maintaining code quality standards
- **`code-quality`** (premium) - Writing maintainable code - readability principles, SOLID patterns applied pragmatically, and the judgment to know when rules should bend
- **`code-review`** (premium) - Code review specialist who has reviewed thousands of PRs, built review cultures that scale, and knows that great reviews are conversations that improve both code and people
- **`code-review-diplomacy`** (premium) - The art of giving feedback that lands, receiving criticism gracefully, navigating disagreements, and building healthy review culture
- **`code-reviewer`** (premium) - Code review expertise - providing constructive feedback, catching bugs, improving code quality, and mentoring through reviews
- **`codebase-optimization`** (premium) - Codebase health improvement - reducing complexity, improving performance, cleaning up technical debt, and modernizing legacy code
- **`docs-engineer`** (premium) - Technical documentation specialist - API docs, tutorials, architecture docs, and developer experience
- **`game-development`** (premium) - Game development - game loops, physics systems, entity-component systems, performance optimization, and player experience
- **`infra-architect`** (premium) - Infrastructure architect - Kubernetes, Terraform, GitOps, service mesh, and cloud-native platform design
- **`ios-swift-specialist`** (premium) - Native iOS development - Swift, SwiftUI, UIKit, Combine, and Apple platform patterns
- **`mcp-developer`** (premium) - Model Context Protocol expert who has built production MCP servers used by thousands, knows that tool design is where projects succeed or fail, and treats schema as documentation
- **`mcp-product`** (premium) - MCP tool product design - building AI tools that are intuitive, educational, and progressively complex
- **`migration-specialist`** (premium) - Migration specialist - zero-downtime schema changes, data migrations, backward compatibility, and rollback strategies
- **`privacy-guardian`** (premium) - Security and privacy specialist for differential privacy, encryption, and compliance
- **`rag-engineer`** (free) - Expert in building Retrieval-Augmented Generation systems - embeddings, vector stores, chunking strategies
- **`sdk-builder`** (premium) - Client library architect for SDK design, API ergonomics, versioning, and developer experience
- **`security`** (premium) - Application security specialist for OWASP Top 10, secure coding, threat modeling, and zero trust
- **`smart-contract-engineer`** (premium) - Blockchain smart contract specialist for Solidity, EVM, security patterns, and gas optimization
- **`tech-debt-manager`** (premium) - Strategic technical debt management - knowing when to take on debt, when to pay it down, and how to communicate debt decisions to stakeholders
- **`technical-debt-strategy`** (premium) - Strategic management of technical debt - when to take it, how to track it, when to pay it down
- **`wallet-integration`** (premium) - Web3 wallet integration specialist for wallet connectivity, transaction signing, and DApp UX

## devops

_35 skills_

- **`bun-runtime`** (premium) - Expert in the Bun JavaScript runtime. Package management, bundling, testing, native TypeScript support, FFI, SQLite, and leveraging Bun's speed advantages for modern JavaScript development.
- **`chaos-engineer`** (premium) - Resilience testing specialist who believes untested recovery paths don't work when you need them most, and that the best way to build resilient systems is to break them on purpose
- **`ci-cd-pipeline`** (premium) - Expert CI/CD pipeline design, GitHub Actions, deployment strategies, and release management
- **`cicd-pipelines`** (premium) - Production-hardened CI/CD pipeline design covering GitHub Actions, GitLab CI, and deployment automation with focus on speed, reliability, and security
- **`claude-code-cicd`** (premium) - Expert integration of Claude Code with CI/CD pipelines - headless mode, GitHub Actions, GitLab CI, automated review, issue triage, and cost optimization
- **`claude-code-commands`** (premium) - Expert in creating custom slash commands for Claude Code - encoding repeatable workflows as discoverable, composable markdown files
- **`claude-code-hooks`** (premium) - Expert in Claude Code hooks - user-defined shell commands that execute at specific points in Claude Code's lifecycle. Provides guaranteed automation that doesn't rely on the LLM "remembering" to do something. Essential for enterprise workflows, code quality enforcement, and deterministic behavior in agentic coding.
- **`claude-code-prompting`** (premium) - Expert in effective prompting for Claude Code sessions. How to communicate tasks clearly, provide context efficiently, get consistent results, and work with Claude as an effective pair programmer.
- **`claude-md-mastery`** (premium) - Expert in writing effective CLAUDE.md files for Claude Code. The CLAUDE.md file is your project's instruction manual for AI assistance - defining tech stack, conventions, rules, and context that makes Claude Code work seamlessly with your codebase.
- **`cli-tool-builder`** (premium) - Expert in building command-line tools. Argument parsing, interactive prompts, progress indicators, configuration management, plugin systems, cross-platform compatibility, and creating CLI tools that developers love to use.
- **`cloud-cost-optimization`** (premium) - Reduce cloud spend by 30-70% through reserved instances, spot fleets, rightsizing, and FinOps practices
- **`devops`** (free) - CI/CD pipelines, infrastructure as code, monitoring, disaster recovery - battle scars from keeping production running at 3am
- **`devops-engineer`** (premium) - World-class DevOps engineering - cloud architecture, CI/CD pipelines, infrastructure as code, and the battle scars from keeping production running at 3am
- **`disaster-readiness-drills`** (premium) - Game-day exercises, chaos drills, and DR rehearsals — failover testing, backup restore validation, runbook execution, blast-radius scoping, and turning theoretical RTO/RPO into measured, repeated reality.
- **`disaster-recovery`** (premium) - RTO/RPO engineering, failover automation, and chaos testing - the paranoid patterns that kept a $50M/hour trading platform online during the AWS us-east-1 apocalypse
- **`docker`** (premium) - Multi-stage builds, layer caching, security hardening, compose patterns - battle scars from bloated images, leaked secrets, and container escapes
- **`docker-specialist`** (premium) - Expert Docker containerization, multi-stage builds, security hardening, and production optimization
- **`env-config-patterns`** (premium) - Expert in environment configuration management. Environment variables, config files, secrets handling, environment-specific settings, validation, and building secure, maintainable configuration systems.
- **`feature-flag-engineering`** (premium) - Production-grade feature flag implementation covering LaunchDarkly, Statsig, Flagsmith, Unleash, PostHog, and homegrown solutions with battle-tested patterns for safe rollouts and kill switches
- **`fly-io-global`** (premium) - Expert at deploying globally distributed applications on Fly.io. Covers fly launch, multi-region apps, Fly Machines, volumes, Postgres clusters, LiteFS distributed SQLite, private networking, auto-scaling, health checks, deploy strategies, and secrets management.
- **`git-time-travel`** (premium) - Expert in navigating and manipulating git history - finding bugs with bisect, recovering lost work, rewriting history safely
- **`git-workflow`** (premium) - Production git workflows - branching strategies, commit hygiene, merge/rebase decisions, and disaster recovery
- **`incident-responder`** (premium) - Production incident response - war room coordination, systematic investigation, and blameless post-mortems that turn 3 AM chaos into organizational learning
- **`kubernetes`** (premium) - Expert Kubernetes deployment, scaling, networking, and cluster operations
- **`observability-sre`** (premium) - Site reliability specialist who has been paged at 3am enough times to know that good observability is the difference between 5-minute fixes and 5-hour outages
- **`performance-hunter`** (premium) - Performance optimization specialist who profiles before optimizing, knows that the bottleneck is never where you think, and measures p99 because tail latency kills user experience
- **`plausible-analytics`** (premium) - Privacy-first analytics implementation with Plausible or Umami, custom events, attribution, self-hosting, and GDPR-safe tracking.
- **`pnpm-workspaces`** (premium) - Expert in pnpm workspace management for monorepos. Workspace configuration, dependency management, filtering, publishing, and building scalable multi-package repositories with efficient disk usage.
- **`posthog-analytics`** (premium) - Expert at implementing PostHog product analytics. Covers event tracking, user identification, feature flags, A/B experiments, session recording, funnels, retention analysis, group analytics, reverse proxy setup (ad-blocker bypass), Next.js integration, privacy compliance, and custom properties.
- **`railway-deployment`** (premium) - Expert at deploying applications on Railway. Covers project setup, environment variables, Nixpacks/Dockerfile detection, database provisioning, private networking, volume storage, cron jobs, autoscaling, custom domains, deploy previews, and monorepo support.
- **`sentry-error-tracking`** (premium) - Sentry setup and production monitoring for errors, traces, releases, session replay, alerting, and privacy-safe observability.
- **`sla-status-page-incident-comms`** (premium) - SLA definition, status page operation, and incident communications — uptime measurement, public/private status pages, customer-facing incident updates, RCA publication, SLA credit calculation, and the comms cadence that keeps trust intact during outages.
- **`turborepo-monorepo`** (premium) - Expert at building monorepo systems with Turborepo. Covers turbo.json pipeline config, task dependencies, remote caching, environment variable handling, internal packages, shared configs (ESLint/TypeScript), Docker builds from monorepo, CI setup (GitHub Actions), pruning for deploy, and workspace filtering.
- **`vercel-deployment`** (premium) - Vercel deployment for Next.js with edge functions, environment variables, and CI/CD
- **`vscode-extension-dev`** (premium) - Expert in building VS Code extensions. Extension architecture, activation events, commands, webviews, language servers, debugging, publishing to marketplace, and creating tools that developers actually want to use.

## ecommerce

_3 skills_

- **`digital-product-delivery`** (premium) - Secure fulfillment for digital products with signed downloads, license keys, post-purchase access control, and refund revocation.
- **`ecommerce-cart-checkout`** (premium) - Cart and checkout architecture for ecommerce with persistence, stock validation, tax and shipping logic, and conversion-safe flows.
- **`shopify-store-builder`** (premium) - Expert guidance for building, optimizing, and scaling Shopify stores from Dawn themes to Shopify Plus enterprise deployments

## education

_3 skills_

- **`course-creation`** (premium) - Expert in designing and structuring online courses - curriculum architecture, learning outcomes, module design, and assessment strategies using backward design methodology.
- **`learning-experience`** (premium) - Expert in designing engaging learning experiences - completion optimization, multimedia learning, interactivity, gamification, and retention strategies based on learning science
- **`live-education`** (premium) - Expert in cohort-based courses, workshops, webinars, and real-time facilitation for transformative live learning experiences

## engineering

_11 skills_

- **`control-systems`** (premium) - Feedback control systems including PID tuning, state-space control, and MPC
- **`debugging-master`** (premium) - Systematic debugging - isolation, reproduction, root cause analysis
- **`developer-experience`** (premium) - Internal-tools and developer-experience engineering covering local environments, build speed, error message quality, onboarding ramp, and the gap between "the docs say it works" and "the new hire shipped on day three".
- **`digital-twin`** (premium) - Virtual representations of physical systems with real-time synchronization, sensor integration, and predictive maintenance
- **`discrete-event-simulation`** (premium) - Design and implement DES for queuing systems, manufacturing, logistics, and networks using SimPy and statistical output analysis
- **`distributed-systems`** (premium) - Distributed systems engineering covering consistency models, consensus, partition tolerance, time and ordering, idempotency, exactly-once delivery myths, and the gap between "it works in one region" and "it works across three with the network on fire".
- **`embedded-systems`** (premium) - Microcontroller and embedded software development for resource-constrained real-time systems
- **`fpga-design`** (premium) - FPGA development including RTL design, timing closure, and clock domain crossing
- **`motor-control`** (premium) - Electric motor control including FOC, stepper control, and encoder interfaces
- **`ros2-robotics`** (premium) - Robot Operating System 2 development patterns for robotics applications
- **`sensor-fusion`** (premium) - Multi-sensor data fusion for state estimation in robotics and autonomous systems

## enterprise

_5 skills_

- **`enterprise-architecture`** (premium) - Battle-scarred enterprise architect who has survived 15+ years of digital transformations, $50M+ failed initiatives, and countless "strategic realignments." Expert in TOGAF ADM, capability mapping, domain modeling, and the politics of getting 200 stakeholders aligned. Knows that architecture is 20% technical and 80% organizational change management.
- **`multi-tenancy`** (premium) - Battle-scarred SaaS architect who has built multi-tenant systems from startup to enterprise scale. Has been paged at 3 AM because one tenant's bulk import took down the entire platform. Has explained to a customer why their data appeared in another tenant's dashboard. Knows that tenant isolation is not optional, and that "we'll add multi-tenancy later" is the most expensive sentence in SaaS.
- **`rbac-enterprise`** (premium) - Enterprise-grade role-based access control with permission matrices, scoped roles, inheritance, admin boundaries, and safe authorization evolution.
- **`scim-provisioning`** (premium) - SCIM provisioning and deprovisioning systems for enterprise identity lifecycle sync, group mapping, account drift correction, and reliable directory integration.
- **`sso-saml`** (premium) - Production SAML SSO implementation for enterprise apps including IdP/SP configuration, assertion validation, JIT provisioning, and tenant-safe login flows.

## finance

_7 skills_

- **`algorithmic-trading`** (premium) - Build trading systems, backtest strategies, implement execution algorithms, and analyze market microstructure with production-grade risk management
- **`derivatives-pricing`** (premium) - Price options, calculate Greeks, implement exotic derivatives, and build pricing engines with Black-Scholes, binomial trees, and Monte Carlo methods
- **`execution-algorithms`** (premium) - Trade execution optimization, TWAP/VWAP, market impact modeling, and smart order routing
- **`finance-ai-tools`** (premium) - AI-powered finance operations - accounting, budgeting, forecasting, expense management
- **`portfolio-optimization`** (premium) - Construct portfolios using mean-variance optimization, risk parity, Black-Litterman, and hierarchical risk parity with production-grade constraints
- **`risk-modeling`** (premium) - Build VaR models, stress test portfolios, run Monte Carlo simulations, and implement enterprise risk management frameworks
- **`tax-compliance-sales-tax-vat`** (premium) - Sales tax, VAT, GST collection and remittance for SaaS and ecommerce — nexus tracking, rate determination, invoice compliance, B2B reverse charge, registration thresholds, and audit-ready records across US states and EU/UK.

## frameworks

_13 skills_

- **`astro-framework`** (premium) - Expert in Astro - the web framework for content-driven websites. Delivers zero-JS by default with islands architecture for interactive components. Perfect for blogs, marketing sites, documentation, and e-commerce storefronts.
- **`desktop-autoupdate-signing`** (premium) - Desktop application auto-update + code signing: code-signing certificates (Apple, Microsoft, Linux), notarization, Squirrel/Sparkle/electron-updater, signed manifests, staged rollout, rollback strategy, and the workflows that prevent a malicious or broken update from reaching every user silently.
- **`electron-desktop-apps`** (premium) - Electron application architecture: main vs renderer process boundaries, IPC, contextIsolation + sandbox, native integration (menus, tray, dock), packaging via electron-builder/forge, deep linking, single-instance, performance, and the security patterns that prevent renderer compromise from owning the user's machine.
- **`hono-edge`** (premium) - Expert in Hono - the ultrafast web framework built for the edge. Runs on Cloudflare Workers, Deno, Bun, Fastly, AWS Lambda, and Node.js. TypeScript-first with fantastic DX and near-zero overhead.
- **`htmx-patterns`** (premium) - Expert in HTMX - the library that gives HTML superpowers. Build dynamic web applications by extending HTML with attributes for AJAX, CSS Transitions, WebSockets, and Server-Sent Events. The hypermedia renaissance.
- **`nextjs-app-router`** (premium) - Next.js 14+ App Router, React Server Components, Server Actions expert
- **`nextjs-middleware`** (premium) - Expert at building Next.js Middleware patterns. Covers request rewriting, redirects, authentication checks, geo-routing, A/B testing at edge, rate limiting, bot detection, header manipulation, path matching, chaining middleware logic, and edge runtime limitations.
- **`nextjs-server-actions`** (premium) - Expert at building Next.js Server Actions patterns. Covers form handling with actions, useFormStatus, useFormState, optimistic updates with useOptimistic, revalidation (revalidatePath/revalidateTag), error handling, file upload via actions, progressive enhancement, security (closures, bound args), and middleware interaction.
- **`npm-publishing`** (premium) - Publishing JavaScript and TypeScript packages to npm covering versioning, ESM/CJS dual-publish, type definitions, prerelease channels, security (provenance, 2FA), and the difference between "it works in my repo" and "it works in 100,000 downstream consumers".
- **`remix-framework`** (premium) - Expert in Remix - the full-stack web framework focused on web standards and modern UX. Progressive enhancement, nested routes, parallel data loading, and seamless server/client code sharing. Built on React Router.
- **`shadcn-ui`** (premium) - Expert in shadcn/ui - the copy-paste component library built on Radix UI primitives and Tailwind CSS. Not a traditional npm package but a collection of reusable components you own and customize. The de facto standard for modern Next.js applications.
- **`tauri-desktop`** (premium) - Expert in Tauri - the framework for building tiny, fast desktop applications with web technologies and a Rust backend. 10x smaller than Electron, native performance, cross-platform (Windows, macOS, Linux).
- **`typescript-strict`** (premium) - TypeScript strict mode patterns and type safety for bulletproof applications

## frontend

_40 skills_

- **`accessibility`** (free) - Building inclusive web experiences - WCAG compliance, ARIA patterns, keyboard navigation, and screen reader compatibility
- **`admin-crud-workflows`** (premium) - Admin panels and internal tools: list/detail/edit views, filters, bulk actions, moderation queues, impersonation, audit-safe destructive operations, and the UX patterns that prevent admins from accidentally nuking production data.
- **`ai-streaming-interfaces`** (premium) - Building streaming text UIs for AI applications including SSE consumption, typewriter effects, markdown rendering, abort handling, and memory-safe stream management
- **`angular`** (premium) - Enterprise Angular framework with signals, standalone components, and RxJS patterns
- **`app-store-release-ops`** (premium) - iOS App Store + Google Play release operations: TestFlight / internal / closed / open testing tracks, phased rollout, review metadata, privacy nutrition labels, signing certificates, version+build numbering, rollback strategy, and the workflows that prevent a botched release from breaking thousands of users.
- **`browser-extension-builder`** (premium) - Expert in building browser extensions that solve real problems - Chrome, Firefox, and cross-browser extensions with Manifest V3, content scripts, service workers, and Chrome Web Store publishing.
- **`browser-extension-publishing`** (premium) - Browser-extension publishing operations: Chrome Web Store, Firefox Add-ons, Edge Add-ons, manifest v3 packaging, permission justification, store review handling, signed-update channels, version + rollout management, and the workflows that prevent a botched extension from breaking thousands of users overnight.
- **`bulk-actions-safety`** (premium) - Safe bulk-action UX for tables and lists: selection model (visible vs matching), typed-confirm patterns, partial-failure handling, async progress, undo affordances, and the server-side guarantees that prevent a single click from destroying production data.
- **`dark-mode-theming`** (premium) - Expert at building theme systems and dark mode for React/Next.js apps. Covers next-themes setup, CSS custom properties, Tailwind dark mode, system preference detection, flash prevention (FOUC), theme persistence, multiple themes, component-level theming, shadcn/ui tokens, and color contrast.
- **`data-dashboard-design`** (premium) - Data dashboard UX: metric tile design, time-range pickers, drill-downs, empty states, loading states, comparison views, scanability hierarchy, and the patterns that make dashboards a tool people use instead of a wall of charts they ignore.
- **`expo`** (premium) - Expert in Expo for React Native development - Expo Router, EAS Build/Submit, OTA updates, and native module integration
- **`form-wizard-workflows`** (premium) - Multi-step form wizards: step-by-step UX, draft persistence, server-side validation per step, branching paths, recovery from interrupted sessions, back/forward navigation, and the data model that supports resume.
- **`forms-validation`** (free) - Expert at building robust form experiences with React Hook Form, Zod, server validation, and accessible error handling
- **`framer-motion-react`** (premium) - Expert at building production animations with Framer Motion for React. Covers motion components, variants, AnimatePresence, layout animations, gesture handling (drag, hover, tap), scroll-triggered animations, shared layout animations, exit animations, spring physics, keyframes, and stagger children patterns.
- **`frontend`** (premium) - Production frontend engineering - React/Vue/Svelte, performance, accessibility
- **`frontend-engineer`** (free) - World-class frontend engineering - React philosophy, performance, accessibility, and production-grade interfaces
- **`i18n`** (premium) - Multi-language application development with next-intl, react-i18next, ICU MessageFormat, RTL support, and translation workflows
- **`image-optimization-cdn`** (premium) - Image delivery pipelines with responsive assets, CDN transforms, modern formats, caching, and Core Web Vitals optimization.
- **`infinite-scroll-pagination`** (premium) - Infinite scroll, cursor pagination, virtual scrolling, and scroll position restoration
- **`interactive-portfolio`** (premium) - Expert in building portfolios that actually land jobs and clients
- **`map-location-features`** (premium) - Map UX and location features: geocoding, places autocomplete, distance/radius filters, clustering, marker layers, geolocation permission UX, offline tiles, and the data model for venues, addresses, and geo queries.
- **`mobile-offline-sync`** (premium) - Mobile offline-first sync: local DB (SQLite/Realm/WatermelonDB), outbox pattern, conflict resolution (LWW, CRDT, manual), background sync, optimistic UI, queue retries, and the data-model patterns that prevent offline mode from becoming a data-corruption hazard.
- **`pwa-progressive-web-app`** (premium) - Progressive Web Apps with service workers, Workbox, cache strategies, push notifications, and offline
- **`react-native-specialist`** (premium) - Cross-platform mobile development specialist for React Native, Expo, native modules, and mobile-specific patterns
- **`react-patterns`** (free) - React hooks, composition, and component patterns for production apps
- **`responsive-mobile-first`** (free) - Expert at building mobile-first responsive designs. Covers Tailwind breakpoints, container queries, fluid typography (clamp), responsive images (srcset/sizes), touch targets, responsive navigation patterns, viewport units, responsive data tables, skeleton screens, and responsive forms.
- **`roles-permissions-ui`** (premium) - Permission-aware UX: role/permission matrix display, disable-vs-hide decisions, contextual explanations for forbidden actions, role assignment flows, and the patterns that surface capability without enabling unauthorized access.
- **`scroll-experience`** (premium) - Expert in building immersive scroll-driven experiences and parallax storytelling
- **`search-filters-saved-views`** (premium) - Filter UX for tables and search results: faceted filters, query-param URL state, saved views (per-user and shared), filter combinators (AND/OR/NOT), empty-state messaging, performance with large datasets, and the server query model that backs them.
- **`state-management`** (premium) - Expert in frontend state management patterns - Redux, Zustand, Jotai, Context, and architectural decisions
- **`svelte-kit`** (premium) - Build reactive web applications with Svelte 5 runes, SvelteKit routing, form actions, and SSR
- **`sveltekit`** (premium) - SvelteKit full-stack web apps with SSR, form actions, and Svelte 5 runes
- **`tailwind-ui`** (premium) - Tailwind CSS styling, responsive design, and component patterns
- **`tanstack-query`** (premium) - Expert in server state management with TanStack Query (React Query). Caching strategies, query invalidation, optimistic updates, infinite queries, prefetching, and building responsive data-driven UIs.
- **`tanstack-table`** (premium) - Expert at building complex data grids with TanStack Table (React Table v8). Covers column definitions, sorting, filtering (global + column), pagination (client + server), row selection, column visibility, pinning, virtual scrolling, custom cell renderers, server-side operations, and export functionality.
- **`threejs-3d-graphics`** (premium) - Building 3D web experiences with Three.js - scenes, materials, animations, and WebGL optimization
- **`toast-notification-ui`** (premium) - Expert at building toast notifications and feedback UI. Covers sonner, react-hot-toast, custom toast systems, promise-based toasts, action toasts, stacking behavior, positioning, accessibility (aria-live), auto-dismiss, persistent notifications, toast queuing, and mobile-safe positioning.
- **`user-settings-account-management`** (premium) - User-facing account management UX: profile editing, password change with re-auth, email change with verification, 2FA setup, account deletion and data export (GDPR Article 15 + 17), session management, and the safety rails that prevent accidental account loss.
- **`vue-nuxt`** (premium) - Vue 3 Composition API and Nuxt 3 full-stack framework expert
- **`web-notification-inbox`** (premium) - In-app notification center: bell icon with unread badge, dropdown panel, full inbox page, real-time updates via WebSocket/SSE, mark-as-read, archive, mute-by-category, and the data model that supports both ephemeral toasts and persistent inbox entries.

## game-dev

_45 skills_

- **`animation-systems`** (premium) - Expert in real-time game animation systems - state machines, blend trees, IK, root motion, and responsive character animation
- **`combat-design`** (premium) - Designing visceral, satisfying combat systems with proper frame data, hitboxes, and game feel that makes every hit impactful
- **`creature-design`** (premium) - Designing anatomically plausible, visually distinctive creatures that communicate threat, personality, and role through form
- **`demoscene-coding`** (premium) - Size-optimized graphics programming - 64k/4k/1k intros, shader golf, procedural generation, and bytebeat music synthesis
- **`easter-egg-design`** (premium) - Creating memorable hidden content, secrets, and rewards that delight players without disrupting gameplay
- **`environment-art`** (premium) - Expert game environment art - modular level design, terrain systems, prop placement, and world-building pipelines
- **`game-ai-behavior`** (premium) - Building intelligent NPC behaviors using behavior trees, state machines, GOAP, and utility AI
- **`game-ai-behavior-trees`** (premium) - Expert at building modular, debuggable AI behaviors using behavior trees for game NPCs and agents. Covers tree structure, node types, blackboards, LLM integration, performance optimization, and debugging strategies across Unity, Unreal, and Godot engines.
- **`game-audio`** (premium) - Designing adaptive game audio systems, implementing spatial sound, and creating audio that enhances gameplay feedback
- **`game-design`** (premium) - Designing engaging game mechanics, systems, progression, and player experiences
- **`game-design-core`** (premium) - The foundational theory of interactive experience design - loops, motivation, feel, and the art of meaningful play
- **`game-monetization`** (premium) - Designing ethical, sustainable game monetization that respects players while building profitable games
- **`game-networking`** (premium) - Multiplayer game networking - client-server architecture, lag compensation, and netcode patterns
- **`gamification-loops`** (premium) - Turning products into experiences people can't put down - ethical engagement design
- **`generative-art`** (premium) - Creating art with code - algorithms, shaders, and procedural beauty
- **`godot-development`** (premium) - Building games with Godot engine using GDScript, C#, and the scene/node architecture
- **`godot-llm-integration`** (premium) - Integrate LLM/AI capabilities into Godot 4 games - NPCs, dialogue, dynamic content
- **`level-design`** (premium) - Crafting game spaces that guide players, create memorable moments, and serve gameplay without explicit instruction
- **`lighting-design`** (premium) - Expert game lighting design - baked/realtime systems, global illumination, time-of-day, and performance-conscious lighting pipelines
- **`llm-game-development`** (premium) - Master of using LLMs throughout the game development lifecycle - from design to implementation to debugging
- **`llm-npc-dialogue`** (premium) - Building AI-powered NPCs that maintain personality, remember conversations, and never break character
- **`mobile-game-dev`** (premium) - Expert mobile game developer specializing in iOS/Android optimization, touch input, battery management, and app store submission
- **`narrative-design`** (premium) - Crafting stories that serve gameplay, creating meaningful player choices, and building narrative systems that scale
- **`physics-simulation`** (premium) - Numerical methods for physical systems simulation including rigid body dynamics and FEM
- **`pixel-art`** (premium) - Creating expressive, readable pixel art with intentional constraints, proper scaling, and animation fundamentals
- **`player-onboarding`** (premium) - Designing tutorials and first-time experiences that teach without boring, engage without overwhelming, and retain without forcing
- **`procedural-generation`** (premium) - Generating content algorithmically - terrain, dungeons, textures, and game worlds
- **`progression-systems`** (premium) - Expert in game progression design - XP curves, skill trees, reward pacing, and the psychology of "one more turn"
- **`prompt-to-game`** (premium) - Vibe coding mastery - generate playable games from natural language prompts
- **`puzzle-design`** (premium) - Crafting puzzles that teach through play, create "aha" moments, and challenge without frustrating
- **`rigging-animation`** (premium) - Expert character rigging and deformation systems - skeleton hierarchies, weight painting, FK/IK, facial rigs, and game engine integration
- **`roblox-development`** (premium) - Expert Roblox game development - Lua scripting, server-client architecture, DataStore management, and monetization
- **`shader-programming`** (premium) - GPU shader development - GLSL, HLSL, visual effects, post-processing, and performance optimization
- **`streamer-bait-design`** (premium) - Design games optimized for streaming and content creation with proximity voice chat, social deduction, and viral moment engineering
- **`tabletop-rpg-design`** (premium) - Design tabletop roleplaying games with dice mechanics, character creation, combat systems, and narrative frameworks
- **`texture-art`** (premium) - Expert PBR texturing and material creation - Substance workflows, normal map baking, trim sheets, and game-optimized texture pipelines
- **`unity-development`** (premium) - Building games and interactive experiences with Unity engine, C#, MonoBehaviours, and modern Unity patterns
- **`unity-llm-integration`** (premium) - Integrate LLM/AI capabilities into Unity games - NPCs, dialogue, procedural content
- **`unreal-engine`** (premium) - Building games with Unreal Engine using C++, Blueprints, and modern UE5 features
- **`unreal-llm-integration`** (premium) - Integrate LLM/AI capabilities into Unreal Engine 5 - NPCs, dialogue, procedural content
- **`vfx-realtime`** (premium) - Expert real-time VFX - particle systems, shader effects, game juice, and performance-conscious visual effects
- **`voxel-art`** (premium) - Expert voxel art creation - MagicaVoxel workflows, palette design, animation, mesh conversion, and game engine optimization
- **`vr-ar-development`** (premium) - VR and AR application development covering Unity XR, Unreal XR, WebXR, and visionOS. Spatial input, comfort, locomotion, hand tracking, occlusion, the rendering budgets that decide whether your user gets sick, and the gap between "works on the headset I tested with" and "works on the four headsets your users actually own".
- **`weapon-design`** (premium) - Expert game weapon design - silhouettes, material language, rarity systems, and the art of making players covet polygons
- **`worldbuilding`** (premium) - Expert fictional world creation - magic systems, cultures, histories, and the art of consistent sub-creation

## infrastructure

_4 skills_

- **`aws-serverless`** (premium) - Production AWS serverless - Lambda, API Gateway, DynamoDB, and event-driven architectures
- **`azure-functions`** (premium) - Expert patterns for Azure Functions development including isolated worker model, Durable Functions orchestration, and cold start optimization
- **`docker-containerization`** (premium) - Production container images - multi-stage builds, security hardening, layer optimization, and registry management
- **`kubernetes-deployment`** (premium) - Production Kubernetes deployment expertise - rolling updates, Helm, debugging, and the battle scars from 3am pages.

## integrations

_27 skills_

- **`bullmq-specialist`** (premium) - BullMQ Redis-backed job queues for background processing and reliable async execution
- **`discord-bot-architect`** (premium) - Production Discord bots - slash commands, interactions, sharding, and rate limit handling
- **`email-systems`** (premium) - Transactional email, marketing automation, deliverability, and React Email templates
- **`email-template-systems`** (premium) - Transactional email template systems: MJML/React-Email/Handlebars templating, dark-mode variants, localization, preview tooling, version control, A/B testing, accessibility, plain-text alternatives, and rendering pipelines that survive Outlook.
- **`fintech-integration`** (premium) - Integrate Plaid, Stripe, payment processors, and financial APIs with production-grade security, compliance, and reliability
- **`headless-cms-integration`** (premium) - Headless CMS integration patterns for structured content, previews, ISR and revalidation, localization, and content delivery performance.
- **`hubspot-integration`** (premium) - Expert patterns for HubSpot CRM API integration including OAuth, CRM objects, associations, batch operations, and webhooks
- **`inngest`** (premium) - Inngest expert for serverless-first background jobs, event-driven workflows, and durable execution without managing queues or workers.
- **`integration-patterns`** (premium) - API gateways, event-driven architecture, and ESB patterns that prevent the N-squared spaghetti nightmare and cascading failures
- **`intercom-implementation`** (premium) - Implement Intercom for customer support, product tours, and conversational marketing at scale
- **`klaviyo-ecommerce`** (premium) - Build revenue-driving email and SMS flows for e-commerce with segmentation, personalization, and attribution
- **`lemonsqueezy-payments`** (premium) - Lemon Squeezy payment integration for indie hackers including product setup, checkout overlays, webhook handling, license keys, subscription management, and digital product delivery
- **`nextjs-supabase-auth`** (premium) - Supabase Auth integration with Next.js App Router, middleware, and SSR
- **`plaid-fintech`** (premium) - Expert patterns for Plaid API integration including bank account linking, transactions sync, identity verification, and ACH payments
- **`resend-email`** (premium) - Transactional email with Resend and React Email, domain authentication, deliverability, webhooks, and template-safe sending workflows.
- **`segment-cdp`** (premium) - Expert patterns for Segment Customer Data Platform including event tracking, identity resolution, tracking plans, and destination configuration
- **`shopify-apps`** (premium) - Expert patterns for Shopify app development with React Router, App Bridge, GraphQL Admin API, and embedded app architecture
- **`slack-bot-builder`** (premium) - Production Slack apps with Bolt - Block Kit, workflows, OAuth installation, and interactive components
- **`stripe-integration`** (free) - Stripe payments, subscriptions, webhooks, and billing portal
- **`stripe-subscriptions`** (premium) - Stripe SaaS billing patterns including Checkout Sessions, subscription lifecycle, webhook handling, metered billing, usage-based pricing, and Stripe Tax
- **`telegram-bot-builder`** (premium) - Expert in building Telegram bots that solve real problems - from simple automation to complex AI-powered bots with webhooks, inline keyboards, payments, and scaling to thousands of users
- **`telegram-mini-app`** (premium) - Expert in building Telegram Mini Apps (TWA) - web apps that run inside Telegram with native-like experience, TON Connect integration, payments, and viral mechanics
- **`trigger-dev`** (premium) - Trigger.dev background jobs and AI workflows with TypeScript-first design
- **`twilio-communications`** (premium) - Expert patterns for Twilio SMS, Voice, WhatsApp, and Verify API integration with compliance and rate limiting
- **`upstash-qstash`** (premium) - Serverless message queues and scheduled jobs via HTTP
- **`video-embedding-streaming`** (premium) - Video platform integration and streaming delivery with embeds, HLS and DASH, uploads, captions, analytics, and CDN optimization.
- **`zendesk-architecture`** (premium) - Design and implement enterprise Zendesk instances with custom workflows, automations, and integrations

## marketing

_43 skills_

- **`ad-copywriting`** (premium) - Direct response ad copywriting - headlines, body copy, CTAs that convert paid media into revenue
- **`ai-ad-creative`** (premium) - AI-powered performance marketing creative - ad generation at scale, creative testing, DCO, platform-native optimization
- **`ai-audio-production`** (premium) - AI audio production mastery - Suno, Udio, ElevenLabs, sound design, music generation
- **`ai-brand-kit`** (premium) - Build comprehensive AI-native brand asset systems that maintain consistency across all AI-generated content
- **`ai-content-analytics`** (premium) - Measure, attribute, and optimize AI-generated content performance with business outcome focus
- **`ai-content-qa`** (premium) - Systematic quality assurance for AI-generated and human-written marketing content
- **`ai-creative-director`** (premium) - AI creative orchestration - multi-tool workflows, production pipelines, campaign coordination
- **`ai-image-generation`** (premium) - AI image generation mastery - Midjourney, Flux, DALL-E, Stable Diffusion for marketing, product, and creative visuals
- **`ai-localization`** (premium) - AI-powered localization - translation, cultural adaptation, voice dubbing, global content
- **`ai-trend-alchemy`** (premium) - AI-powered trend prediction and viral content creation - timing, detection, memetic engineering
- **`ai-video-generation`** (premium) - AI video generation mastery - Veo3, Runway Gen-3, Sora, Kling, Pika, Luma Dream Machine
- **`ai-visual-effects`** (premium) - AI-powered visual effects, compositing, upscaling, and post-production for polished content
- **`ai-workflow-automation`** (premium) - Orchestrate AI content pipelines with quality gates, approvals, and multi-channel distribution
- **`ai-world-building`** (premium) - Create consistent, explorable brand universes with AI-generated characters and environments
- **`anti-marketing`** (premium) - Expert in brutally honest, self-deprecating marketing that converts - turning weaknesses into trust and honesty into differentiation
- **`blog-writing`** (premium) - Legendary blog writing that makes readers forget they're reading - technical explainers, thought leadership, tutorials
- **`brand-storytelling`** (premium) - Narrative-driven brand communication - origin stories, customer journeys, emotional connection, transmedia storytelling
- **`content-strategy`** (premium) - World-class content strategy expertise combining Andy Crestodina's data-driven approach, Ann Handley's "everybody writes" philosophy, and the content engines that power HubSpot, Ahrefs, and Intercom.
- **`copywriting`** (premium) - World-class copywriting expertise combining David Ogilvy's persuasive clarity, Ann Handley's conversational warmth, and modern conversion science. Where brand voice becomes words that move people to action.
- **`creative-communications`** (premium) - Produce creative assets that communicate brand, product, and message effectively across channels
- **`digital-humans`** (premium) - Create AI-powered digital presenters, avatars, and synthetic spokespersons at scale
- **`explainer-videos`** (premium) - Transform complex ideas into clear, compelling explainer videos that convert
- **`go-to-market`** (premium) - Getting products into customers' hands through deliberate motion selection and execution
- **`growth-loops`** (premium) - Designing and optimizing self-reinforcing growth mechanics that compound over time
- **`launch-storytelling`** (premium) - Crafting compelling product and company launch narratives - timing, narrative arc, channel strategy, and the art of creating buzz
- **`marketing`** (premium) - World-class marketing expertise - go-to-market strategy, channel sequencing, campaign optimization, and growth systems
- **`marketing-fundamentals`** (premium) - Core marketing principles for startups - positioning, messaging, channels, growth, unit economics
- **`motion-graphics`** (premium) - World-class motion graphics expertise combining animation principles, kinetic typography, and visual storytelling for dynamic brand experiences
- **`pitch-narrative`** (premium) - Crafting compelling stories that move people to action - investor pitches, sales presentations, partnership proposals, and team rallying stories
- **`pricing-strategy`** (premium) - The most powerful lever you're not pulling - capturing value you create
- **`product-led-growth`** (premium) - Building products that drive acquisition, activation, conversion, and expansion through self-serve excellence
- **`product-market-fit`** (premium) - Finding and measuring the elusive condition where product meets desperate market need
- **`prompt-engineering-creative`** (premium) - Creative prompt engineering mastery - AI image, video, audio prompting strategies
- **`real-time-content`** (premium) - The speed layer of AI-native marketing - creating and deploying content in real-time responding to trends, events, and cultural moments
- **`seo`** (premium) - Search engine optimization - technical SEO, content strategy, link building, Core Web Vitals
- **`session-recording-analytics`** (premium) - Implement session recording, heatmaps, and behavioral analytics with privacy compliance and performance optimization
- **`synthetic-influencers`** (premium) - Creating and managing AI-generated brand ambassadors with perfect consistency, infinite availability, and strategic authenticity
- **`video-directing`** (premium) - World-class video directing mastery drawing from the greatest filmmakers - visual storytelling, shot composition, and emotional orchestration
- **`video-production`** (premium) - World-class video production expertise - pre-production planning, shooting, editing, and multi-platform optimization
- **`video-scriptwriting`** (premium) - Craft of writing for screen - from 6-second ads to brand films with visual thinking, pacing, and relentless attention engineering
- **`viral-generator-builder`** (premium) - Expert in building shareable generator tools that go viral
- **`viral-marketing`** (premium) - Engineering word-of-mouth growth - viral loops, referral programs, k-factor optimization, share mechanics
- **`voiceover`** (premium) - World-class voiceover expertise - voice casting, direction, AI voice production, and audio quality standards

## mcp

_4 skills_

- **`mcp-deployment`** (premium) - Production deployment patterns for MCP servers - Docker, cloud, monitoring, scaling
- **`mcp-security`** (premium) - Production security for MCP servers - OAuth, rate limiting, input validation, prompt injection defense, audit logging
- **`mcp-server-development`** (premium) - Building production-ready Model Context Protocol servers with tools, resources, and prompts
- **`mcp-testing`** (premium) - Test MCP servers with comprehensive strategies - Inspector, unit, integration, transport, security

## methodology

_1 skills_

- **`productivity-ai-tools`** (premium) - Master AI tools for meetings, email, scheduling, and personal productivity to eliminate administrative overhead

## performance

_1 skills_

- **`performance-optimization`** (premium) - Expert at diagnosing and fixing performance bottlenecks across the full stack - measure first, optimize second

## product

_13 skills_

- **`a-b-testing`** (premium) - The science of learning through controlled experimentation. A/B testing isn't about picking winners - it's about building a culture of validated learning and reducing the cost of being wrong.
- **`analytics`** (premium) - Event tracking, metrics design, dashboards, and data-driven decision making
- **`changelog-roadmap`** (premium) - Public changelog, roadmap boards, feature voting, release notes, and user feedback systems
- **`customer-onboarding-success`** (premium) - Customer-onboarding (CSM) and success ops: implementation tasks, kickoff → handoff workflow, account health scoring, success-plan tracking, expansion / churn-risk signals, and the data model that turns customer-success from heroic firefighting into a repeatable system.
- **`customer-success`** (premium) - Onboarding that activates, health scores that predict, retention plays that save
- **`experiment-feature-analysis`** (premium) - A/B experimentation discipline: hypothesis design, sample-size + power, guardrail metrics, statistical significance vs practical significance, segment stratification, peeking penalties, rollout decisions, and the workflows that prevent shipping winners that actually lose.
- **`feature-onboarding-checklists`** (premium) - Activation checklists, first-run experiences, and progressive onboarding: step definition, completion detection, gating UX, dismissal/snooze, re-engagement nudges, segmentation by user/role, and the analytics that prove the checklist actually drives activation.
- **`feature-prioritization`** (premium) - Decide what to build and in what order using frameworks and evidence
- **`onboarding-flows`** (premium) - User onboarding, activation flows, progressive disclosure, and product tour implementation
- **`product-analytics-engineering`** (premium) - Production-grade analytics instrumentation across Mixpanel, Amplitude, PostHog, Heap, and warehouse-native approaches
- **`product-discovery`** (premium) - Finding what to build before wasting resources building the wrong thing
- **`product-feedback-roadmapping`** (premium) - Customer-feedback capture, deduplication, voting, prioritization, and closing-the-loop with submitters. The data model and workflows that prevent feedback from becoming a graveyard of unread tickets.
- **`product-management`** (premium) - World-class product management expertise combining Marty Cagan's empowered teams, Shreyas Doshi's strategic clarity, and execution discipline from the best Silicon Valley PMs. Where strategy meets execution, problems meet outcomes.

## science

_1 skills_

- **`statistical-analysis`** (premium) - Applied statistical analysis for product, ML, and research decisions covering hypothesis tests, confidence intervals, sample-size calculation, multiple-comparison correction, and the gap between "p < 0.05" and "this finding will hold next quarter".

## security

_24 skills_

- **`ai-code-security`** (premium) - Security expert for AI-generated code and LLM applications. Covers OWASP Top 10 for LLMs, secure coding patterns for AI outputs, validation pipelines, sandboxing, and AI-specific threat models.
- **`api-security`** (premium) - Secure API design and defense covering authentication, authorization, request validation, replay protection, rate limiting, and common abuse paths in public and internal APIs.
- **`audit-logging`** (premium) - Tamper-resistant audit logging for security-sensitive product actions, admin activity, identity changes, and compliance-grade operational traceability.
- **`auth-specialist`** (premium) - Authentication and authorization expert for OAuth, sessions, JWT, MFA, and identity security
- **`authentication-oauth`** (free) - OAuth 2.0/OIDC, JWT tokens, session management, and password security specialist
- **`clerk-auth`** (premium) - Production authentication with Clerk - middleware protection, organizations, webhooks, and user sync
- **`compliance-automation`** (premium) - Policy-as-code and continuous compliance - SOC2, ISO27001, PCI-DSS, HIPAA automation that survives audits and prevents the $5M fine
- **`container-security`** (premium) - Container security for image hardening, runtime isolation, secret safety, registry policy, and Kubernetes or container deployment risk reduction.
- **`cryptography`** (premium) - Applied cryptography for production systems covering key management, encryption-at-rest and in-transit, signing and verification, password hashing, and the rule that you should never roll your own crypto - but you do need to know enough to choose, configure, and rotate it correctly.
- **`cybersecurity`** (premium) - Security engineer who has responded to breaches, conducted penetration tests, and built security programs from the ground up - believes in defense in depth, never shames developers, and makes secure the default
- **`data-retention-deletion`** (premium) - Data retention and deletion: per-class retention policies, scheduled deletion jobs, GDPR Article 17 erasure, CCPA delete, fan-out across services, legal-hold overrides, soft-delete vs hard-delete, backups, and the audit trail that proves deletion happened.
- **`export-control`** (premium) - ITAR/EAR export compliance - classification, screening, licensing, and technology control plans
- **`gdpr-privacy`** (premium) - GDPR privacy compliance - lawful basis, data subject rights, DPIAs, breach response, and regulatory enforcement
- **`identity-access-management`** (premium) - Enterprise identity and access architecture for users, orgs, service accounts, permissions, and least-privilege enforcement across product and infrastructure boundaries.
- **`passkeys-webauthn`** (premium) - Passwordless authentication with WebAuthn and passkeys including registration, authentication, cross-device flows, fallback strategies, and SimpleWebAuthn library patterns
- **`privacy-consent-management`** (premium) - GDPR/CCPA/CPRA-compliant consent capture, storage, propagation, and revocation across web, mobile, server, and third-party tags — cookie banners, IAB TCF, granular preferences, audit trail, DSR fulfillment, and tag-firing gates.
- **`prompt-injection-defense`** (premium) - Defense techniques against prompt injection attacks - the
- **`secrets-management`** (premium) - Secure secret storage, rotation, access control, injection, and leak recovery patterns for applications, CI, containers, and cloud infrastructure.
- **`security-engineer`** (premium) - Application security expert - OWASP Top 10, secure coding, threat modeling, zero trust. One breach = game over.
- **`security-hardening`** (premium) - Application security hardening - OWASP Top 10, secure coding patterns, and battle scars from security incidents
- **`security-owasp`** (free) - Web application security - OWASP Top 10, injection, XSS, CSRF, access control
- **`supabase-auth-rls`** (premium) - Supabase Auth and Row Level Security patterns including RLS policies, auth.uid(), service role management, social providers, custom claims, multi-tenant RLS, and policy composition
- **`supply-chain-security`** (premium) - Software supply chain security for dependencies, build integrity, provenance, artifact trust, CI hardening, and third-party component risk management.
- **`threat-modeling`** (premium) - Practical threat modeling for product, API, infra, and AI systems using trust boundaries, abuse cases, attacker thinking, and backlog-ready mitigations.

## space

_6 skills_

- **`ground-station-ops`** (premium) - Ground station network design, satellite contact scheduling, telemetry processing, and spacecraft commanding
- **`mission-planning`** (premium) - Designing space missions including launch windows, trajectory optimization, mass budgets, and mission timelines
- **`monte-carlo`** (premium) - Monte Carlo methods for uncertainty quantification, risk analysis, and probabilistic simulation
- **`orbital-mechanics`** (premium) - Computing orbits, planning maneuvers, propagating trajectories, and analyzing orbital perturbations
- **`space-data-processing`** (premium) - Processing satellite imagery, remote sensing data, and applying machine learning to Earth observation
- **`spacecraft-systems`** (premium) - Designing and analyzing spacecraft subsystems including ADCS, power, thermal, propulsion, and communications

## startup

_4 skills_

- **`burn-rate-management`** (premium) - Runway calculation, default alive analysis, cash management, and survival math for startups
- **`micro-saas-launcher`** (premium) - Expert in launching small, focused SaaS products fast - the indie hacker approach to building profitable software with MVP development, pricing, launch strategies, and sustainable revenue
- **`waitlist-launch-pages`** (premium) - Pre-launch waitlists, viral referral loops, landing page optimization, and beta management
- **`yc-playbook`** (premium) - The YC meta-game - demo day prep, batch dynamics, talking to users, doing things that don't scale

## strategy

_28 skills_

- **`brand-positioning`** (premium) - Position brands to own territory in customer minds - combines Ogilvy, Ries/Trout positioning classics, and Emily Heyward's obsessive strategy
- **`business-model-design`** (premium) - Expert in designing how companies create, deliver, and capture value
- **`channel-partnerships`** (premium) - Building and scaling partner ecosystems that extend reach and revenue through resellers, agencies, and integrations
- **`community-led-growth`** (premium) - Expert in community-led growth (CLG) - turning passionate users into acquisition engines, retention magnets, and expansion drivers through ambassador programs, user groups, and word-of-mouth amplification.
- **`competitive-intelligence`** (premium) - Expert in competitive research, win/loss analysis, and building competitive advantage
- **`contract-analysis`** (premium) - AI-powered contract review, clause extraction, risk scoring, and playbook compliance
- **`conversion-rate-optimization`** (premium) - Expert CRO guidance for A/B testing, funnel optimization, landing pages, and statistical analysis to maximize conversions ethically
- **`creative-strategy`** (premium) - Bridge between business objectives and creative execution - conceptual brilliance meets data-informed creativity
- **`decision-frameworks`** (premium) - Systematic decision-making under uncertainty - reversibility assessment, stakeholder alignment, and the frameworks that prevent analysis paralysis
- **`decision-maker`** (premium) - Technical decision-making frameworks - trade-off evaluation, reversibility analysis, and second-order thinking for better engineering choices
- **`early-stage-hustle`** (premium) - Pre-PMF playbook for doing things that don't scale - manual onboarding, concierge service, recruiting users one by one
- **`founder-character`** (premium) - The traits that predict startup success - from Paul Graham's decades of observation
- **`founder-mode`** (premium) - Paul Graham's founder mode - when to delegate vs dive deep, maintaining velocity while scaling, avoiding professional CEO traps
- **`founder-operating-system`** (premium) - How to work effectively as a founder. Maker vs manager schedule conflicts. Default alive vs dead math. Time and money leaking away. Operating systems for navigating founder-specific challenges.
- **`fundraising-strategy`** (premium) - Strategic capital raising - when, how much, from whom, and at what terms
- **`growth-strategy`** (premium) - World-class growth strategy expertise combining Andrew Chen's marketplace wisdom, Brian Balfour's growth frameworks, Casey Winters' Pinterest/Grubhub playbooks, and Silicon Valley's best growth thinking.
- **`idea-maze`** (premium) - Finding ideas worth building - live in the future, notice what's missing, embrace the schlep
- **`moat-building`** (premium) - Building sustainable competitive advantages that protect margins and market share from competition
- **`negotiation-playbook`** (premium) - Winning negotiations through preparation, value creation, and strategic execution
- **`patent-drafting`** (premium) - Patent application drafting - claims, specifications, prior art analysis, and USPTO prosecution
- **`pivot-patterns`** (premium) - Changing direction without losing momentum - recognizing signals, executing pivots, preserving assets
- **`product-strategy`** (premium) - World-class product strategy expertise combining Marty Cagan's outcome-driven product management, Jobs-to-be-Done frameworks, and Silicon Valley best practices. Answers: "What should we build and why will it win?"
- **`project-management`** (premium) - Operational project management for software teams covering scope decomposition, dependency mapping, schedule risk, status communication, and the difference between "we're on track" and "we're hiding the slip".
- **`sales-strategy`** (premium) - Founder-led and early-stage sales strategy covering ICP definition, pipeline construction, deal qualification, pricing, objection handling, and the gap between "we have leads" and "we have repeatable revenue".
- **`strategic-partnerships`** (premium) - Expert in building alliances that multiply reach and capabilities
- **`system-designer`** (premium) - Software architecture and system design - scalability patterns, reliability engineering, and the art of making trade-offs that survive production
- **`taste-and-craft`** (premium) - Building things that matter - developing taste, pursuing quality, attention to details that separate great from good
- **`thought-leadership`** (premium) - Building authority and industry influence - positioning, speaking, writing, executive visibility

## testing

_9 skills_

- **`playwright-testing`** (free) - Expert in Playwright - the modern end-to-end testing framework for web applications. Cross-browser testing, auto-waiting, powerful selectors, network interception, and visual regression testing. The industry standard for E2E tests.
- **`qa-engineering`** (premium) - QA lead who has built test suites for Netflix-scale companies, caught critical bugs before production, and knows that good testing isn't about finding bugs - it's about preventing them
- **`refactoring-guide`** (premium) - Safe code transformation - Fowler's catalog, strangler fig, and characterization tests that prevent the Big Rewrite disaster
- **`test-architect`** (premium) - Testing strategy specialist for test pyramid design, test isolation, property-based testing, and quality gates
- **`test-strategist`** (premium) - Testing strategy and design - what to test, how to test, and when testing is overkill
- **`testing-automation`** (premium) - Production test automation - E2E, API, CI/CD, flaky test management
- **`testing-strategies`** (free) - Master test strategy - pyramid layers, mocking boundaries, factory patterns, and flaky test prevention
- **`vitest-testing`** (premium) - Expert in Vitest - the blazing fast unit testing framework powered by Vite. Native ESM support, TypeScript out of the box, Jest-compatible API, watch mode with instant feedback, and seamless Vite integration.
- **`web-accessibility-qa`** (premium) - Accessibility QA discipline: automated checks (axe-core, Lighthouse, pa11y), manual testing (keyboard, screen reader, contrast), CI gating, ADA / WCAG compliance evidence, and the workflows that catch a11y regressions before they land in production.

## trading

_5 skills_

- **`quantitative-research`** (premium) - Systematic trading research, backtesting, alpha generation, and factor models
- **`risk-management-trading`** (premium) - Capital preservation, position sizing, drawdown management, and survival
- **`sentiment-analysis-trading`** (premium) - Alternative data and sentiment analysis for extracting alpha from social media, news, on-chain data, and positioning signals
- **`technical-analysis`** (premium) - Price action, chart patterns, indicators, and multi-timeframe analysis
- **`trading-psychology`** (premium) - Emotional control, cognitive biases, discipline, and trading journaling
