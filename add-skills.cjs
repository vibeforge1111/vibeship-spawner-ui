const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8797/sync');

ws.on('open', () => {
  console.log('Connected to sync server');
  
  // Identify as Claude Code
  ws.send(JSON.stringify({
    type: 'identify',
    clientId: 'claude-code-' + Date.now(),
    clientType: 'claude-code'
  }));
  
  // Add some skills to canvas
  setTimeout(() => {
    const message = {
      type: 'canvas_add_skills',
      data: {
        skills: [
          { skillName: 'Next.js App Router' },
          { skillName: 'React Patterns' },
          { skillName: 'Supabase Backend' },
          { skillName: 'Authentication & OAuth' }
        ],
        autoConnect: true,
        autoLayout: 'horizontal'
      },
      source: 'claude-code',
      timestamp: new Date().toISOString()
    };
    
    ws.send(JSON.stringify(message));
    console.log('Sent request to add 4 skills to canvas...');
    
    // Give it time to process
    setTimeout(() => {
      console.log('Skills should now be visible on your canvas!');
      process.exit(0);
    }, 2000);
  }, 500);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('Received:', msg.type);
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
  process.exit(1);
});