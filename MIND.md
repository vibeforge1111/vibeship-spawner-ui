# Mind v5 - Vibeship Spawner Memory System

Mind v5 is the persistent memory system that powers learning and improvement in Vibeship Spawner. It automatically captures decisions, issues, learnings, and improvements from mission executions.

## Overview

Mind stores everything in a local SQLite database at `~/.mind/lite/memories.db`. All data persists across sessions and can be viewed in the Mind dashboard at `/mind`.

## The Five Tabs

### 1. Learnings Tab

**Purpose:** Track what the system learns from each task execution.

**Content Types:**
- `agent_learning` - Insights extracted from task outcomes
- `task_outcome` - Success/failure records for each task
- `agent_decision` - Decisions made by agents during execution

**How It Works:**
- Automatically recorded after each task completes
- Includes metadata: agent, skill, mission, duration
- Grouped by date for easy browsing
- Pagination: Initial load shows 50, click "Load All" for more

**Use Cases:**
- Review what worked and what didn't
- Identify patterns in successful executions
- Debug failures by examining task outcomes

---

### 2. Improvements Tab

**Purpose:** Track system improvements suggested from mission outcomes.

**Types:**
- `agent_improvement` - Suggestions for specific agents
- `skill_improvement` - Suggestions for skill implementations
- `team_improvement` - Suggestions for team compositions
- `pipeline_improvement` - Suggestions for workflow structure

**How It Works:**
- **Auto-generated** after mission completion:
  - Failed tasks create agent and skill improvements
  - Low success rates (<70%) create pipeline improvements
  - High success rates (>90%) create team improvements (reinforcement)
- **Auto-applied** - All improvements have status "applied" by default
- No manual approval required

**Improvement Fields:**
- `impact` - Estimated impact (0-100%)
- `confidence` - How confident the suggestion is
- `evidenceCount` - Number of tasks supporting this
- `sourceMissions` - Which missions generated this

---

### 3. Decisions Tab

**Purpose:** Record what was accomplished and why.

**How It Works:**
- **Auto-created** when tasks complete successfully
- Format: "Completed: [Task Name]" with reasoning
- Includes skill used and duration

**Manual Creation:**
- Click "+ Add Decision" to record architectural decisions
- Useful for: tech choices, design patterns, trade-offs

**Best Practices:**
- Use for significant decisions that affect the project
- Include "why" not just "what"
- Good for onboarding new team members

---

### 4. Issues Tab

**Purpose:** Track problems, bugs, and blockers.

**How It Works:**
- **Auto-created** when tasks fail during mission execution
- Format: "[Mission Name] Task failed: [Task Name] - [Error]"
- Status: `open` or `resolved`

**Manual Creation:**
- Click "+ Add Issue" to track bugs you encounter
- Useful for: blockers, technical debt, things to fix

**Resolution:**
- Click "Resolve" when issue is fixed
- Resolved issues stay in history for learning
- Helps track what problems were solved

**Issue Workflow:**
1. Task fails → Issue auto-created (open)
2. You investigate and fix
3. Click "Resolve" to close
4. History preserved for future reference

---

### 5. Sessions Tab

**Purpose:** Track mission summaries and progress over time.

**How It Works:**
- **Auto-created** after each mission completes
- Includes: task counts, success rate, agents used, skills used
- One entry per mission execution

**Use Cases:**
- Review what was accomplished in each session
- Track progress over time
- Identify successful patterns

---

## Data Flow

```
Mission Execution
       |
       v
+------+------+
|  Task Runs  |
+------+------+
       |
  +----+----+
  |         |
Success   Failure
  |         |
  v         v
Decision  Issue
  |         |
  +----+----+
       |
       v
   Learning
       |
       v
Improvement (if applicable)
       |
       v
Session Summary
```

## Memory Content Types

| Content Type | Tab | Auto-Created | Temporal Level |
|-------------|-----|--------------|----------------|
| `agent_learning` | Learnings | Yes | Seasonal (3) |
| `task_outcome` | Learnings | Yes | Situational (2) |
| `agent_decision` | Learnings | Yes | Situational (2) |
| `workflow_pattern` | Learnings | Yes | Seasonal (3) |
| `project_decision` | Decisions | Yes | Seasonal (3) |
| `project_issue` | Issues | Yes | Situational (2) |
| `session_summary` | Sessions | Yes | Situational (2) |
| `*_improvement` | Improvements | Yes | Seasonal (3) |

## Temporal Levels

Mind uses temporal levels for memory retention:

1. **Immediate (1)** - Very short-lived, decays quickly
2. **Situational (2)** - Current task/session context
3. **Seasonal (3)** - Project-level, important insights
4. **Identity (4)** - Core knowledge, permanent

## API Endpoints

Mind v5 Lite runs on `http://localhost:8080`:

```bash
# Health check
curl http://localhost:8080/health

# List memories
curl "http://localhost:8080/v1/memories/?limit=50"

# Search memories
curl -X POST http://localhost:8080/v1/memories/retrieve \
  -H "Content-Type: application/json" \
  -d '{"query": "authentication"}'

# Get stats
curl http://localhost:8080/v1/stats
```

## Starting Mind v5

```bash
# From the-mind directory:
start_mind_lite.bat

# Or manually:
cd vibeship-mind
python src/mind/lite_tier.py
```

API: http://localhost:8080
Dashboard: http://localhost:8501

## Timestamps

All timestamps are stored in UTC. The UI automatically converts them to your local timezone.

## Troubleshooting

### Learnings always showing 50
- This is the initial page size
- Click "Load All Learnings" to see all entries

### Improvements tab empty
- Check filter: default is "All", not "Pending"
- Improvements are auto-applied, so "Pending" will be empty

### Issues not appearing
- Issues are only auto-created on task failures
- Run a mission with an intentional failure to test
- Or manually add an issue with "+ Add Issue"

### Timestamps look wrong
- Timestamps are UTC, converted to local time
- If times look off, check your system timezone

### Connection refused
- Start Mind v5: `start_mind_lite.bat`
- Check port 8080 is not in use

## Best Practices

1. **Let it auto-capture** - Don't manually add what's auto-created
2. **Review regularly** - Check Learnings after missions complete
3. **Resolve issues** - Mark issues as resolved to track progress
4. **Trust improvements** - They're auto-applied, no action needed
5. **Use decisions sparingly** - Only for significant architectural choices
