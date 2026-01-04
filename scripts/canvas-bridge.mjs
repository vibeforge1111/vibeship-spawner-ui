#!/usr/bin/env node
/**
 * Canvas Bridge Server
 *
 * Simple WebSocket server that bridges Claude Code commands to Spawner Canvas.
 * Run with: node scripts/canvas-bridge.mjs
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

const PORT = 8787;
const clients = new Map();

// Create HTTP server to handle /sync path
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
});

const wss = new WebSocketServer({ server, path: '/sync' });

server.listen(PORT, () => {
  console.log(`\n🚀 Canvas Bridge running on ws://localhost:${PORT}/sync`);
  console.log('   Spawner UI will auto-connect when you open the canvas page\n');
});

wss.on('connection', (ws) => {
  const clientId = `client-${Date.now()}`;
  clients.set(clientId, { ws, type: 'unknown' });

  console.log(`✓ Client connected: ${clientId}`);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // Handle identify message
      if (msg.type === 'identify') {
        clients.set(clientId, { ws, type: msg.clientType || 'unknown' });
        console.log(`  → Identified as: ${msg.clientType}`);
        return;
      }

      // Handle ping
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      // Handle broadcast - forward to all other clients
      if (msg.type === 'broadcast') {
        console.log(`📤 Broadcasting: ${msg.event?.type}`);
        const eventMsg = JSON.stringify({ type: 'event', event: msg.event });

        clients.forEach((client, id) => {
          if (id !== clientId && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(eventMsg);
          }
        });
        return;
      }

      console.log(`  Message: ${msg.type}`);
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`✗ Client disconnected: ${clientId}`);
  });
});

// Helper to send canvas commands
function sendCanvasCommand(type, data) {
  const event = {
    type,
    data,
    timestamp: new Date().toISOString(),
    source: 'claude-code'
  };

  const msg = JSON.stringify({ type: 'event', event });

  let sent = 0;
  clients.forEach((client) => {
    if (client.type === 'spawner-ui' && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(msg);
      sent++;
    }
  });

  console.log(`📤 Sent ${type} to ${sent} client(s)`);
  return sent > 0;
}

// Export for programmatic use
export { sendCanvasCommand };

// If running with --add-skills flag, send test skills
if (process.argv.includes('--test')) {
  setTimeout(() => {
    console.log('\n🧪 Sending test skills in 3 seconds...');
    setTimeout(() => {
      sendCanvasCommand('canvas_add_skills', {
        skills: [
          { skillName: 'Next.js App Router' },
          { skillName: 'Supabase Backend' },
          { skillName: 'TailwindCSS' },
          { skillName: 'Authentication' }
        ],
        autoLayout: 'horizontal'
      });
    }, 3000);
  }, 1000);
}

console.log('Waiting for connections...\n');
