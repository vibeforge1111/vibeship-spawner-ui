# Spark Art Bible

Status: draft design source of truth  
Audience: Spawner UI, Spark Skill Graphs visualizer, docs, launch pages, future Spark surfaces

Spark should feel like a serious local command center: calm, precise, technical, and alive. The product is about making agent work visible and steerable, so the design language should make invisible processes legible without turning the interface into a toy.

## Product Feeling

Spark is:

- focused
- operational
- graph-aware
- trustworthy
- quietly premium
- fast to scan
- friendly without being cute

Spark is not:

- a marketing landing page inside the product
- a decorative gradient playground
- a generic SaaS dashboard
- a terminal wall of noise
- a cartoon agent manager

## Visual Metaphor

The core metaphor is an execution control room.

```text
Goal -> Plan -> Skills -> Agents -> Canvas -> Evidence -> Result
```

The UI should show flow, state, and confidence. It should not hide complexity, but it should compress it into readable layers.

## Layout System

Use dense but breathable operational layouts.

Rules:

- first screen should show the working surface, not a hero
- top nav/header stays compact
- panels are functional, not decorative
- avoid card-inside-card nesting
- repeated entities may use cards
- dashboards should favor tables, rows, timelines, and graph panels
- long explanations belong in docs, not in app chrome

Common page structure:

```text
Header
  product mark
  surface name
  status/action cluster

Main
  primary work surface
  right-side details or inspector
  bottom execution/event strip when needed
```

## Header and Logo

The Spark mark should appear as a first-viewport signal on branded Spark surfaces.

Header rules:

- logo left
- surface name near logo
- operational status right
- no oversized nav
- no decorative hero treatment inside tools
- keep header height compact

Recommended header anatomy:

```text
[Spark mark] Spark / Spawner       [local] [sync status] [primary action]
```

Logo usage:

- use the full Spark wordmark on docs and landing surfaces
- use compact mark + surface name inside tools
- do not bury Spark only in tiny nav text
- do not place logo inside a floating card

## Color System

Spark should use a restrained dark operational base with clear status color.

Token intent:

```text
bg-primary       app background
bg-secondary     panels and quiet surfaces
surface-border   separators
text-primary     main reading text
text-secondary   supporting text
text-tertiary    metadata
accent-primary   active graph/agent/selection
status-success   passed/ready
status-warning   attention/queued
status-error     failed/blocked
status-info      informational
```

Guidance:

- avoid one-note purple or blue domination
- use accent color sparingly for active state
- use status colors only for actual state
- graph nodes may carry category color, but selected/hot state must be stronger than category tint
- docs and visualizer should use the same token names where practical

## Typography

Typography should feel technical and readable.

Rules:

- use compact headings inside dashboards
- avoid hero-scale text inside tools
- use monospace for IDs, paths, commands, timestamps, and scores
- use normal letter spacing
- do not scale font size with viewport width
- keep button labels short

Suggested hierarchy:

```text
Page title       24-28px
Panel heading    14-16px
Body             13-15px
Metadata         11-12px monospace
```

## Components

### Panels

Panels hold actual tools or grouped operational state.

Rules:

- border radius 6-8px
- subtle border
- no nested panels
- no decorative shadows unless needed for modal elevation
- header row should include title + status/action

### Buttons

Buttons should use icons when the action is common.

Rules:

- primary button only for the next important action
- secondary button for view/filter/toggle actions
- icon buttons need tooltips when meaning is not obvious
- avoid pill-heavy command clusters

### Badges

Badges encode status, tier, or source.

Common badges:

```text
pass
fail
golden
challenge
core
supporting
related
planned
available
selected
private
untrusted
```

### Tables and Rows

Use tables for comparable operational data.

Rules:

- compact row height
- sticky headers where useful
- monospace IDs
- status at the left or far right
- row expansion for evidence

### Inspector

Inspectors should answer:

- what is this?
- why is it selected?
- what depends on it?
- what changed?
- what action can I take?

## Graph Visual Language

Graph views should be readable first and beautiful second.

Node states:

```text
idle       muted
loaded     accent outline
hot        stronger glow or ring
orphan     faded
blocked    error outline
planned    dashed outline
private    lock marker
```

Edge states:

```text
delegate v1      thin line
delegate v2      thicker line
selected path    accent line
missing target   warning dashed line
blocked edge     error line
```

Graph behavior:

- selected node opens an inspector
- hover reveals direct neighbors
- filters should be explicit controls, not hidden gestures
- search should focus and zoom to result
- graph should have a list fallback for accessibility

## Canvas Execution Panel

The Canvas execution panel is the clearest expression of Spark Pro.

It should show:

- goal
- plan phases
- active task
- agent/provider
- selected skills
- execution state
- artifacts
- trace/events
- next operator action

Avoid:

- vague “AI is thinking” copy
- overly animated progress
- hiding failures behind generic errors

## Agent Swarm Visual Language

Agents should appear as accountable operators, not characters.

Represent agents by:

- role
- current task
- state
- tool authority
- selected skills
- output artifacts

Agent states:

```text
idle
planning
working
waiting
blocked
reviewing
done
failed
```

Swarm UI should make coordination visible:

```text
who owns what
who is blocked
who depends on whom
what changed
what needs user approval
```

## Eval Dashboard Language

Eval dashboards should be honest and calm.

Use:

- pass/fail
- precision
- recall
- must-not clean rate
- planned gap
- available skill
- selected skill

Do not use:

- “perfect”
- “magic”
- “AI solved it”
- vanity-only scores

## Empty, Loading, and Error States

Empty states should be operational.

Examples:

```text
No skill graph loaded.
Import a skill folder or start the MCP server.
```

```text
No matching skills yet.
Try a more specific task, or add selection hints to the closest skill.
```

Error states should include:

- what failed
- why it probably failed
- what to run next
- link to logs or trace if available

## Docs and Launch Pages

Docs should feel like the same product family but can be lighter.

Rules:

- first viewport should clearly say Spark Skill Graphs
- show actual graph/product screenshots
- show install command early
- explain open-source vs pro honestly
- avoid vague AI platform claims

## Open Source vs Pro Visual Split

Open-source Spark Skill Graphs:

- standard
- graph
- CLI
- MCP
- registry
- community

Visual style: technical, transparent, inspectable.

Spark/Spawner Pro:

- execution
- private graphs
- dashboards
- swarm
- hosted/team workflows

Visual style: more polished, still dense and operational.

## Copy Voice

Spark copy should be direct and grounded.

Use:

- “Selected because...”
- “Missing edge target”
- “Skill available, not selected”
- “This case passes by proxy skills”
- “Run validation”

Avoid:

- hype
- fake certainty
- anthropomorphic fluff
- unexplained internal jargon

## Screenshots

Screenshots should show real working states:

- graph with selected skill
- eval dashboard with planned gaps
- canvas execution panel with running task
- swarm view with distinct agent states
- MCP/CLI result

Avoid empty mock dashboards unless documenting empty states.

## Implementation Checklist

Every new Spark surface should answer:

- Does Spark identity appear in the header?
- Does the page show working state in the first viewport?
- Are statuses color-coded consistently?
- Can a user tell what to focus on?
- Can a user inspect why something happened?
- Are IDs, paths, and commands monospace?
- Are errors actionable?
- Does it fit the open-source or pro visual role?

