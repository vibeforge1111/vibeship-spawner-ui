const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8787/sync');

ws.on('open', () => {
  console.log('Connected to sync server');
  
  // Identify as Claude Code
  ws.send(JSON.stringify({
    type: 'identify',
    clientId: 'claude-code-check-' + Date.now(),
    clientType: 'claude-code'
  }));
  
  // Request canvas state which should include pipeline info
  setTimeout(() => {
    ws.send(JSON.stringify({
      type: 'canvas_get_state',
      data: {},
      source: 'claude-code',
      timestamp: new Date().toISOString()
    }));
    console.log('Requesting canvas and pipeline state...');
  }, 500);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  
  if (msg.type === 'canvas_state') {
    console.log('\n=== CURRENT CANVAS STATE ===');
    console.log('Nodes on canvas:', msg.data.nodeCount || 0);
    console.log('Connections:', msg.data.connectionCount || 0);
    
    if (msg.data.nodes && msg.data.nodes.length > 0) {
      console.log('\nSkills currently on canvas:');
      msg.data.nodes.forEach((node, i) => {
        console.log(`  ${i + 1}. ${node.skillName || node.skillId} (${node.category})`);
      });
    }
    
    // The pipeline info isn't included in canvas_state by default
    // We need to check localStorage via browser console for that
    console.log('\n=== TO CHECK WHICH PIPELINE ===');
    console.log('Run this in your browser console:');
    console.log(`
const pipelines = JSON.parse(localStorage.getItem('spawner-pipelines') || '{}');
const activeId = pipelines.activePipelineId;
const activePipeline = pipelines.pipelines?.find(p => p.id === activeId);
console.log('Active Pipeline:', activePipeline?.name || 'None');
console.log('Pipeline ID:', activeId);
    `);
    
    setTimeout(() => process.exit(0), 1000);
  } else if (msg.type === 'connected') {
    console.log('WebSocket connected successfully');
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
  process.exit(1);
});

// Timeout after 5 seconds
setTimeout(() => {
  console.log('\nTimeout - The canvas might be disconnected.');
  console.log('Please ensure the Spawner UI is open and connected.');
  process.exit(0);
}, 5000);