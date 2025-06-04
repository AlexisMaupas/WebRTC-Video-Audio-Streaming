const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

let clients = [];

wss.on('connection', (ws) => {
  clients.push(ws);
  console.log('🔌 New client connected');

  ws.on('message', (message) => {
    console.log('📨 Received:', message.toString());

    // Send to other clients
    for (const client of clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  });

  ws.on('close', () => {
    console.log('❌ Client disconnected');
    clients = clients.filter(c => c !== ws);
  });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
