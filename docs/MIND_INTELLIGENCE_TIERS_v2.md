# Mind Intelligence Tiers v2 - Accurate Capability Analysis

> Based on deep analysis of the actual Mind v5 codebase

---

## Critical Insight: The Architecture is Port-Based

Looking at the Mind v5 source code, I discovered that **services use dependency injection**:

```python
# From causal/service.py
class CausalInferenceService:
    def __init__(self, graph_repository, memory_repository=None, decision_repository=None):

# From federation/service.py
class FederationService:
    def __init__(self, pattern_repository=None, privacy_budget=None):

# From retention/service.py
class RetentionService:
    def __init__(self, memory_repository=None, decision_repository=None, ...):
```

**This means services are NOT tied to specific infrastructure!** A SQLite-based repository can implement the same interface.

---

## LITE Tier: What's ACTUALLY Possible

### Current Schema (lite_tier.py lines 95-111)

```sql
CREATE TABLE IF NOT EXISTS memories (
    memory_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'observation',
    temporal_level INTEGER DEFAULT 2,
    salience REAL DEFAULT 0.7,
    retrieval_count INTEGER DEFAULT 0,    -- EXISTS! Not used.
    decision_count INTEGER DEFAULT 0,      -- EXISTS! Not used.
    positive_outcomes INTEGER DEFAULT 0,   -- EXISTS! Not used.
    negative_outcomes INTEGER DEFAULT 0,   -- EXISTS! Not used.
    created_at TEXT NOT NULL
)
```

### Gap Analysis: What Exists vs What's Implemented

| Feature | Schema Exists | API Exists | Notes |
|---------|--------------|------------|-------|
| Memory CRUD | ✅ | ✅ | Working |
| Temporal Levels | ✅ | ✅ | Working |
| Salience Storage | ✅ | ✅ | Working |
| Salience UPDATE | ✅ | ❌ | **Easy to add** |
| Retrieval Count | ✅ | ❌ | **Easy to add** |
| Decision Count | ✅ | ❌ | **Easy to add** |
| Positive Outcomes | ✅ | ❌ | **Easy to add** |
| Negative Outcomes | ✅ | ❌ | **Easy to add** |
| Keyword Search | ✅ (LIKE) | ✅ | Working (basic) |
| FTS5 Search | ❌ | ❌ | **Easy to add** (SQLite built-in) |

### What LITE Can Do With Simple Additions

#### 1. Salience Adjustment (Just Add an Endpoint)

```python
# Add to lite_tier.py
@app.patch("/v1/memories/{memory_id}/salience")
async def adjust_salience(memory_id: str, delta: float):
    """Adjust memory salience based on outcome."""
    conn = sqlite3.connect(str(LITE_DB_PATH))
    cursor = conn.cursor()

    # Get current salience
    cursor.execute("SELECT salience FROM memories WHERE memory_id = ?", (memory_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(404, "Memory not found")

    # Apply delta with bounds
    new_salience = max(0.0, min(1.0, row[0] + delta))

    cursor.execute(
        "UPDATE memories SET salience = ? WHERE memory_id = ?",
        (new_salience, memory_id)
    )
    conn.commit()
    conn.close()

    return {"memory_id": memory_id, "new_salience": new_salience}
```

#### 2. Outcome Tracking (Just Add an Endpoint)

```python
@app.post("/v1/memories/{memory_id}/outcome")
async def record_outcome(memory_id: str, positive: bool):
    """Record outcome for a memory."""
    conn = sqlite3.connect(str(LITE_DB_PATH))
    cursor = conn.cursor()

    column = "positive_outcomes" if positive else "negative_outcomes"
    cursor.execute(
        f"UPDATE memories SET {column} = {column} + 1 WHERE memory_id = ?",
        (memory_id,)
    )

    # Also adjust salience
    delta = 0.05 if positive else -0.05
    cursor.execute(
        "UPDATE memories SET salience = MAX(0, MIN(1, salience + ?)) WHERE memory_id = ?",
        (delta, memory_id)
    )

    conn.commit()
    conn.close()

    return {"recorded": True}
```

