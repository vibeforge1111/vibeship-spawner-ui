const WebSocket = require('ws');

console.log('Testing Canvas Sync with Skills...\n');

function testCanvasSync() {
  return new Promise((resolve) => {
    const ws = new WebSocket('ws://localhost:8797/sync');
    
    ws.on('open', () => {
      console.log('✅ Connected to sync server');
      
      // Test adding a skill from the new skills we created
      const command = {
        id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'canvas_command',
        action: 'add_skill',
        payload: {
          skillId: 'claude-code-integration',
          position: { x: 100, y: 100 },
          config: {}
        },
        meta: {
          source: 'claude-code',
          sessionId: 'test-session-123',
          timestamp: Date.now(),
          priority: 1,
          idempotencyKey: `add-claude-code-integration-${Date.now()}`,
          timeout: 5000
        }
      };
      
      console.log('📤 Sending add_skill command for claude-code-integration...');
      ws.send(JSON.stringify(command));
      
      setTimeout(() => {
        // Test with websocket-state-sync skill
        const command2 = {
          id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'canvas_command',
          action: 'add_skill',
          payload: {
            skillId: 'websocket-state-sync',
            position: { x: 200, y: 100 },
            config: {}
          },
          meta: {
            source: 'claude-code',
            sessionId: 'test-session-123',
            timestamp: Date.now(),
            priority: 1,
            idempotencyKey: `add-websocket-state-sync-${Date.now()}`,
            timeout: 5000
          }
        };
        
        console.log('📤 Sending add_skill command for websocket-state-sync...');
        ws.send(JSON.stringify(command2));
      }, 1000);
      
      setTimeout(() => {
        console.log('\n⏱️  Test complete. Check the Spawner UI canvas for new skills.');
        ws.close();
        resolve();
      }, 3000);
    });
    
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        console.log('📥 Received:', {
          type: msg.type,
          status: msg.status || 'N/A',
          commandId: msg.commandId || 'N/A'
        });
      } catch (e) {
        console.log('📥 Received raw:', data.toString());
      }
    });
    
    ws.on('error', (err) => {
      console.log('❌ WebSocket error:', err.message);
      resolve();
    });
  });
}

testCanvasSync();