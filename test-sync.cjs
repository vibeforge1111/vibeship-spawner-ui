const WebSocket = require('ws');

console.log('Testing sync system...\n');

const ws = new WebSocket('ws://localhost:8787/sync');

ws.on('open', () => {
  console.log('✓ Connected to sync server');
  
  // Identify as Claude Code
  ws.send(JSON.stringify({
    type: 'identify',
    clientId: 'claude-code-test-' + Date.now(),
    clientType: 'claude-code'
  }));
  
  // Try to add a test skill to see if canvas responds
  setTimeout(() => {
    console.log('\nAdding a test skill to canvas...');
    ws.send(JSON.stringify({
      type: 'canvas_add_skill',
      data: {
        skillName: 'API Design'
      },
      source: 'claude-code',
      timestamp: new Date().toISOString()
    }));
    
    setTimeout(() => {
      console.log('\nIf the skill appeared on your canvas, the sync is working!');
      console.log('Check your browser at http://localhost:5173');
      process.exit(0);
    }, 2000);
  }, 500);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('Received message:', msg.type);
  
  if (msg.type === 'canvas_state') {
    console.log('Canvas responded with state!');
    if (msg.data.pipeline) {
      console.log('Pipeline:', msg.data.pipeline.name);
    }
    console.log('Nodes:', msg.data.nodeCount);
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
  process.exit(1);
});