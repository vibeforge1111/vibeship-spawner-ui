const WebSocket = require('ws');

console.log('Adding integration skills for Claude Code + Spawner UI...\n');

const ws = new WebSocket('ws://localhost:8797/sync');

ws.on('open', () => {
  console.log('✓ Connected to sync server');
  
  setTimeout(() => {
    const message = {
      type: 'canvas_add_skills',
      data: {
        skills: [
          // Core real-time skills
          { skillName: 'Realtime Engineer' },
          { skillName: 'WebSockets & Real-time' },
          
          // MCP & Integration
          { skillName: 'MCP Builder' },
          
          // AI & Automation
          { skillName: 'AI Agents' },
          { skillName: 'Multi-Agent Orchestration' },
          
          // Supporting infrastructure
          { skillName: 'Background Jobs' },
          { skillName: 'Event-Driven Architecture' }
        ],
        autoConnect: true,
        autoLayout: 'grid'
      },
      source: 'claude-code',
      timestamp: new Date().toISOString()
    };
    
    ws.send(JSON.stringify(message));
    
    console.log('📤 Sending critical integration skills:\n');
    console.log('Real-time & Sync:');
    console.log('  • Realtime Engineer - WebSocket expertise');
    console.log('  • WebSockets & Real-time - Live sync patterns\n');
    
    console.log('MCP & Claude:');
    console.log('  • MCP Builder - Model Context Protocol\n');
    
    console.log('AI Orchestration:');
    console.log('  • AI Agents - Tool use & memory');
    console.log('  • Multi-Agent Orchestration - Coordination\n');
    
    console.log('Infrastructure:');
    console.log('  • Background Jobs - Async processing');
    console.log('  • Event-Driven Architecture - Event routing\n');
    
    console.log('✨ These skills will help build perfect bidirectional sync!');
    
    setTimeout(() => {
      ws.close();
      process.exit(0);
    }, 2000);
  }, 500);
});

ws.on('error', (err) => {
  console.error('❌ Error:', err);
});