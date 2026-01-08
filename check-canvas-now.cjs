const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8787/sync');

ws.on('open', () => {
  console.log('Connected to sync server');
  
  // Identify as Claude Code
  ws.send(JSON.stringify({
    type: 'identify',
    clientId: 'claude-code-checker-' + Date.now(),
    clientType: 'claude-code'
  }));
  
  // Request canvas state
  setTimeout(() => {
    ws.send(JSON.stringify({
      type: 'canvas_get_state',
      data: {},
      source: 'claude-code',
      timestamp: new Date().toISOString()
    }));
    console.log('Requesting canvas state...\n');
  }, 500);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'canvas_state') {
    console.log('=== CURRENT CANVAS STATE ===');
    
    // Show pipeline info if available
    if (msg.data.pipeline) {
      console.log('\nPipeline: "' + msg.data.pipeline.name + '"');
      console.log('Pipeline ID:', msg.data.pipeline.id);
    }
    
    console.log('\nNodes on canvas:', msg.data.nodeCount || 0);
    console.log('Connections:', msg.data.connectionCount || 0);
    
    if (msg.data.nodes && msg.data.nodes.length > 0) {
      console.log('\nSkills currently on canvas:');
      msg.data.nodes.forEach((node, i) => {
        console.log(`  ${i + 1}. ${node.skillName || node.skillId} (${node.category})`);
      });
    } else {
      console.log('\nCanvas is empty - no skills added yet');
    }
    
    setTimeout(() => process.exit(0), 500);
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
  process.exit(1);
});

// Timeout after 3 seconds
setTimeout(() => {
  console.log('Timeout - no response received');
  console.log('The canvas might not be sending state updates.');
  process.exit(0);
}, 3000);