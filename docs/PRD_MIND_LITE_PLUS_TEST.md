# PRD: Mind Intelligence Test Suite

## Project Overview

**Project Name:** MindFlow - AI Learning Feedback System
**Goal:** Build a real application that exercises ALL Mind v5 LITE+ features, demonstrating the full intelligence loop in action.

This project serves as both a useful application AND a comprehensive test of Mind's learning capabilities.

---

## What We're Testing

### LITE+ Features to Validate

| Feature | How We'll Test It | Success Criteria |
|---------|------------------|------------------|
| **Memory Creation** | Store learnings from each task | Memories appear in Mind dashboard |
| **Salience Adjustment** | Boost useful memories, decay useless ones | Salience values change over time |
| **Outcome Tracking** | Record success/failure of decisions | positive_outcomes/negative_outcomes increment |
| **Decision Tracing** | Link memories to decisions made | Decisions table populated with memory_ids |
| **Outcome Attribution** | Quality feedback propagates to memories | `delta = quality * contribution * 0.1` applied |
| **FTS5 Search** | Find relevant memories by keyword | Semantic search returns ranked results |
| **Pattern Extraction** | Identify successful decision sequences | Patterns emerge from repeated successes |

---

## The Application: MindFlow

### Concept

MindFlow is a **developer feedback collection system** that:
1. Collects feedback on code/features from users
2. Learns which patterns lead to positive feedback
3. Suggests improvements based on learned patterns
4. Tracks its own prediction accuracy

### Why This Tests Mind Well

- **Natural decision points**: Each suggestion is a decision
- **Clear outcomes**: User feedback (thumbs up/down) provides quality signal
- **Pattern emergence**: Similar feedback patterns should be detected
- **Salience drift**: Good suggestions get boosted, bad ones decay

---

## Technical Specification

### Tech Stack

- **Frontend**: SvelteKit + Tailwind CSS
- **Backend**: SvelteKit API routes
- **Database**: SQLite (for app data) + Mind LITE+ (for intelligence)
- **Mind Integration**: Direct HTTP calls to localhost:8080

### Project Structure

```
mindflow/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── FeedbackCard.svelte      # Display feedback items
│   │   │   ├── SuggestionPanel.svelte   # Show Mind suggestions
│   │   │   ├── OutcomeButtons.svelte    # Thumbs up/down
│   │   │   ├── MemoryViewer.svelte      # View Mind memories
│   │   │   ├── DecisionLog.svelte       # Show decision traces
│   │   │   └── PatternDisplay.svelte    # Show extracted patterns
│   │   ├── services/
│   │   │   ├── mind-client.ts           # Mind API wrapper
│   │   │   ├── feedback-store.ts        # Local feedback storage
│   │   │   └── suggestion-engine.ts     # Generate suggestions from Mind
│   │   └── types/
│   │       └── index.ts                 # TypeScript types
│   ├── routes/
│   │   ├── +page.svelte                 # Main dashboard
│   │   ├── +layout.svelte               # App layout
│   │   ├── feedback/
│   │   │   ├── +page.svelte             # Submit feedback
│   │   │   └── [id]/+page.svelte        # View single feedback
│   │   ├── suggestions/
│   │   │   └── +page.svelte             # View/rate suggestions
│   │   ├── mind/
│   │   │   ├── +page.svelte             # Mind dashboard
│   │   │   ├── memories/+page.svelte    # Browse memories
│   │   │   ├── decisions/+page.svelte   # View decisions
│   │   │   └── patterns/+page.svelte    # View patterns
│   │   └── api/
│   │       ├── feedback/+server.ts      # Feedback CRUD
│   │       ├── suggestions/+server.ts   # Get suggestions
│   │       └── outcome/+server.ts       # Record outcomes
│   └── app.html
├── static/
├── package.json
├── svelte.config.js
├── tailwind.config.js
└── tsconfig.json
```

---

## Features & Tasks

### Task 1: Project Setup

**What to build:**
- Initialize SvelteKit project with TypeScript
- Configure Tailwind CSS
- Create basic layout with navigation

**Mind Integration:**
- Create a memory: "Project MindFlow initialized with SvelteKit + Tailwind"
- Content type: `project_setup`
- Temporal level: 3 (seasonal - project-level)

---

### Task 2: Mind Client Service

**What to build:**
Create `src/lib/services/mind-client.ts`:

```typescript
// Mind LITE+ API Client
const MIND_API = 'http://localhost:8080';
const DEFAULT_USER = '550e8400-e29b-41d4-a716-446655440000';

export interface Memory {
  memory_id: string;
  content: string;
  content_type: string;
  temporal_level: number;
  effective_salience: number;
  retrieval_count: number;
  decision_count: number;
  positive_outcomes: number;
  negative_outcomes: number;
}

export interface Decision {
  trace_id: string;
  memory_ids: string[];
  memory_scores?: Record<string, number>;
  decision_type: string;
  decision_summary: string;
  confidence: number;
  outcome_quality?: number;
}

export const mindClient = {
  // Create a memory
  async createMemory(content: string, type: string, salience = 0.7) {
    const res = await fetch(`${MIND_API}/v1/memories/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        content_type: type,
        temporal_level: 2,
        salience
      })
    });
    return res.json();
  },

  // Search memories using FTS5
  async searchMemories(query: string, limit = 10) {
    const res = await fetch(`${MIND_API}/v1/memories/retrieve/semantic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit })
    });
    return res.json();
  },

  // Create a decision trace
  async createDecision(memoryIds: string[], type: string, summary: string, scores?: Record<string, number>) {
    const res = await fetch(`${MIND_API}/v1/decisions/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memory_ids: memoryIds,
        memory_scores: scores,
        decision_type: type,
        decision_summary: summary,
        confidence: 0.8
      })
    });
    return res.json();
  },

  // Record outcome for a decision
  async recordOutcome(traceId: string, quality: number, signal: string) {
    const res = await fetch(`${MIND_API}/v1/decisions/${traceId}/outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quality, signal })
    });
    return res.json();
  },

  // Adjust salience directly
  async adjustSalience(memoryId: string, delta: number) {
    const res = await fetch(`${MIND_API}/v1/memories/${memoryId}/salience`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta })
    });
    return res.json();
  },

  // Record outcome for a memory
  async recordMemoryOutcome(memoryId: string, positive: boolean) {
    const res = await fetch(`${MIND_API}/v1/memories/${memoryId}/outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positive, delta: 0.05 })
    });
    return res.json();
  },

  // Extract patterns
  async extractPatterns(minOccurrences = 2) {
    const res = await fetch(`${MIND_API}/v1/patterns/extract?min_occurrences=${minOccurrences}`, {
      method: 'POST'
    });
    return res.json();
  },

  // Get all patterns
  async getPatterns() {
    const res = await fetch(`${MIND_API}/v1/patterns/`);
    return res.json();
  },

  // Get all decisions
  async getDecisions(limit = 50) {
    const res = await fetch(`${MIND_API}/v1/decisions/?limit=${limit}`);
    return res.json();
  },

  // Get stats
  async getStats() {
    const res = await fetch(`${MIND_API}/v1/stats`);
    return res.json();
  }
};
```

**Mind Integration:**
- Create memory: "Mind client service created with full LITE+ API coverage"
- Test the client by calling `getStats()`

---

### Task 3: Feedback Collection UI

**What to build:**
Create feedback submission page at `/feedback`:

```svelte
<!-- src/routes/feedback/+page.svelte -->
<script lang="ts">
  import { mindClient } from '$lib/services/mind-client';

  let category = 'bug';
  let title = '';
  let description = '';
  let submitted = false;

  async function submitFeedback() {
    // Store feedback in Mind as a memory
    const memory = await mindClient.createMemory(
      `[Feedback: ${category}] ${title}\n\n${description}`,
      'user_feedback',
      0.7
    );

    submitted = true;

    // Reset form
    title = '';
    description = '';
  }
</script>