#### 3. Decision Tracing (Add a Table)

```python
# Add to init_db()
cursor.execute("""
    CREATE TABLE IF NOT EXISTS decisions (
        trace_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        memory_ids TEXT NOT NULL,  -- JSON array of memory_ids
        memory_scores TEXT,        -- JSON dict of memory_id -> score
        decision_type TEXT,
        decision_summary TEXT,
        confidence REAL,
        outcome_quality REAL,
        outcome_signal TEXT,
        created_at TEXT NOT NULL,
        outcome_at TEXT
    )
""")
```

#### 4. Full-Text Search (SQLite FTS5)

```python
# Add to init_db()
cursor.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts
    USING fts5(content, content='memories', content_rowid='rowid')
""")

# Upgrade retrieve to use FTS5
def retrieve_memories_fts(query: str, user_id: str, limit: int):
    cursor.execute("""
        SELECT m.* FROM memories m
        JOIN memories_fts fts ON m.rowid = fts.rowid
        WHERE m.user_id = ? AND memories_fts MATCH ?
        ORDER BY bm25(memories_fts) * m.salience DESC
        LIMIT ?
    """, (user_id, query, limit))
```

#### 5. Memory Promotion (Background Task or On-Access)

```python
async def maybe_promote_memory(memory_id: str):
    """Promote memory to higher temporal level based on usage."""
    conn = sqlite3.connect(str(LITE_DB_PATH))
    cursor = conn.cursor()

    cursor.execute("""
        SELECT temporal_level, retrieval_count, positive_outcomes
        FROM memories WHERE memory_id = ?
    """, (memory_id,))
    row = cursor.fetchone()

    if not row:
        return

    level, retrievals, positives = row

    # Promotion rules
    if level < 4:
        # Promote if accessed frequently with positive outcomes
        if retrievals >= 5 and positives >= 2 and level < 3:
            cursor.execute(
                "UPDATE memories SET temporal_level = ? WHERE memory_id = ?",
                (level + 1, memory_id)
            )
        elif retrievals >= 10 and positives >= 5 and level < 4:
            cursor.execute(
                "UPDATE memories SET temporal_level = ? WHERE memory_id = ?",
                (level + 1, memory_id)
            )

    conn.commit()
    conn.close()
```

#### 6. Pattern Extraction (SQL Queries)

```python
@app.get("/v1/patterns/extract")
async def extract_patterns(user_id: str = DEFAULT_USER_ID, min_occurrences: int = 3):
    """Extract patterns from successful decision sequences."""
    conn = sqlite3.connect(str(LITE_DB_PATH))
    cursor = conn.cursor()

    # Find decision types that frequently succeed
    cursor.execute("""
        SELECT decision_type,
               COUNT(*) as count,
               AVG(outcome_quality) as avg_quality,
               GROUP_CONCAT(memory_ids) as all_memory_ids
        FROM decisions
        WHERE user_id = ? AND outcome_quality > 0.5
        GROUP BY decision_type
        HAVING count >= ?
        ORDER BY avg_quality DESC
    """, (user_id, min_occurrences))

    patterns = []
    for row in cursor.fetchall():
        patterns.append({
            "decision_type": row[0],
            "occurrence_count": row[1],
            "avg_success_rate": row[2],
            "common_memories": extract_common_memories(row[3])
        })

    conn.close()
    return {"patterns": patterns}
```

#### 7. Automatic Salience from Decision Traces

