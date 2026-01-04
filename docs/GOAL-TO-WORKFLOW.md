# Goal-to-Workflow System Design

> Transform natural language project descriptions into actionable skill workflows

## Overview

When a user types "I want to build X" and clicks spawn(), the system should:
1. Analyze their description
2. Identify relevant skills from our 450+ skill library
3. Create a starter workflow on the canvas
4. Let them refine from there

---

## Input Types & Handling

### Type 1: Quick One-Liners (1-10 words)
```
"auth system"
"landing page"
"todo API"
```
**Handling:** Expand keywords, infer common patterns
**Example:** "auth system" → supabase-auth, nextjs-app-router, react-patterns

### Type 2: Short Descriptions (10-50 words)
```
"SaaS with user authentication, Stripe payments, and admin dashboard"
```
**Handling:** Extract features, map to skill categories
**Example:** → supabase-auth, stripe-payments, nextjs-app-router, react-admin-patterns

### Type 3: Paragraph Descriptions (50-200 words)
```
"I want to build a project management tool like Linear. It should have
issue tracking, sprint planning, team collaboration, and integrations
with GitHub and Slack."
```
**Handling:** NLP extraction of features, competitor analysis hints, integration detection
**Skills:** project-management patterns, real-time collaboration, github-integration, slack-integration

### Type 4: Full PRD / Long-form (200-10000 words)
```
[Full product requirements document with user stories, technical specs, etc.]
```
**Handling:**
- Summarize to key requirements (first pass)
- Extract technical stack mentions
- Identify user flows
- Limit to top 8-10 most relevant skills
- Store full PRD for reference in project context

### Type 5: Technical Architecture Specs
```
"Next.js 14 App Router, Supabase auth + database, Stripe payments,
Vercel deployment, TailwindCSS"
```
**Handling:** Direct skill matching from tech mentions
**Skills:** Exact matches for mentioned technologies

### Type 6: Vague/Abstract Inputs
```
"something cool"
"make money online"
"the next big thing"
```
**Handling:**
- Show clarifying prompt: "Tell us more! What problem are you solving?"
- Offer starter templates: "SaaS", "E-commerce", "API", "Landing Page"
- Fall back to showing popular/trending skills

### Type 7: Non-English Inputs
```
"Je veux construire une application de commerce"
```
**Handling:**
- Detect language
- Either: translate via API, or show "Please describe in English for best results"
- MVP: English-only with graceful message

### Type 8: Edge Cases
```
- Empty/whitespace only → Button disabled (already implemented)
- Single character → "Please provide more detail"
- >10000 chars → Truncate with notice, process first 10000
- HTML/script injection → Sanitize, strip tags
- Only special chars → "Please describe your project in words"
```

---

## Validation Rules

### Input Validation
```typescript
interface ValidationResult {
  valid: boolean;
  sanitized: string;
  inputType: 'quick' | 'short' | 'paragraph' | 'long' | 'technical' | 'vague';
  warnings: string[];
}

const RULES = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 10000,
  MIN_WORDS_FOR_PROCESSING: 1,
  MAX_SKILLS_TO_SUGGEST: 8,
  MIN_CONFIDENCE_SCORE: 0.3
};
```

