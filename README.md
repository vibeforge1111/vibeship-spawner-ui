# Spawner UI

Visual workflow builder for orchestrating AI agents. Build workflows by connecting skills, then execute them through Claude Code via MCP.

## Prerequisites

- **Node.js** 18+
- **Claude Code** with MCP server running
- **Anthropic API Key** (for goal analysis features)

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Features

- **Canvas** - Visual workflow builder with drag-and-drop nodes
- **Goal-to-Workflow** - Describe what you want, get a workflow generated
- **Skill Browser** - Search and add skills to your workflow
- **Mission Execution** - Run workflows through MCP with real-time logs
- **Validation** - Check workflows for issues before running

## MCP Connection

Spawner requires an MCP server connection to execute workflows. Configure in Settings or the app will prompt you when needed.

Default: `http://localhost:3001`

## Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview production build
npm run check    # Type check
```

## Project Structure

```
src/
├── lib/
│   ├── components/   # UI components
│   ├── services/     # Core logic (MCP client, executor, etc.)
│   └── stores/       # Svelte stores (canvas, MCP state)
└── routes/
    ├── canvas/       # Main workflow builder
    ├── builder/      # Stack builder
    └── mind/         # Memory/decisions view
```

## Documentation

Full documentation coming soon. For now, start with the canvas and try:

1. Click "New Goal" to generate a workflow from a description
2. Or browse skills and drag them onto the canvas
3. Connect nodes to define execution order
4. Click "Run" to execute via MCP

---

Built with SvelteKit, Tailwind CSS, and Svelvet.
