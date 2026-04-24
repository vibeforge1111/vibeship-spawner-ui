const WebSocket = require('ws');

console.log('Adding skills to your canvas...\n');

const ws = new WebSocket('ws://localhost:8797/sync');

ws.on('open', () => {
  console.log('✓ Connected to sync server');
  
  // Identify as Claude Code
  ws.send(JSON.stringify({
    type: 'identify',
    clientId: 'claude-code-' + Date.now(),
    clientType: 'claude-code'
  }));
  
  // Wait a bit then add skills
  setTimeout(() => {
    const message = {
      type: 'canvas_add_skills',
      data: {
        skills: [
          { skillName: 'React Patterns' },
          { skillName: 'Next.js App Router' },
          { skillName: 'Supabase Backend' },
          { skillName: 'Authentication & OAuth' },
          { skillName: 'API Design' }
        ],
        autoConnect: true,
        autoLayout: 'horizontal'
      },
      source: 'claude-code',
      timestamp: new Date().toISOString()
    };
    
    ws.send(JSON.stringify(message));
    console.log('📤 Sent request to add 5 skills with auto-connections');
    console.log('\n🎯 Skills being added:');
    console.log('  1. React Patterns');
    console.log('  2. Next.js App Router');
    console.log('  3. Supabase Backend');
    console.log('  4. Authentication & OAuth');
    console.log('  5. API Design');
    console.log('\n✨ Check your canvas - they should appear in horizontal layout!');
    
    setTimeout(() => {
      ws.close();
      process.exit(0);
    }, 2000);
  }, 500);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'canvas_state') {
    console.log('\n📊 Canvas responded! Current state:');
    if (msg.data.pipeline) {
      console.log('  Pipeline:', msg.data.pipeline.name);
    }
    console.log('  Nodes:', msg.data.nodeCount || 0);
    console.log('  Connections:', msg.data.connectionCount || 0);
  }
});

ws.on('error', (err) => {
  console.error('❌ Error:', err);
});