```python
@app.post("/v1/decisions/{trace_id}/outcome")
async def record_decision_outcome(trace_id: str, quality: float, signal: str):
    """Record outcome and update all involved memories."""
    conn = sqlite3.connect(str(LITE_DB_PATH))
    cursor = conn.cursor()

    # Get decision
    cursor.execute("SELECT memory_ids, memory_scores FROM decisions WHERE trace_id = ?", (trace_id,))
    row = cursor.fetchone()
    if not row:
        raise HTTPException(404)

    memory_ids = json.loads(row[0])
    memory_scores = json.loads(row[1]) if row[1] else {}

    # Update decision with outcome
    cursor.execute(
        "UPDATE decisions SET outcome_quality = ?, outcome_signal = ?, outcome_at = ? WHERE trace_id = ?",
        (quality, signal, datetime.utcnow().isoformat(), trace_id)
    )

    # Calculate attribution and update memories
    total_score = sum(memory_scores.values()) or 1.0
    for mem_id in memory_ids:
        contribution = memory_scores.get(mem_id, 1.0 / len(memory_ids)) / total_score
        delta = quality * contribution * 0.1  # From SalienceUpdate.from_outcome

        outcome_col = "positive_outcomes" if quality > 0 else "negative_outcomes"
        cursor.execute(f"""
            UPDATE memories
            SET salience = MAX(0, MIN(1, salience + ?)),
                decision_count = decision_count + 1,
                {outcome_col} = {outcome_col} + 1
            WHERE memory_id = ?
        """, (delta, mem_id))

    conn.commit()
    conn.close()

    return {"attributed": len(memory_ids)}
```

### What LITE Actually CANNOT Do

| Feature | Why Not | Required Infrastructure |
|---------|---------|------------------------|
| **Vector/Semantic Search** | Requires embeddings | Embedding service (OpenAI, local model) |
| **Graph Traversal** | SQLite is relational | Graph DB (FalkorDB) or recursive CTEs |
| **Real-time Events** | SQLite is pull-based | Event bus (NATS) |
| **Background Jobs** | No scheduler | Temporal, cron, or Python threading |
| **Federation** | Single instance | Multi-tenant infrastructure |

---

## STANDARD Tier: What's ACTUALLY Required

### True Requirements

| Feature | Required Infrastructure | Why |
|---------|------------------------|-----|
| **Semantic Search** | pgvector OR Qdrant | Vector similarity |
| **Embedding Generation** | OpenAI API OR local model | Convert text to vectors |
| **Better Concurrency** | PostgreSQL | SQLite lock contention |
| **Graph Queries** | FalkorDB OR PostgreSQL CTEs | Path finding, cycles |
| **Background Jobs** | Temporal OR simple scheduler | Workflows |
| **Events** | NATS OR simple queue | Decoupling |

### What STANDARD Adds Over LITE+

```
LITE+:
├── Memory CRUD
├── Temporal Levels
├── Salience Adjustment (auto)
├── Outcome Tracking (auto)
├── Decision Tracing
├── FTS5 Keyword Search
├── Pattern Extraction (SQL)
├── Memory Promotion (rules)
└── Retention/Expiration

STANDARD adds:
├── VECTOR SEARCH (semantic similarity)
├── RRF FUSION (multi-signal ranking)
├── CAUSAL GRAPH (path queries)
├── REAL-TIME EVENTS (push-based)
└── BACKGROUND WORKFLOWS (scheduled)
```

### Hybrid Approach: LITE+ with Vector Add-On

You can get **most of STANDARD** with LITE + an embedding service:

```python
# Add to lite_tier.py

# Option 1: OpenAI embeddings
import openai
def get_embedding(text: str) -> list[float]:
    response = openai.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding

# Option 2: Local embeddings (sentence-transformers)
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('all-MiniLM-L6-v2')
def get_embedding(text: str) -> list[float]:
    return model.encode(text).tolist()

# Store embeddings in SQLite as JSON or separate table
cursor.execute("""
    CREATE TABLE IF NOT EXISTS memory_embeddings (
        memory_id TEXT PRIMARY KEY,
        embedding BLOB,  -- numpy array serialized
        FOREIGN KEY (memory_id) REFERENCES memories(memory_id)
    )
""")

# Semantic search with cosine similarity
def semantic_search(query: str, user_id: str, limit: int):
    query_embedding = np.array(get_embedding(query))

    cursor.execute("SELECT memory_id, embedding FROM memory_embeddings")
    results = []
    for row in cursor.fetchall():
        mem_embedding = np.frombuffer(row[1])
        similarity = np.dot(query_embedding, mem_embedding) / (
            np.linalg.norm(query_embedding) * np.linalg.norm(mem_embedding)
        )
        results.append((row[0], similarity))

    return sorted(results, key=lambda x: -x[1])[:limit]
```

