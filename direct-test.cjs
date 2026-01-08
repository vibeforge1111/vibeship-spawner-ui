const WebSocket = require('ws');

console.log('Direct WebSocket test...\n');

const ws = new WebSocket('ws://localhost:8787/sync');

ws.on('open', () => {
  console.log('✓ Connected to sync server');
  
  // Send a simple broadcast that should echo to all clients
  const testMessage = {
    type: 'test_echo',
    data: {
      message: 'Can you see this in browser console?',
      timestamp: new Date().toISOString()
    },
    source: 'claude-code-test'
  };
  
  ws.send(JSON.stringify(testMessage));
  console.log('\n📤 Sent test message');
  console.log('\n👀 Check your browser console (F12) for the message');
  console.log('If you see "test_echo" in the browser console, WebSocket is working!\n');
  
  // Listen for any responses
  setTimeout(() => {
    ws.close();
    console.log('Test complete. Check browser console for results.');
  }, 2000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type !== 'connected') {
    console.log('📥 Received:', msg.type);
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err);
});