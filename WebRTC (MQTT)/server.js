const aedes = require('aedes')();
const http = require('http');
const websocketStream = require('websocket-stream');
const express = require('express');

// Serveur MQTT WebSocket
const httpServer = http.createServer();
const portWs = 8888;

websocketStream.createServer({ server: httpServer }, (stream, request) => {
  aedes.handle(stream, request);
});

aedes.on('client', (client) => {
  console.log(`🔌 Client connected: ${client.id}`);
});

httpServer.listen(portWs, () => {
  console.log(`🌐 MQTT over WebSocket listening on port ${portWs}`);
});

// Serveur Express pour les fichiers statiques (client WebRTC)
const app = express();
const portHttp = 3000;

app.use(express.static('public'));
app.listen(portHttp, () => {
  console.log(`🌍 Web server listening on http://localhost:${portHttp}`);
});