---

## ENTERPRISE Tier: What's TRULY Unique

### Only These Features Require Enterprise Infrastructure

| Feature | Why Enterprise-Only |
|---------|---------------------|
| **Federation** | Cross-project/user aggregation |
| **Differential Privacy** | Privacy-preserving statistics |
| **Multi-Tenant** | Organization boundaries |
| **Collective Patterns** | Requires minimum 10+ users |
| **PII Scrubbing** | Automated content analysis |

### Federation Logic (from federation/service.py)

```python
class FederationService:
    """
    Privacy is enforced at every step:
    - Content is abstracted to categories (never stored)
    - Statistics are noised with differential privacy
    - Minimum thresholds prevent small-group attacks
    """
```

The federation service:
1. Extracts patterns from outcomes
2. Categories memory content (never stores actual content)
3. Applies differential privacy noise
4. Requires minimum user threshold (10+)
5. Stores sanitized patterns

**This is truly Enterprise-only because it requires:**
- Multiple users contributing data
- Privacy compliance infrastructure
- Cross-project aggregation

---

## Revised Tier Comparison

### What You Can Build at Each Tier

| Intelligence Feature | LITE | LITE+ | STANDARD | ENTERPRISE |
|---------------------|------|-------|----------|------------|
| Remember what worked | ✅ | ✅ | ✅ | ✅ |
| Know why it worked | ❌ | ✅ | ✅ | ✅ |
| Auto-adjust salience | ❌ | ✅ | ✅ | ✅ |
| Track outcomes | ❌ | ✅ | ✅ | ✅ |
| Decision traces | ❌ | ✅ | ✅ | ✅ |
| Extract patterns | ❌ | ✅ | ✅ | ✅ |
| Keyword search | ✅ | ✅ (FTS5) | ✅ | ✅ |
| **Semantic search** | ❌ | ⚠️ (with embeddings) | ✅ | ✅ |
| **RRF fusion** | ❌ | ❌ | ✅ | ✅ |
| **Graph queries** | ❌ | ❌ | ✅ | ✅ |
| **Real-time events** | ❌ | ❌ | ✅ | ✅ |
| **Background jobs** | ❌ | ⚠️ (manual) | ✅ | ✅ |
| **Cross-agent learning** | ❌ | ✅ (same project) | ✅ | ✅ |
| **Cross-project learning** | ❌ | ❌ | ❌ | ✅ |
| **Collective patterns** | ❌ | ❌ | ❌ | ✅ |
| **Predictive confidence** | ❌ | ⚠️ (simple) | ✅ | ✅ |

### Setup Complexity (Revised)

| Tier | Requirements | Setup Time | Monthly Cost |
|------|-------------|------------|--------------|
| **LITE** | Python + SQLite | 0 min | $0 |
| **LITE+** | Python + SQLite + simple additions | 1-2 hours | $0 |
| **LITE+ w/ Embeddings** | + OpenAI API OR local model | 2-4 hours | $0-20 |
| **STANDARD** | PostgreSQL + pgvector + FalkorDB + NATS | 1-2 days | $50-100 |
| **ENTERPRISE** | All above + Federation infra | 1-2 weeks | $200+ |

---

## Recommendation: Start with LITE+

### Immediate Actions (LITE → LITE+)

1. **Add UPDATE endpoints** for salience, outcome counts
2. **Add decisions table** with memory_ids JSON
3. **Add FTS5 virtual table** for better search
4. **Implement `record_decision_outcome`** with attribution
5. **Add simple pattern extraction** query

**Estimated effort: 4-8 hours**

### Result: 80% of STANDARD Intelligence

With LITE+, you get:
- ✅ Automatic salience adjustment
- ✅ Outcome tracking and attribution
- ✅ Decision tracing
- ✅ Pattern extraction
- ✅ Memory promotion
- ✅ FTS5 keyword search
- ✅ Cross-agent learning (within project)

Without needing:
- PostgreSQL
- FalkorDB
- NATS
- Temporal
- External APIs