<div class="max-w-2xl mx-auto p-6">
  <h1 class="text-2xl font-bold mb-6">Submit Feedback</h1>

  <form on:submit|preventDefault={submitFeedback} class="space-y-4">
    <div>
      <label class="block text-sm font-medium mb-1">Category</label>
      <select bind:value={category} class="w-full border p-2">
        <option value="bug">Bug Report</option>
        <option value="feature">Feature Request</option>
        <option value="improvement">Improvement</option>
        <option value="praise">Praise</option>
      </select>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Title</label>
      <input bind:value={title} class="w-full border p-2" required />
    </div>

    <div>
      <label class="block text-sm font-medium mb-1">Description</label>
      <textarea bind:value={description} rows="4" class="w-full border p-2" required />
    </div>

    <button type="submit" class="bg-blue-600 text-white px-4 py-2">
      Submit Feedback
    </button>
  </form>

  {#if submitted}
    <div class="mt-4 p-4 bg-green-100 text-green-800">
      Feedback submitted and stored in Mind!
    </div>
  {/if}
</div>
```

**Mind Integration:**
- Each feedback creates a memory
- Memory type: `user_feedback`
- This builds up the memory corpus for later testing

---

### Task 4: Suggestion Engine

**What to build:**
Create `src/lib/services/suggestion-engine.ts`:

```typescript
import { mindClient } from './mind-client';

export interface Suggestion {
  id: string;
  content: string;
  sourceMemories: string[];
  memoryScores: Record<string, number>;
  confidence: number;
  decisionId?: string;
}

export async function generateSuggestions(context: string): Promise<Suggestion[]> {
  // Search Mind for relevant memories
  const result = await mindClient.searchMemories(context, 5);

  if (!result.memories || result.memories.length === 0) {
    return [];
  }

  // Generate suggestions based on high-salience memories
  const suggestions: Suggestion[] = [];

  // Group similar memories and create suggestions
  const highSalience = result.memories.filter(m => m.effective_salience > 0.6);

  for (const memory of highSalience) {
    // Create a decision trace for this suggestion
    const decision = await mindClient.createDecision(
      [memory.memory_id],
      'suggestion',
      `Suggested based on: ${memory.content.substring(0, 100)}...`,
      { [memory.memory_id]: result.scores[memory.memory_id] || 1.0 }
    );

    suggestions.push({
      id: decision.trace_id,
      content: extractSuggestion(memory.content),
      sourceMemories: [memory.memory_id],
      memoryScores: { [memory.memory_id]: result.scores[memory.memory_id] || 1.0 },
      confidence: memory.effective_salience,
      decisionId: decision.trace_id
    });
  }

  return suggestions;
}

function extractSuggestion(memoryContent: string): string {
  // Extract actionable suggestion from memory content
  // This is where you'd have more sophisticated logic
  if (memoryContent.includes('[Feedback:')) {
    const match = memoryContent.match(/\[Feedback: \w+\] (.+)/);
    return match ? `Consider addressing: ${match[1]}` : memoryContent.substring(0, 200);
  }
  return memoryContent.substring(0, 200);
}

export async function rateSuggestion(decisionId: string, helpful: boolean) {
  // Record outcome - this is the KEY learning signal!
  const quality = helpful ? 0.8 : -0.5;
  const signal = helpful ? 'user_helpful' : 'user_not_helpful';

  const result = await mindClient.recordOutcome(decisionId, quality, signal);

  // After several ratings, extract patterns
  await mindClient.extractPatterns(2);

  return result;
}
```

**Mind Integration:**
- Each suggestion creates a **decision trace**
- User ratings become **outcomes**
- Outcomes **attribute back** to source memories
- This tests the full `delta = quality * contribution * 0.1` formula

---

### Task 5: Suggestions Page with Rating

**What to build:**
Create `/suggestions` page:

```svelte
<!-- src/routes/suggestions/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { generateSuggestions, rateSuggestion, type Suggestion } from '$lib/services/suggestion-engine';

  let context = '';
  let suggestions: Suggestion[] = [];
  let loading = false;
  let ratingResults: Record<string, any> = {};

  async function getSuggestions() {
    loading = true;
    suggestions = await generateSuggestions(context);
    loading = false;
  }

  async function rate(suggestion: Suggestion, helpful: boolean) {
    if (!suggestion.decisionId) return;

    const result = await rateSuggestion(suggestion.decisionId, helpful);
    ratingResults[suggestion.id] = {
      helpful,
      attributed: result.attributed_memories
    };
  }
</script>

<div class="max-w-4xl mx-auto p-6">
  <h1 class="text-2xl font-bold mb-6">AI Suggestions</h1>

  <div class="mb-6">
    <label class="block text-sm font-medium mb-1">What are you working on?</label>
    <input
      bind:value={context}
      class="w-full border p-2"
      placeholder="e.g., improving login flow, fixing bugs..."
    />
    <button
      on:click={getSuggestions}
      disabled={loading}
      class="mt-2 bg-blue-600 text-white px-4 py-2"
    >
      {loading ? 'Loading...' : 'Get Suggestions'}
    </button>
  </div>

  <div class="space-y-4">
    {#each suggestions as suggestion}
      <div class="border p-4 rounded">
        <p class="mb-2">{suggestion.content}</p>

        <div class="flex items-center gap-4 text-sm text-gray-600">
          <span>Confidence: {(suggestion.confidence * 100).toFixed(0)}%</span>
          <span>Sources: {suggestion.sourceMemories.length} memories</span>
        </div>

        {#if ratingResults[suggestion.id]}
          <div class="mt-2 p-2 bg-gray-100 text-sm">
            Rated: {ratingResults[suggestion.id].helpful ? 'Helpful' : 'Not helpful'}
            - Updated {ratingResults[suggestion.id].attributed} memories
          </div>
        {:else}
          <div class="mt-2 flex gap-2">
            <button
              on:click={() => rate(suggestion, true)}
              class="bg-green-500 text-white px-3 py-1 text-sm"
            >
              Helpful
            </button>
            <button
              on:click={() => rate(suggestion, false)}
              class="bg-red-500 text-white px-3 py-1 text-sm"
            >
              Not Helpful
            </button>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
```

**Mind Integration:**
- This is the **core test of the learning loop**
- Each rating records an outcome
- Outcomes propagate to source memories
- Salience adjusts based on `quality * contribution * 0.1`

---

### Task 6: Mind Dashboard

**What to build:**
Create `/mind` page to visualize Mind's state:

```svelte
<!-- src/routes/mind/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { mindClient } from '$lib/services/mind-client';

  let stats = null;
  let memories = [];
  let decisions = [];
  let patterns = { patterns: [] };

  onMount(async () => {
    stats = await mindClient.getStats();

    const memResult = await mindClient.searchMemories('', 20);
    memories = memResult.memories || [];

    decisions = await mindClient.getDecisions(20);
    patterns = await mindClient.getPatterns();
  });
</script>

<div class="max-w-6xl mx-auto p-6">
  <h1 class="text-2xl font-bold mb-6">Mind Intelligence Dashboard</h1>

  <!-- Stats -->
  {#if stats}
    <div class="grid grid-cols-4 gap-4 mb-8">
      <div class="bg-blue-100 p-4 rounded">
        <div class="text-3xl font-bold">{stats.total_memories}</div>
        <div class="text-sm text-gray-600">Total Memories</div>
      </div>
      <div class="bg-green-100 p-4 rounded">
        <div class="text-3xl font-bold">{decisions.length}</div>
        <div class="text-sm text-gray-600">Decisions Traced</div>
      </div>
      <div class="bg-purple-100 p-4 rounded">
        <div class="text-3xl font-bold">{patterns.patterns?.length || 0}</div>
        <div class="text-sm text-gray-600">Patterns Found</div>
      </div>
      <div class="bg-yellow-100 p-4 rounded">
        <div class="text-3xl font-bold">{stats.tier}</div>
        <div class="text-sm text-gray-600">Mind Tier</div>
      </div>
    </div>
  {/if}

  <!-- Memories with Salience -->
  <section class="mb-8">
    <h2 class="text-xl font-bold mb-4">Memories (by Salience)</h2>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-100">
          <tr>
            <th class="p-2 text-left">Content</th>
            <th class="p-2">Salience</th>
            <th class="p-2">Decisions</th>
            <th class="p-2">+/-</th>
          </tr>
        </thead>
        <tbody>
          {#each memories.sort((a, b) => b.effective_salience - a.effective_salience) as memory}
            <tr class="border-b">
              <td class="p-2">{memory.content.substring(0, 80)}...</td>
              <td class="p-2 text-center">
                <span class="inline-block w-16 bg-gray-200 rounded">
                  <span
                    class="block bg-blue-500 rounded h-4"
                    style="width: {memory.effective_salience * 100}%"
                  ></span>
                </span>
                <span class="text-xs ml-1">{(memory.effective_salience * 100).toFixed(0)}%</span>
              </td>
              <td class="p-2 text-center">{memory.decision_count}</td>
              <td class="p-2 text-center">
                <span class="text-green-600">+{memory.positive_outcomes}</span>
                /
                <span class="text-red-600">-{memory.negative_outcomes}</span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>

  <!-- Patterns -->
  <section class="mb-8">
    <h2 class="text-xl font-bold mb-4">Extracted Patterns</h2>
    {#if patterns.patterns?.length > 0}
      <div class="space-y-2">
        {#each patterns.patterns as pattern}
          <div class="border p-4 rounded">
            <div class="font-medium">{pattern.pattern_name}</div>
            <div class="text-sm text-gray-600">{pattern.description}</div>
            <div class="text-xs mt-2">
              Success rate: {(pattern.success_rate * 100).toFixed(0)}%
              | Evidence: {pattern.evidence_count} decisions
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-gray-500">No patterns extracted yet. Rate more suggestions!</p>
    {/if}
  </section>

  <!-- Recent Decisions -->
  <section>
    <h2 class="text-xl font-bold mb-4">Recent Decisions</h2>
    <div class="space-y-2">
      {#each decisions.slice(0, 10) as decision}
        <div class="border p-3 rounded text-sm">
          <div class="flex justify-between">
            <span class="font-medium">{decision.decision_type}</span>
            <span class="text-gray-500">{decision.created_at}</span>
          </div>
          <div class="text-gray-600">{decision.decision_summary}</div>
          {#if decision.outcome_quality !== null}
            <div class="mt-1">
              Outcome:
              <span class={decision.outcome_quality > 0 ? 'text-green-600' : 'text-red-600'}>
                {decision.outcome_quality > 0 ? 'Positive' : 'Negative'}
                ({decision.outcome_quality.toFixed(2)})
              </span>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </section>
</div>
```

---

### Task 7: Test Scenarios

**What to build:**
Create automated test scenarios at `/mind/test`:

```svelte
<!-- src/routes/mind/test/+page.svelte -->
<script lang="ts">
  import { mindClient } from '$lib/services/mind-client';

  let results: string[] = [];
  let running = false;

  async function log(msg: string) {
    results = [...results, `[${new Date().toLocaleTimeString()}] ${msg}`];
  }

  async function runTests() {
    running = true;
    results = [];

    // Test 1: Memory Creation
    log('TEST 1: Creating test memories...');
    const mem1 = await mindClient.createMemory(
      'Test memory: Authentication flow needs improvement',
      'test_feedback',
      0.6
    );
    log(`Created memory: ${mem1.memory_id} (salience: ${mem1.effective_salience})`);

    const mem2 = await mindClient.createMemory(
      'Test memory: Login page loads slowly',
      'test_feedback',
      0.5
    );
    log(`Created memory: ${mem2.memory_id} (salience: ${mem2.effective_salience})`);

    // Test 2: FTS5 Search
    log('TEST 2: Testing FTS5 semantic search...');
    const search = await mindClient.searchMemories('authentication login', 5);
    log(`Search returned ${search.memories?.length || 0} results`);
    if (search.scores) {
      log(`Scores: ${JSON.stringify(search.scores)}`);
    }

    // Test 3: Decision Tracing
    log('TEST 3: Creating decision trace...');
    const decision = await mindClient.createDecision(
      [mem1.memory_id, mem2.memory_id],
      'test_decision',
      'Testing decision trace with two memories',
      { [mem1.memory_id]: 0.8, [mem2.memory_id]: 0.6 }
    );
    log(`Created decision: ${decision.trace_id}`);

    // Test 4: Outcome Attribution
    log('TEST 4: Recording positive outcome...');
    const outcome = await mindClient.recordOutcome(
      decision.trace_id,
      0.9, // Very positive
      'test_success'
    );
    log(`Outcome recorded, attributed to ${outcome.attributed_memories} memories`);

    // Test 5: Verify Salience Changed
    log('TEST 5: Verifying salience adjustment...');
    const updatedSearch = await mindClient.searchMemories('authentication', 5);
    const updatedMem = updatedSearch.memories?.find(m => m.memory_id === mem1.memory_id);
    if (updatedMem) {
      log(`Memory ${mem1.memory_id.substring(0, 8)}...`);
      log(`  Original salience: 0.60`);
      log(`  New salience: ${updatedMem.effective_salience.toFixed(2)}`);
      log(`  Expected delta: 0.9 * 0.57 * 0.1 = ~0.05`);
      log(`  Positive outcomes: ${updatedMem.positive_outcomes}`);
    }

    // Test 6: Pattern Extraction
    log('TEST 6: Creating more decisions for pattern extraction...');
    for (let i = 0; i < 3; i++) {
      const d = await mindClient.createDecision(
        [mem1.memory_id],
        'repeated_decision',
        `Repeated decision ${i + 1}`,
        { [mem1.memory_id]: 1.0 }
      );
      await mindClient.recordOutcome(d.trace_id, 0.7, 'test_success');
    }

    log('Extracting patterns...');
    const extracted = await mindClient.extractPatterns(2);
    log(`Extracted ${extracted.extracted} patterns`);

    // Test 7: Get Patterns
    log('TEST 7: Retrieving patterns...');
    const patterns = await mindClient.getPatterns();
    log(`Found ${patterns.patterns?.length || 0} patterns`);
    patterns.patterns?.forEach(p => {
      log(`  - ${p.pattern_name}: ${(p.success_rate * 100).toFixed(0)}% success (${p.evidence_count} evidence)`);
    });

    // Test 8: Direct Salience Adjustment
    log('TEST 8: Testing direct salience adjustment...');
    const beforeAdj = await mindClient.searchMemories('', 1);
    if (beforeAdj.memories?.[0]) {
      const testMem = beforeAdj.memories[0];
      log(`Before: ${testMem.effective_salience.toFixed(2)}`);
      await mindClient.adjustSalience(testMem.memory_id, 0.1);
      const afterSearch = await mindClient.searchMemories('', 1);
      const afterMem = afterSearch.memories?.find(m => m.memory_id === testMem.memory_id);
      log(`After +0.1: ${afterMem?.effective_salience.toFixed(2) || 'N/A'}`);
    }

    log('');
    log('=== ALL TESTS COMPLETE ===');
    log('Check the Mind Dashboard to see the changes!');

    running = false;
  }
</script>

<div class="max-w-4xl mx-auto p-6">
  <h1 class="text-2xl font-bold mb-6">Mind LITE+ Test Suite</h1>

  <button
    on:click={runTests}
    disabled={running}
    class="bg-blue-600 text-white px-6 py-3 mb-6"
  >
    {running ? 'Running Tests...' : 'Run All Tests'}
  </button>

  <div class="bg-gray-900 text-green-400 p-4 font-mono text-sm h-[600px] overflow-y-auto">
    {#each results as line}
      <div>{line}</div>
    {/each}
    {#if running}
      <div class="animate-pulse">Running...</div>
    {/if}
  </div>
</div>
```

---

## Expected Test Results

After running the full test suite, you should observe:

### 1. Memory Salience Changes
- Memories used in successful decisions: salience increases
- Memories used in failed decisions: salience decreases
- Formula verification: `delta = quality * contribution * 0.1`

### 2. Decision Traces
- Each suggestion creates a decision
- Decisions link to source memories with scores
- Outcomes are recorded with quality and signal

### 3. Pattern Emergence
- After 3+ similar successful decisions, patterns appear
- Patterns show success rate and evidence count
- Patterns identify common memory sequences

### 4. FTS5 Search Quality
- Keyword search returns relevant results
- Results ranked by BM25 score * salience
- High-salience memories surface first

---

## Success Metrics

| Metric | Target | How to Verify |
|--------|--------|---------------|
| Memories created | 10+ | Check Mind dashboard |
| Decisions traced | 5+ | Check `/mind/decisions` |
| Outcomes recorded | 5+ | Check decision outcome_quality |
| Salience changes | Visible | Compare before/after values |
| Patterns extracted | 1+ | Check `/mind/patterns` |
| Search works | Returns results | Test with various queries |

---

## How to Run

1. **Start Mind LITE+**:
   ```bash
   cd C:\Users\USER\Desktop\the-mind\vibeship-mind
   python src/mind/lite_tier.py
   ```

2. **Build and run MindFlow**:
   ```bash
   cd mindflow
   npm install
   npm run dev
   ```

3. **Test sequence**:
   - Go to `/feedback` and submit 5-10 feedback items
   - Go to `/suggestions` and generate suggestions
   - Rate suggestions as helpful/not helpful
   - Go to `/mind` to see intelligence in action
   - Go to `/mind/test` to run automated tests

4. **Verify LITE+ features**:
   - Check salience values change after ratings
   - Check decisions are traced with memory links
   - Check patterns emerge after repeated successes
   - Check FTS5 search returns ranked results

---

## Notes for Spawner UI

When loading this PRD into Spawner UI:
- The mission will create all files in the structure above
- Mind integration happens automatically via HTTP calls
- Each task should create memories about its own completion
- This creates a "meta-learning" scenario where Mind learns about itself!
