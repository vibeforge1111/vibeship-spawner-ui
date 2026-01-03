# Spawner UI - Implementation Plan

> Visual orchestration platform for AI skill chains

## Current State

### Built (4 commits)
- **Welcome page** - Hero, tool cards, footer
- **Canvas page** - Sidebar, nodes, connections, chat input
- **Navbar** - Logo, Guide, Skills dropdown, GitHub
- **SkillNode component** - Ports, sharp edges, selection
- **Design system** - Vibeship teal palette, sharp corners, Instrument Serif font

### Project Structure
```
src/
├── routes/
│   ├── +page.svelte          ✅ Welcome
│   └── canvas/+page.svelte   ✅ Visual builder
├── lib/
│   ├── components/
│   │   ├── Icon.svelte       ✅
│   │   ├── Navbar.svelte     ✅
│   │   ├── Welcome.svelte    ✅
│   │   └── nodes/
│   │       └── SkillNode.svelte ✅
│   ├── stores/               ❌ Empty
│   ├── types/
│   │   └── skill.ts          ✅ Basic types
│   └── utils/                ❌ Empty
└── static/
    └── logo.png              ✅
```

---

## Implementation Phases

### Phase 1: Skills Foundation
**Goal:** Browse and search 273+ skills

| Task | Priority | Files |
|------|----------|-------|
| Create skills store with data loading | P0 | `stores/skills.ts` |
| Build SkillCard component | P0 | `components/SkillCard.svelte` |
| Build SkillRow component | P0 | `components/SkillRow.svelte` |
| Create /skills route with grid/list view | P0 | `routes/skills/+page.svelte` |
| Add SkillsSidebar with categories | P0 | `components/SkillsSidebar.svelte` |
| Create /skills/[id] detail page | P1 | `routes/skills/[id]/+page.svelte` |
| Add search and filter functionality | P1 | Update stores/skills.ts |
| Add layer filtering (Core/Integration/Polish) | P1 | Update SkillsSidebar |

**Data source:** Load from `~/.spawner/skills/` or fetch from MCP

---

### Phase 2: Agent Builder
**Goal:** Select and compose agents for projects

| Task | Priority | Files |
|------|----------|-------|
| Create stack store (agents, MCPs, selection) | P0 | `stores/stack.ts` |
| Build AgentCard component | P0 | `components/AgentCard.svelte` |
| Build McpCard component | P0 | `components/McpCard.svelte` |
| Create /builder route | P0 | `routes/builder/+page.svelte` |
| Add recommendation service | P1 | `services/recommendations.ts` |
| Show compatible skills per agent | P1 | Update builder page |
| Add agent orchestration preview | P2 | Canvas integration |

**Agents to include:**
- Planner (orchestrator) - always included
- Frontend, Backend, Database
- Testing, DevOps, Payments
- Email, Search, AI

---

### Phase 3: Discovery Flow
**Goal:** Guided project setup questionnaire

| Task | Priority | Files |
|------|----------|-------|
| Create discovery store | P0 | `stores/discovery.ts` |
| Build discovery questionnaire UI | P0 | `routes/discovery/+page.svelte` |
| Add project type detection | P1 | `services/recommendations.ts` |
| Build summary/export page | P1 | `routes/summary/+page.svelte` |
| Add gist export functionality | P2 | `services/gist.ts` |
| Add config download option | P2 | Update summary page |

**Discovery questions:**
1. What are you building? (description)
2. Project type (SaaS, marketplace, AI app, etc.)
3. Required features (auth, payments, search, etc.)
4. Deployment target (Vercel, Cloudflare, etc.)

---

### Phase 4: Documentation
**Goal:** Guides and educational content

| Task | Priority | Files |
|------|----------|-------|
| Create /guide (MCP setup) | P0 | `routes/guide/+page.svelte` |
| Create /skills/create | P1 | `routes/skills/create/+page.svelte` |
| Create /how-it-works | P1 | `routes/how-it-works/+page.svelte` |
| Add getting started tutorial | P2 | `routes/skills/guides/+page.svelte` |
| Add skill creation guide | P2 | Content pages |

---

### Phase 5: Canvas Enhancement
**Goal:** Full visual workflow builder

