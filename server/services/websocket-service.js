const WebSocket = require('ws');

let wss = null;

function init(server) {
    wss = new WebSocket.Server({ server, path: '/ws' });

    wss.on('connection', (ws) => {
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        ws.on('message', (msg) => {
            try {
                const data = JSON.parse(msg);
                if (data.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong' }));
                }
            } catch (e) {}
        });

        // Envia confirmação de boas-vindas
        ws.send(JSON.stringify({ event: 'connected', data: { status: 'online', time: new Date().toISOString() } }));
    });

    const interval = setInterval(() => {
        if (!wss) return;
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => clearInterval(interval));
    console.log('[websocket] Servidor de eventos em tempo real rodando na rota /ws');
}

function broadcast(event, data = {}) {
    if (!wss) return;
    const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

module.exports = { init, broadcast };