### Sanitization
- Strip HTML tags
- Escape special characters
- Normalize whitespace
- Remove null bytes
- Trim leading/trailing whitespace

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Input                                │
│                "Build a SaaS with auth and payments"            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Goal Analyzer Service                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Validate   │→ │   Classify   │→ │   Extract    │          │
│  │    Input     │  │  Input Type  │  │  Keywords    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Skill Matcher Service                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Query MCP    │→ │   Score &    │→ │   Select     │          │
│  │ for Skills   │  │    Rank      │  │   Top N      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  Fallback: Local keyword matching if MCP unavailable            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Workflow Generator Service                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Determine  │→ │   Create     │→ │   Auto       │          │
│  │   Relations  │  │    Nodes     │  │   Layout     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Canvas                                   │
│                                                                  │
│    ┌─────────┐      ┌─────────┐      ┌─────────┐               │
│    │  Auth   │ ───► │  API    │ ───► │ Payments│               │
│    └─────────┘      └─────────┘      └─────────┘               │
│                                                                  │
│    "Based on: Build a SaaS with auth and payments"              │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/lib/
├── services/
│   ├── goal-analyzer.ts      # Validate, classify, extract
│   ├── skill-matcher.ts      # Query MCP, score, rank
│   └── workflow-generator.ts # Create nodes, connections, layout
├── stores/
│   └── project-goal.svelte.ts # Store current goal, persist across nav
└── types/
    └── goal.ts               # Type definitions
```

---

## Service Specifications

### 1. Goal Analyzer Service

```typescript
// src/lib/services/goal-analyzer.ts

interface AnalyzedGoal {
  original: string;
  sanitized: string;
  inputType: InputType;
  keywords: string[];           // Extracted keywords
  technologies: string[];       // Detected tech stack mentions
  features: string[];          // Detected feature requirements
  domains: string[];           // Detected domains (e-commerce, SaaS, etc.)
  confidence: number;          // 0-1 how confident we are in analysis
  needsClarification: boolean; // If input is too vague
  clarificationPrompt?: string; // What to ask user
}

type InputType = 'quick' | 'short' | 'paragraph' | 'long' | 'technical' | 'vague';

export function analyzeGoal(input: string): AnalyzedGoal;
```

**Keyword Extraction Strategy:**
1. Tokenize input
2. Remove stop words
3. Match against known tech/feature vocabulary
4. Score by frequency and position (earlier = more important)

**Technology Detection Patterns:**
```typescript
const TECH_PATTERNS = {
  'next': ['nextjs', 'next.js', 'next js'],
  'react': ['react', 'reactjs'],
  'supabase': ['supabase'],
  'stripe': ['stripe', 'payment', 'payments', 'billing'],
  'auth': ['auth', 'authentication', 'login', 'signup', 'oauth'],
  // ... etc
};
```

### 2. Skill Matcher Service

```typescript
// src/lib/services/skill-matcher.ts

interface MatchedSkill {
  skill: Skill;
  score: number;           // 0-1 relevance score
  matchReason: string;     // Why this skill matched
  category: string;
  tier: number;           // 1=essential, 2=recommended, 3=optional
}

interface MatchResult {
  skills: MatchedSkill[];
  totalMatches: number;
  processingTime: number;
  source: 'mcp' | 'local' | 'hybrid';
}

export async function matchSkills(
  goal: AnalyzedGoal,
  options?: { maxResults?: number; minScore?: number }
): Promise<MatchResult>;
```

**Matching Strategy:**
1. **MCP Query** (if connected):
   - Use `spawner_skills` with search query
   - Use `spawner_plan` for intelligent recommendations

2. **Local Fallback** (if MCP unavailable):
   - Match keywords against skill tags, names, descriptions
   - Use predefined category mappings

3. **Scoring Algorithm:**
   ```
   score = (nameMatch * 0.4) + (tagMatch * 0.3) + (categoryMatch * 0.2) + (descriptionMatch * 0.1)
   ```

### 3. Workflow Generator Service

```typescript
// src/lib/services/workflow-generator.ts

interface GeneratedWorkflow {
  nodes: CanvasNode[];
  connections: Connection[];
  layout: 'linear' | 'tree' | 'grid';
  goalContext: {
    original: string;
    summary: string;
  };
}

