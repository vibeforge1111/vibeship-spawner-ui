// Run this in browser console to create a test pipeline
// Or use: node test-pipeline.cjs (outputs the JSON to paste in console)

const testPipeline = {
  "version": 1,
  "savedAt": new Date().toISOString(),
  "nodes": [
    {
      "id": "node-1-test",
      "skillId": "api-design",
      "skill": {
        "id": "api-design",
        "name": "API Design",
        "description": "Design RESTful API endpoints with proper structure",
        "category": "development",
        "tags": ["api", "rest", "design"],
        "triggers": ["design api", "create endpoints"]
      },
      "position": { "x": 100, "y": 150 },
      "status": "idle"
    },
    {
      "id": "node-2-test",
      "skillId": "backend-implementation",
      "skill": {
        "id": "backend-implementation",
        "name": "Backend Implementation",
        "description": "Implement backend logic and database operations",
        "category": "development",
        "tags": ["backend", "database", "logic"],
        "triggers": ["implement backend", "build api"]
      },
      "position": { "x": 400, "y": 150 },
      "status": "idle"
    },
    {
      "id": "node-3-test",
      "skillId": "testing",
      "skill": {
        "id": "testing",
        "name": "Integration Testing",
        "description": "Write and run integration tests to verify functionality",
        "category": "testing",
        "tags": ["testing", "integration", "qa"],
        "triggers": ["write tests", "test api"]
      },
      "position": { "x": 700, "y": 150 },
      "status": "idle"
    }
  ],
  "connections": [
    {
      "id": "conn-1-test",
      "sourceNodeId": "node-1-test",
      "sourcePortId": "output",
      "targetNodeId": "node-2-test",
      "targetPortId": "input"
    },
    {
      "id": "conn-2-test",
      "sourceNodeId": "node-2-test",
      "sourcePortId": "output",
      "targetNodeId": "node-3-test",
      "targetPortId": "input"
    }
  ],
  "zoom": 1,
  "pan": { "x": 50, "y": 50 }
};

// Output for browser console
console.log("Paste this in browser console:");
console.log(`localStorage.setItem('spawner-canvas-state', '${JSON.stringify(testPipeline).replace(/'/g, "\\'")}'); location.reload();`);
