(function () {
    let ws = null;
    let listeners = {};
    let reconnectTimer = null;

    function connect() {
        try {
            const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${location.host}/ws`;

            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                console.log('[realtime] 🟢 Conectado ao motor de eventos ao vivo (WebSocket)');
                if (reconnectTimer) clearTimeout(reconnectTimer);
                emitLocal('connected', {});
            };

            ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data);
                    if (msg.event) {
                        emitLocal(msg.event, msg.data);
                    }
                } catch (err) {}
            };

            ws.onclose = () => {
                console.warn('[realtime] 🟡 Conexão em tempo real suspensa. Reconectando em 3s...');
                if (reconnectTimer) clearTimeout(reconnectTimer);
                reconnectTimer = setTimeout(connect, 3000);
            };

            ws.onerror = () => {
                if (ws) ws.close();
            };
        } catch (e) {
            reconnectTimer = setTimeout(connect, 5000);
        }
    }

    function emitLocal(event, data) {
        if (listeners[event]) {
            listeners[event].forEach(fn => {
                try { fn(data); } catch (e) { console.error('[realtime listener error]', e); }
            });
        }
        if (listeners['*']) {
            listeners['*'].forEach(fn => {
                try { fn(event, data); } catch (e) {}
            });
        }
    }

    window.realtime = {
        on: (event, fn) => {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(fn);
        },
        off: (event, fn) => {
            if (listeners[event]) {
                listeners[event] = listeners[event].filter(cb => cb !== fn);
            }
        }
    };

    connect();
})();