export function generateWorkflow(
  skills: MatchedSkill[],
  goal: AnalyzedGoal
): GeneratedWorkflow;
```

**Layout Strategy:**
1. **Tier-based ordering:** Essential skills first, then recommended, then optional
2. **Category grouping:** Group related skills visually
3. **Connection inference:** Connect skills based on `handoffs` and `pairsWell` properties

**Auto-Layout Algorithm:**
```
Row 1: Entry points (auth, data-input)
Row 2: Processing (business logic, APIs)
Row 3: Output (UI, notifications, storage)
```

---

## UI/UX Flow

### Happy Path
```
1. User types description
2. Clicks "spawn()" or presses Enter
3. Shows loading: "Analyzing your project..."
4. Navigates to canvas with skills pre-populated
5. Shows toast: "Added 5 skills based on your description"
6. Goal shown in header: "Project: Build a SaaS with auth..."
```

### Error States
```
- MCP unavailable: "Using local skill matching (connect to MCP for better results)"
- No skills found: "Couldn't find matching skills. Try being more specific."
- Too vague: Show inline prompt asking for more detail
- Too long: "We've processed the first part of your description"
```

### Loading States
```
1. Button changes to "Analyzing..."
2. Brief animation (0.5-2s)
3. Smooth transition to canvas
4. Skills animate in one by one (optional polish)
```

---

## Questions to Address

### Q1: What if someone pastes an entire codebase?
**A:** Limit to 10,000 characters. Show: "We've analyzed the key parts of your input."

### Q2: What if MCP is slow (>5s)?
**A:** Show progress: "Still analyzing... (this is a complex project)"
Timeout at 10s, fall back to local matching.

### Q3: What if they want to refine the suggestions?
**A:**
- Skills panel still accessible for adding more
- Each auto-added node has "Suggested" badge
- Easy to remove unwanted skills
- "Regenerate suggestions" button in toolbar

### Q4: What about returning users?
**A:**
- If canvas already has nodes: "Add to existing workflow?" vs "Start fresh?"
- Store goal history for "Recent projects" feature later

### Q5: Should we save the goal with the canvas?
**A:** Yes. Store in canvas save data so when they reload, context is preserved.

### Q6: What if the same skill is suggested multiple times?
**A:** Deduplicate by skill ID before adding to canvas.

### Q7: Non-technical users vs developers?
**A:** Detect based on input:
- Technical terms → assume developer, show more skills
- Business language → assume non-technical, show fewer, simpler skills

---

## Implementation Order

1. **Phase 1: Basic Flow** (MVP)
   - Pass goal via URL param
   - Simple keyword extraction
   - Local skill matching (no MCP)
   - Basic auto-layout

2. **Phase 2: Smart Matching**
   - MCP integration for skill search
   - Better scoring algorithm
   - Category-aware layout

3. **Phase 3: Polish**
   - Loading animations
   - Error handling
   - Goal persistence
   - Clarification prompts for vague input

4. **Phase 4: Advanced**
   - PRD parsing
   - Multi-language support
   - Learning from user refinements

---

## Success Metrics

- **Relevance:** >70% of suggested skills are kept by user
- **Speed:** <2s from click to canvas with skills
- **Coverage:** Can handle 90% of reasonable inputs gracefully
- **Fallback:** Never shows empty canvas on valid input

---

## Example Mappings

| Input | Extracted | Skills Suggested |
|-------|-----------|------------------|
| "auth" | auth | supabase-auth, nextjs-app-router |
| "e-commerce site" | e-commerce, commerce | stripe-payments, nextjs-app-router, supabase-backend |
| "AI chatbot" | AI, chatbot | llm-integration, streaming-responses, react-patterns |
| "mobile app" | mobile | react-native or flutter-mobile |
| "REST API" | REST, API | api-design, error-handling-patterns |
| "landing page" | landing | nextjs-app-router, tailwind, seo-patterns |

---

## Security Considerations

1. **Input Sanitization:** All user input is sanitized before processing
2. **No Eval:** Never execute user input as code
3. **Rate Limiting:** Prevent spam by limiting requests (future)
4. **Content Filtering:** Basic check for obviously inappropriate content (future)

