const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8787/sync');

ws.on('open', () => {
  console.log('Connected to sync server');
  
  // Identify as Claude Code
  ws.send(JSON.stringify({
    type: 'identify',
    clientId: 'claude-code-' + Date.now(),
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
    console.log('Requested canvas state...');
  }, 500);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'canvas_state') {
    console.log('\n=== CURRENT CANVAS STATE ===');
    console.log('Nodes:', msg.data.nodeCount || 0);
    console.log('Connections:', msg.data.connectionCount || 0);
    
    if (msg.data.nodes && msg.data.nodes.length > 0) {
      console.log('\nSkills on canvas:');
      msg.data.nodes.forEach((node, i) => {
        console.log(`  ${i + 1}. ${node.skillName} (${node.category})`);
      });
    } else {
      console.log('\nCanvas is empty');
    }
    
    if (msg.data.connections && msg.data.connections.length > 0) {
      console.log('\nConnections:', msg.data.connections.length);
    }
    
    process.exit(0);
  } else if (msg.type === 'canvas_validation') {
    console.log('\n=== VALIDATION RESULT ===');
    console.log('Valid:', msg.data.valid);
    console.log('Ready for execution:', msg.data.readyForExecution);
    if (msg.data.issues && msg.data.issues.length > 0) {
      console.log('Issues:', msg.data.issues);
    }
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
  process.exit(1);
});

// Timeout after 5 seconds
setTimeout(() => {
  console.log('No response received - canvas might be empty or not connected');
  process.exit(0);
}, 5000);