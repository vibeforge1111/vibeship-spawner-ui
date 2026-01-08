# 🚀 CLAUDE CODE KICKOFF PROMPT
## Copy everything below this line into Claude Code

---

I have a PRD draft for "Agent Theatre" - a Three.js visualization that shows our Spawner UI agents as animated 3D characters working together in real-time.

**YOUR MISSION:**

1. **DISCOVER** - Check our GitHub repo for Spawner UI to understand:
   - All agent types we have (what are they called? what do they do?)
   - Workflow execution system (how are tasks run? what events are emitted?)
   - Memory/Mind/Learning systems (how do agents store and retrieve knowledge?)
   - Any existing WebSocket/API patterns we use
   - The bridge between Spawner UI and Claude Code

2. **DOCUMENT** - Search the PRD for `[CLAUDE_CODE_FILL]` markers and fill them with:
   - Actual agent types → character mappings
   - Real event types and their schemas
   - Actual API endpoints and data structures
   - Connection/auth patterns we use

3. **ARCHITECT** - Based on what you find:
   - Design the bridge server that connects Spawner UI events to the Three.js frontend
   - Map our workflow execution events to character animations
   - Plan how conversations between agents will flow to the visualization

4. **SCAFFOLD** - Generate initial code:
   - Bridge server (WebSocket + REST)
   - Event normalization layer
   - Basic Three.js project structure
   - Config files with our actual endpoints

**CONTEXT:**
- The Three.js app will run in a browser and connect to our local system
- It should show agents as stylized characters (think Pixar meets mission control)
- Real-time sync with workflow execution
- Agents should "talk" to each other with speech bubbles
- We want it to be genuinely fun to watch

**START BY:**
```
1. List all files in the Spawner UI repo related to:
   - agents
   - workflows  
   - events/messaging
   - memory/mind
   
2. Show me the agent types and their purposes

3. Show me how workflow execution events are structured

4. Then let's update the PRD together
```

The PRD draft is attached/available - look for `agent-theatre-prd.md`. 

Let's build something awesome! 🎭
