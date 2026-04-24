const WebSocket = require('ws');

console.log('=== Integration Test Workflow ===\n');
console.log('This will test the full bidirectional sync once skills are ready.\n');

const ws = new WebSocket('ws://localhost:8797/sync');

ws.on('open', () => {
  console.log('✓ Connected to sync server\n');
  console.log('Waiting for the new skills to be generated...');
  console.log('Once ready, this workflow will:');
  console.log('  1. Add the new integration skills to canvas');
  console.log('  2. Create connections between them');
  console.log('  3. Test bidirectional communication');
  console.log('  4. Validate state synchronization\n');
  
  // Function to add the new skills once they're ready
  const addNewIntegrationSkills = () => {
    const message = {
      type: 'canvas_add_skills',
      data: {
        skills: [
          // New skills being generated
          { skillName: 'Claude Code Integration' },
          { skillName: 'WebSocket State Sync' },
          { skillName: 'Spawner MCP Bridge' },
          { skillName: 'Canvas Collaboration' },
          { skillName: 'Event Sourcing Sync' },
          
          // Existing supporting skills
          { skillName: 'Realtime Engineer' },
          { skillName: 'MCP Builder' }
        ],
        autoConnect: true,
        autoLayout: 'grid'
      },
      source: 'claude-code',
      timestamp: new Date().toISOString()
    };
    
    console.log('📤 Sending complete integration stack to canvas...');
    ws.send(JSON.stringify(message));
  };
  
  // Function to test state sync
  const testStateSync = () => {
    console.log('\n🔄 Testing state synchronization...');
    
    // Request current state
    ws.send(JSON.stringify({
      type: 'canvas_get_state',
      data: {},
      source: 'claude-code',
      timestamp: new Date().toISOString()
    }));
    
    // Test validation
    setTimeout(() => {
      ws.send(JSON.stringify({
        type: 'canvas_validate',
        data: {},
        source: 'claude-code',
        timestamp: new Date().toISOString()
      }));
    }, 1000);
  };
  
  // Function to test command execution
  const testCommandExecution = () => {
    console.log('\n⚡ Testing command execution...');
    
    // Create a test connection
    ws.send(JSON.stringify({
      type: 'canvas_connect',
      data: {
        sourceNodeId: 'claude-code-integration',
        targetNodeId: 'websocket-state-sync'
      },
      source: 'claude-code',
      timestamp: new Date().toISOString()
    }));
  };
  
  console.log('Press Enter when skills are ready to test...');
  
  // Listen for Enter key
  process.stdin.once('data', () => {
    console.log('\n🚀 Starting integration test...\n');
    
    addNewIntegrationSkills();
    
    setTimeout(() => {
      testStateSync();
    }, 2000);
    
    setTimeout(() => {
      testCommandExecution();
    }, 4000);
    
    setTimeout(() => {
      console.log('\n✅ Integration test workflow complete!');
      console.log('Check your canvas for the full integration stack.');
      process.exit(0);
    }, 6000);
  });
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'canvas_state') {
    console.log('📊 Received canvas state:');
    if (msg.data.pipeline) {
      console.log('  Pipeline:', msg.data.pipeline.name);
    }
    console.log('  Nodes:', msg.data.nodeCount || 0);
    console.log('  Connections:', msg.data.connectionCount || 0);
  } else if (msg.type === 'canvas_validation') {
    console.log('✓ Validation result:', msg.data.valid ? 'VALID' : 'INVALID');
    if (msg.data.issues) {
      console.log('  Issues:', msg.data.issues);
    }
  } else if (msg.type === 'canvas_error') {
    console.log('❌ Error:', msg.data.error);
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
  process.exit(1);
});