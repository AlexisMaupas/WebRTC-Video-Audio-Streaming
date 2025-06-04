const fs = require('fs');
const aedes = require('aedes')();
const http = require('http');
const websocketStream = require('websocket-stream');
const express = require('express');
const cors = require('cors');


// 🌐 Express App
const app = express();
app.use(cors({ origin: '*' }));

// 🧠 Ports
const http_PORT = 3001;     // Use 443 for http
const WS_PORT = 8888;      // WebSocket Secure port

// 🚀 http server for Express
const httpServer = http.createServer(app);

app.get('/', (req, res) => {
  res.send('Hello over http!');
});

httpServer.listen(http_PORT, () => {
  console.log(`🌍 Web server running at http://localhost:${http_PORT}`);
});

// 📡 Secure WebSocket MQTT server
const WSServer = http.createServer();

websocketStream.createServer({ server: WSServer }, (stream, request) => {
  aedes.handle(stream, request);
});

aedes.on('client', (client) => {
  console.log(`🔌 Client connected: ${client.id}`);
});

WSServer.listen(WS_PORT, () => {
  console.log(`🌐 MQTT over WS listening on port ${WS_PORT}`);
});