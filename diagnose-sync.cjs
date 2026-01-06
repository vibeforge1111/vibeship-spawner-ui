const WebSocket = require('ws');

console.log('=== Sync System Diagnostics ===\n');

let testsRun = 0;
let testsPassed = 0;

function runTest(name, fn) {
  testsRun++;
  console.log(`\n[TEST ${testsRun}] ${name}`);
  return fn();
}

async function diagnose() {
  // Test 1: WebSocket Connection
  await runTest('WebSocket Server Connection', () => {
    return new Promise((resolve) => {
      const ws = new WebSocket('ws://localhost:8787/sync');
      
      ws.on('open', () => {
        console.log('  ✅ Connected to sync server');
        testsPassed++;
        ws.close();
        resolve();
      });
      
      ws.on('error', (err) => {
        console.log('  ❌ Failed to connect:', err.message);
        resolve();
      });
      
      setTimeout(() => {
        console.log('  ❌ Connection timeout');
        ws.close();
        resolve();
      }, 3000);
    });
  });
  
  // Test 2: Message Echo
  await runTest('Message Echo Test', () => {
    return new Promise((resolve) => {
      const ws = new WebSocket('ws://localhost:8787/sync');
      let received = false;
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'echo_test',
          data: { test: 'data' },
          timestamp: new Date().toISOString()
        }));
      });
      
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'echo_test') {
          console.log('  ✅ Echo received');
          testsPassed++;
          received = true;
          ws.close();
          resolve();
        }
      });
      
      setTimeout(() => {
        if (!received) {
          console.log('  ⚠️  No echo received (expected with current server)');
        }
        ws.close();
        resolve();
      }, 2000);
    });
  });
  
  // Test 3: Canvas Command
  await runTest('Canvas Command Routing', () => {
    return new Promise((resolve) => {
      const ws = new WebSocket('ws://localhost:8787/sync');
      
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'canvas_get_state',
          data: {},
          source: 'diagnostic',
          timestamp: new Date().toISOString()
        }));
        
        console.log('  📤 Sent canvas_get_state command');
        
        setTimeout(() => {
          console.log('  ⚠️  No response (UI might not be connected)');
          ws.close();
          resolve();
        }, 2000);
      });
      
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'canvas_state') {
          console.log('  ✅ Canvas state received');
          testsPassed++;
          ws.close();
          resolve();
        }
      });
    });
  });
  
  // Test 4: Client Count
  await runTest('Connected Clients Check', () => {
    return new Promise((resolve) => {
      const http = require('http');
      
      http.get('http://localhost:8787/health', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const health = JSON.parse(data);
            console.log('  📊 Connected clients:', health.clients);
            if (health.clients > 0) {
              console.log('  ✅ UI client detected');
              testsPassed++;
            } else {
              console.log('  ⚠️  No UI clients connected');
            }
          } catch (e) {
            console.log('  ❌ Invalid health response');
          }
          resolve();
        });
      }).on('error', (err) => {
        console.log('  ❌ Health check failed:', err.message);
        resolve();
      });
    });
  });
  
  // Summary
  console.log('\n' + '='.repeat(40));
  console.log(`\n📊 DIAGNOSTIC SUMMARY`);
  console.log(`   Tests Run: ${testsRun}`);
  console.log(`   Tests Passed: ${testsPassed}/${testsRun}`);
  
  if (testsPassed === testsRun) {
    console.log('\n✅ All systems operational!');
  } else if (testsPassed > 0) {
    console.log('\n⚠️  Some issues detected. Recommendations:');
    console.log('   1. Ensure the browser is open at http://localhost:5173');
    console.log('   2. Do a hard refresh (Ctrl+F5) to reload the code');
    console.log('   3. Check browser console for errors');
    console.log('   4. Verify sync server is running (npm run sync)');
  } else {
    console.log('\n❌ Sync system not working. Check:');
    console.log('   1. Is the sync server running? (npm run sync)');
    console.log('   2. Is port 8787 available?');
    console.log('   3. Any firewall blocking WebSocket connections?');
  }
  
  process.exit(0);
}

diagnose();