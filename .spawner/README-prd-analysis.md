# PRD Analysis Bridge

This document describes how Claude Code responds to PRD analysis requests from Spawner UI.

## Overview

When a user uploads a PRD to Spawner UI, the system writes it to `.spawner/pending-prd.md` and creates a request at `.spawner/pending-request.json`. Claude Code analyzes the PRD and sends results back via HTTP.

## Checking for Pending Requests

1. Check if `.spawner/pending-request.json` exists and has `status: "pending"`
2. Read the PRD content from `.spawner/pending-prd.md`

## Analyzing the PRD

When analyzing a PRD, Claude should:

1. **Identify the project type** (SaaS, marketplace, tool, game, etc.)
2. **Determine complexity** (simple: 4-8 tasks, moderate: 8-15 tasks, complex: 15-25 tasks)
3. **Detect infrastructure needs** - only if explicitly required:
   - Authentication (login, signup, user accounts)
   - Database (persistent data, CRUD operations)
   - API (external integrations, backend services)
4. **Extract features** as actionable tasks
5. **Map to H70 skills** using the spawner-h70 MCP
6. **Define verification criteria** for each task

## Response Format

Send results via POST to `http://localhost:5173/api/events`:

```bash
curl -X POST http://localhost:5173/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "prd_analysis_complete",
    "data": {
      "requestId": "prd-xxx",
      "result": {
        "requestId": "prd-xxx",
        "success": true,
        "projectName": "Project Name",
        "projectType": "saas",
        "complexity": "moderate",
        "infrastructure": {
          "needsAuth": true,
          "authReason": "User accounts required for...",
          "needsDatabase": true,
          "databaseReason": "Storing user data...",
          "needsAPI": false
        },
        "techStack": {
          "framework": "SvelteKit",
          "language": "TypeScript",
          "styling": "Tailwind CSS",
          "database": "Supabase",
          "auth": "Supabase Auth"
        },
        "tasks": [
          {
            "id": "task-1",
            "title": "Set up project structure",
            "description": "Initialize SvelteKit project with TypeScript and Tailwind",
            "skills": ["sveltekit", "typescript-strict"],
            "phase": 1,
            "dependsOn": [],
            "verification": {
              "criteria": ["npm run dev starts without errors", "TypeScript compiles"],
              "files": ["package.json", "svelte.config.js"],
              "commands": ["npm run build"]
            }
          }
        ],
        "skills": ["sveltekit", "typescript-strict", "supabase-auth"],
        "executionPrompt": "..."
      }
    },
    "source": "claude-code"
  }'
```

## Task Count Guidelines

- **Simple projects** (landing page, static site): 4-8 tasks
- **Moderate projects** (single feature app): 8-15 tasks
- **Complex projects** (full SaaS, marketplace): 15-25 tasks
- **Maximum**: Never exceed 30 tasks

## Key Principles

1. **Variable task count** - based on actual complexity, not fixed at 27
2. **Only include what's needed** - no auth if no users, no DB if no persistence
3. **Actionable tasks** - each task should have clear verification criteria
4. **Real intelligence** - analyze semantically, don't pattern match keywords
5. **Complete the project** - all tasks should lead to a working product