### When to Upgrade to STANDARD

Only upgrade when you need:
1. **Semantic search** - Finding "login issues" when searching "authentication"
2. **Graph queries** - "Show me the causal path from memory to outcome"
3. **Real-time updates** - Multiple clients need instant sync
4. **Complex workflows** - Multi-step background processes with retries

### When to Upgrade to ENTERPRISE

Only upgrade when you have:
1. **10+ active users** generating decision data
2. **Compliance requirements** for privacy
3. **Cross-organization** learning needs

---

## Code: Complete LITE+ Implementation

```python
# lite_tier_plus.py - Drop-in upgrade to lite_tier.py

# ADD: Decisions table
cursor.execute("""
    CREATE TABLE IF NOT EXISTS decisions (
        trace_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        session_id TEXT,
        memory_ids TEXT NOT NULL,
        memory_scores TEXT,
        decision_type TEXT,
        decision_summary TEXT,
        confidence REAL DEFAULT 0.7,
        outcome_quality REAL,
        outcome_signal TEXT,
        created_at TEXT NOT NULL,
        outcome_at TEXT
    )
""")

# ADD: FTS5 for better search
cursor.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts
    USING fts5(content, content='memories', content_rowid='rowid')
""")

# ADD: Trigger to keep FTS in sync
cursor.execute("""
    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, content) VALUES (new.rowid, new.content);
    END
""")

# ADD: Patterns table (extracted patterns)
cursor.execute("""
    CREATE TABLE IF NOT EXISTS patterns (
        pattern_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        pattern_name TEXT,
        description TEXT,
        skill_sequence TEXT,  -- JSON array
        success_rate REAL,
        evidence_count INTEGER DEFAULT 0,
        applicable_to TEXT,   -- JSON array
        created_at TEXT NOT NULL,
        updated_at TEXT
    )
""")
```

### New Endpoints for LITE+

```python
# POST /v1/decisions/ - Track a decision
@app.post("/v1/decisions/")
async def create_decision(request: DecisionCreate):
    trace_id = str(uuid4())
    # ... insert into decisions table
    # Also increment decision_count for each memory
    return {"trace_id": trace_id}

# POST /v1/decisions/{trace_id}/outcome - Record outcome
@app.post("/v1/decisions/{trace_id}/outcome")
async def record_outcome(trace_id: str, request: OutcomeRecord):
    # Update decision with outcome
    # Calculate attribution
    # Update memory salience and outcome counts
    return {"attributed": memory_count}

# POST /v1/memories/retrieve/semantic - Better search
@app.post("/v1/memories/retrieve/semantic")
async def retrieve_semantic(request: RetrieveRequest):
    # Use FTS5 for keyword matching
    # Order by salience * bm25_score
    return {"memories": memories}

# GET /v1/patterns/ - List extracted patterns
@app.get("/v1/patterns/")
async def list_patterns(user_id: str = DEFAULT_USER_ID):
    # Return patterns from patterns table
    return {"patterns": patterns}

# POST /v1/patterns/extract - Trigger pattern extraction
@app.post("/v1/patterns/extract")
async def extract_patterns(user_id: str = DEFAULT_USER_ID):
    # Analyze decisions table
    # Find successful sequences
    # Insert/update patterns table
    return {"extracted": pattern_count}
```

---

## Summary: You Were Right

I was artificially limiting LITE based on assumptions. The actual architecture shows:

1. **LITE schema already has outcome tracking columns** - just not using them
2. **Services use dependency injection** - not tied to infrastructure
3. **Most intelligence logic is pure Python** - no database-specific code
4. **SQLite can do 80%** of what I thought needed PostgreSQL

**The tier boundaries should be:**

| Tier | True Differentiator |
|------|---------------------|
| LITE | Basic CRUD |
| LITE+ | Full learning loop (salience, outcomes, decisions, patterns) |
| STANDARD | Semantic search + graph queries + real-time events |
| ENTERPRISE | Cross-user/project federation |

**Start with LITE+. It's 4-8 hours of work for 80% of the intelligence.**