| Task | Priority | Files |
|------|----------|-------|
| Add drag-and-drop nodes | P0 | Update canvas page |
| Implement connection drawing | P0 | `components/canvas/ConnectionLine.svelte` |
| Add zoom/pan controls | P1 | `components/canvas/Controls.svelte` |
| Create node palette/library | P1 | `components/canvas/NodePalette.svelte` |
| Add undo/redo functionality | P2 | `stores/canvas.ts` |
| Implement node configuration panel | P2 | `components/panels/NodeConfig.svelte` |
| Add workflow validation | P2 | `services/validation.ts` |
| Add workflow execution | P3 | MCP integration |

---

### Phase 6: Polish
**Goal:** Production-ready experience

| Task | Priority | Files |
|------|----------|-------|
| Add ThemeToggle (light/dark) | P1 | `components/ThemeToggle.svelte` |
| Create Footer with install command | P1 | `components/Footer.svelte` |
| Add loading states/skeletons | P1 | Various components |
| Implement error handling | P1 | Error boundaries |
| Add keyboard shortcuts | P2 | Global handlers |
| Mobile responsive improvements | P2 | CSS updates |
| Add animations/transitions | P2 | CSS + Svelte transitions |

---

## Data Structures

### Skills Store
```typescript
// stores/skills.ts
interface SkillsStore {
  skills: Skill[];
  categories: string[];
  loading: boolean;

  // Derived
  skillsByCategory: Map<string, Skill[]>;

  // Actions
  loadSkills(): Promise<void>;
  searchSkills(query: string): Skill[];
  filterByCategory(category: string): Skill[];
  filterByLayer(layer: 1 | 2 | 3): Skill[];
  getSkillById(id: string): Skill | undefined;
}
```

### Stack Store
```typescript
// stores/stack.ts
interface StackStore {
  agents: Agent[];
  mcps: MCP[];
  selectedAgents: string[];
  selectedMcps: string[];
  projectDescription: string;

  // Actions
  toggleAgent(id: string): void;
  toggleMcp(id: string): void;
  setDescription(desc: string): void;
  getRecommendations(): Recommendations;
}
```

### Canvas Store
```typescript
// stores/canvas.ts
interface CanvasStore {
  nodes: SkillNodeData[];
  connections: Connection[];
  selectedNodeId: string | null;
  zoom: number;
  pan: { x: number; y: number };

  // Actions
  addNode(node: SkillNodeData): void;
  removeNode(id: string): void;
  updateNode(id: string, data: Partial<SkillNodeData>): void;
  addConnection(conn: Connection): void;
  removeConnection(id: string): void;
  setSelection(id: string | null): void;
}
```

---

## Route Structure (Target)

```
/                           Welcome page
/canvas                     Visual workflow builder
/skills                     Skills directory
/skills/[id]                Skill detail page
/skills/create              Skill creation guide
/skills/find                Skill finder
/builder                    Agent/MCP builder
/discovery                  Project discovery flow
/summary                    Export configuration
/guide                      MCP installation guide
/how-it-works               Architecture explanation
```

---

## Priority Order

### Sprint 1: Skills Browser
1. ✅ Skills store with data
2. ✅ SkillCard + SkillRow components
3. ✅ /skills page with sidebar
4. ✅ Search and category filtering

### Sprint 2: Skill Details
1. ✅ /skills/[id] dynamic route
2. ✅ Patterns, Anti-patterns, Gotchas tabs
3. ✅ Collaboration section
4. ✅ Handoff triggers display

### Sprint 3: Builder
1. ✅ Stack store
2. ✅ AgentCard + McpCard
3. ✅ /builder page
4. ✅ Recommendations engine

### Sprint 4: Discovery + Export
1. ✅ Discovery questionnaire
2. ✅ Summary page
3. ✅ Gist export
4. ✅ Config download

### Sprint 5: Canvas V2
1. ✅ Drag-and-drop
2. ✅ Connection drawing
3. ✅ Node palette
4. ✅ Validation

### Sprint 6: Polish
1. ✅ Theme toggle
2. ✅ Loading states
3. ✅ Mobile responsive
4. ✅ Keyboard shortcuts

---

## Technical Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| State management | Svelte 5 runes | Native, reactive, performant |
| Styling | Tailwind CSS | Consistent with design system |
| Icons | Custom Icon.svelte | Control, no external deps |
| Skills data | Local files + MCP | Offline-first, real-time updates |
| Canvas library | Custom SVG | Full control, matches design |
| Authentication | GitHub OAuth | Gist export, familiar flow |

---

## Next Steps

Start with **Phase 1: Skills Foundation** since:
1. Skills are the core value proposition
2. 273+ skills already exist in the ecosystem
3. Enables browsing before building workflows
4. Natural entry point for new users

First task: Create `stores/skills.ts` with skill loading and search.
