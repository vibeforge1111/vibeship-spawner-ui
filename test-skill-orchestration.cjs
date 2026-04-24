const WebSocket = require('ws');

console.log('🎭 Testing Skill Orchestration Flow...\n');

function testOrchestration() {
  return new Promise((resolve) => {
    const ws = new WebSocket('ws://localhost:8797/sync');
    
    ws.on('open', () => {
      console.log('✅ Connected to sync server');
      
      // Step 1: Test Claude Code Integration (Primary Orchestrator)
      console.log('\n🎯 STEP 1: Testing claude-code-integration');
      const integrationCommand = {
        id: 'orch-test-1',
        type: 'canvas_command',
        action: 'orchestrate_workflow',
        payload: {
          workflow: 'sync_test',
          skills: [
            {
              id: 'claude-code-integration',
              role: 'orchestrator',
              position: { x: 50, y: 100 }
            },
            {
              id: 'websocket-state-sync',
              role: 'state_manager',
              position: { x: 200, y: 100 }
            },
            {
              id: 'spawner-mcp-bridge',
              role: 'executor',
              position: { x: 350, y: 100 }
            },
            {
              id: 'event-sourcing-sync',
              role: 'auditor',
              position: { x: 500, y: 100 }
            }
          ]
        },
        meta: {
          source: 'claude-code',
          sessionId: 'orchestration-test',
          timestamp: Date.now()
        }
      };
      
      ws.send(JSON.stringify(integrationCommand));
      
      setTimeout(() => {
        // Step 2: Test Handoff from claude-code-integration to websocket-state-sync
        console.log('\n🔄 STEP 2: Testing handoff to websocket-state-sync');
        const handoffCommand = {
          id: 'orch-test-2',
          type: 'skill_handoff',
          action: 'state_sync_required',
          payload: {
            from: 'claude-code-integration',
            to: 'websocket-state-sync',
            trigger: 'State change detected',
            data: {
              nodes: ['claude-code-integration', 'websocket-state-sync'],
              connections: [],
              version: 1
            }
          },
          meta: {
            source: 'claude-code',
            handoffType: 'state_management'
          }
        };
        
        ws.send(JSON.stringify(handoffCommand));
      }, 1000);
      
      setTimeout(() => {
        // Step 3: Test Handoff to spawner-mcp-bridge for execution
        console.log('\n⚡ STEP 3: Testing handoff to spawner-mcp-bridge');
        const executionCommand = {
          id: 'orch-test-3',
          type: 'skill_handoff',
          action: 'execute_pipeline',
          payload: {
            from: 'websocket-state-sync',
            to: 'spawner-mcp-bridge',
            trigger: 'Execute command received',
            pipelineId: 'test-sync-pipeline',
            nodes: ['claude-code-integration', 'websocket-state-sync']
          },
          meta: {
            source: 'spawner-ui',
            handoffType: 'execution'
          }
        };
        
        ws.send(JSON.stringify(executionCommand));
      }, 2000);
      
      setTimeout(() => {
        // Step 4: Test event-sourcing-sync for audit trail
        console.log('\n📝 STEP 4: Testing event-sourcing-sync for audit trail');
        const auditCommand = {
          id: 'orch-test-4',
          type: 'skill_handoff',
          action: 'log_events',
          payload: {
            from: 'spawner-mcp-bridge',
            to: 'event-sourcing-sync',
            events: [
              { type: 'workflow_started', timestamp: Date.now() - 3000 },
              { type: 'state_synced', timestamp: Date.now() - 2000 },
              { type: 'pipeline_executed', timestamp: Date.now() - 1000 },
              { type: 'audit_logged', timestamp: Date.now() }
            ]
          },
          meta: {
            source: 'system',
            handoffType: 'audit'
          }
        };
        
        ws.send(JSON.stringify(auditCommand));
      }, 3000);
      
      setTimeout(() => {
        console.log('\n✅ Orchestration test complete!');
        console.log('Check Spawner UI to see if skills were coordinated correctly.');
        ws.close();
        resolve();
      }, 5000);
    });
    
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type !== 'connected') {
          console.log(`📥 Response: ${msg.type} (${msg.status || 'processing'})`);
        }
      } catch (e) {
        console.log('📥 Raw response:', data.toString().substring(0, 100));
      }
    });
    
    ws.on('error', (err) => {
      console.log('❌ Error:', err.message);
      resolve();
    });
  });
}

testOrchestration();