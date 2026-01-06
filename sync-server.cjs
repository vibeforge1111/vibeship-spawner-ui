/**
 * Local Sync Server for Spawner UI
 * Enables real-time sync between Claude Code and Spawner UI
 */

const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const PORT = 8787;

// Middleware
app.use(cors());
app.use(express.json());

// Store connected clients
const clients = new Set();

// Create WebSocket server
const server = app.listen(PORT, () => {
  console.log(`[Sync Server] Running on http://localhost:${PORT}`);
  console.log(`[Sync Server] WebSocket endpoint: ws://localhost:${PORT}/sync`);
});

const wss = new WebSocket.Server({ 
  server,
  path: '/sync'
});

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  console.log('[Sync Server] New WebSocket connection');
  clients.add(ws);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to Spawner Sync Server',
    timestamp: new Date().toISOString()
  }));

  // Handle messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('[Sync Server] Received:', data.type, 'from', data.source || 'unknown');

      // Broadcast to all other clients
      for (const client of clients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(message.toString());
        }
      }

      // Handle specific message types
      if (data.type === 'identify') {
        console.log('[Sync Server] Client identified:', data.clientType, data.clientId);
      }
    } catch (error) {
      console.error('[Sync Server] Error handling message:', error);
    }
  });

  // Handle disconnect
  ws.on('close', () => {
    console.log('[Sync Server] Client disconnected');
    clients.delete(ws);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('[Sync Server] WebSocket error:', error);
    clients.delete(ws);
  });

  // Heartbeat
  ws.on('pong', () => {
    ws.isAlive = true;
  });
});

// Heartbeat interval
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('[Sync Server] Terminating inactive connection');
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// HTTP endpoints for fallback
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    clients: clients.size,
    timestamp: new Date().toISOString() 
  });
});

app.post('/sync', (req, res) => {
  const event = req.body;
  console.log('[Sync Server] HTTP event:', event.type);

  // Broadcast to all WebSocket clients
  const message = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }

  res.json({ success: true, broadcast: clients.size });
});

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('\n[Sync Server] Shutting down...');
  
  // Close all connections
  for (const client of clients) {
    client.close();
  }
  
  server.close(() => {
    console.log('[Sync Server] Closed');
    process.exit(0);
  });
});

console.log('[Sync Server] Ready for connections');
console.log('[Sync Server] Spawner UI will auto-connect when canvas page loads');