const CONN_LABEL = { connected: 'CONECTADO', connecting: 'CONECTANDO', offline: 'OFFLINE', banned: 'BANIDO' };
const BAN_LABEL = { ativo: 'ATIVO', resfriado: 'RESFRIADO', banido: 'BANIDO' };

const _pollers = new Map();

export async function init() {
    const api = window.api;
    const toast = window.toast;

    function fmtNum(n) {
        const s = String(n).replace(/\D/g, '');
        if (s.length < 12) return n;
        return `+${s.slice(0, 2)} (${s.slice(2, 4)}) ${s.slice(4, 9)}-${s.slice(9)}`;
    }

    function stopPolling() {
        for (const [num, id] of _pollers) { clearInterval(id); _pollers.delete(num); }
    }

    function render(data) {
        const env = document.getElementById('bt-env');
        env.className = 'bt-env ' + (data.enabled ? 'on' : 'off');
        env.innerHTML = data.enabled
            ? '<i class="fas fa-circle"></i> BOTS LIGADOS'
            : '<i class="fas fa-circle"></i> BOTS DESLIGADOS (DRY-RUN)';

        document.getElementById('bt-total').textContent = data.numbers.length;
        document.getElementById('bt-conectados').textContent = Object.values(data.bots).filter(b => b.status === 'connected').length;
        document.getElementById('bt-limite').textContent = data.daily_limit + '/dia';
        document.getElementById('bt-cooldown').textContent = data.cooldown_hours + 'h';

        const grid = document.getElementById('bt-grid');
        if (!data.numbers.length) {
            grid.innerHTML = '<div class="ps-empty" style="grid-column:1/-1;"><i class="fab fa-whatsapp"></i>Nenhum número cadastrado.<br>Adicione um número acima para começar.</div>';
            return;
        }

        grid.innerHTML = data.numbers.map(n => {
            const conn = n.connection;
            const pct = data.daily_limit ? Math.min(100, Math.round((n.messages_sent / data.daily_limit) * 100)) : 0;
            const barCls = n.status === 'banido' ? 'danger' : (n.status === 'resfriado' ? 'warn' : '');
            const cooledInfo = n.status === 'resfriado'
                ? (n.cooled_expired ? 'pronto para reativar' : `reativa ${new Date(n.cooled_until).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`)
                : `${n.messages_sent} / ${data.daily_limit} msgs hoje`;

            const actions = [];
            if (conn === 'offline') actions.push(`<button class="bt-action ok" data-act="conectar" data-number="${n.number}"><i class="fas fa-plug"></i> CONECTAR</button>`);
            if (conn === 'connected' || conn === 'connecting') actions.push(`<button class="bt-action warn" data-act="desconectar" data-number="${n.number}"><i class="fas fa-unlink"></i> DESCONECTAR</button>`);
            if (n.status !== 'ativo') actions.push(`<button class="bt-action ok" data-act="reativar" data-id="${n.id}" data-number="${n.number}"><i class="fas fa-rotate-left"></i> REATIVAR</button>`);
            if (n.status !== 'banido') actions.push(`<button class="bt-action danger" data-act="banir" data-id="${n.id}"><i class="fas fa-skull"></i> BANIR</button>`);
            if (conn === 'offline') actions.push(`<button class="bt-action danger" data-act="remover" data-number="${n.number}"><i class="fas fa-trash"></i> REMOVER</button>`);

            return `
            <div class="bt-card" data-number="${n.number}">
                <div class="bt-card-head">
                    <div>
                        <span class="bt-num">${fmtNum(n.number)}</span>
                        <span class="bt-label">${n.label || 'sem etiqueta'}</span>
                    </div>
                    <div class="bt-badges">
                        <span class="bt-badge conn-${conn}"><i class="fas fa-circle"></i> ${CONN_LABEL[conn]}</span>
                        <span class="bt-badge ban-${n.status}">${BAN_LABEL[n.status]}</span>
                    </div>
                </div>
                <div class="bt-progress"><div class="bt-progress-bar ${barCls}" style="width:${pct}%;"></div></div>
                <div class="bt-progress-meta">
                    <span>${cooledInfo}</span>
                    <span>${pct}%</span>
                </div>
                <div class="bt-qr" data-qr-wrap=""></div>
                <div class="bt-actions">${actions.join('')}</div>
            </div>`;
        }).join('');

        // Inicia polling de QR para números aguardando scan
        for (const n of data.numbers) {
            if (n.waitingQr && n.connection === 'connecting') startQrPoll(n.number);
            else stopQrPoll(n.number);
        }
    }

    function startQrPoll(number) {
        if (_pollers.has(number)) return;
        pollQr(number);
        const id = setInterval(() => pollQr(number), 2500);
        _pollers.set(number, id);
    }

    function stopQrPoll(number) {
        const id = _pollers.get(number);
        if (id) { clearInterval(id); _pollers.delete(number); }
    }

    async function pollQr(number) {
        try {
            const wrap = document.querySelector(`.bt-card[data-number="${number}"] [data-qr-wrap]`);
            if (!wrap) { stopQrPoll(number); return; }
            const res = await api(`/whatsapp/qr?number=${encodeURIComponent(number)}`);
            if (res.qr) {
                wrap.classList.add('show');
                wrap.innerHTML = `<img src="${res.qr}" alt="QR"><span><i class="fab fa-whatsapp"></i> Escaneie com o WhatsApp</span>`;
            } else {
                wrap.classList.remove('show');
                wrap.innerHTML = '';
                if (res.status === 'connected') { stopQrPoll(number); refresh(); }
            }
        } catch (e) { stopQrPoll(number); }
    }

    async function refresh() {
        try {
            const data = await api('/whatsapp/status');
            stopPolling();
            render(data);
        } catch (e) {
            document.getElementById('bt-grid').innerHTML = `<div class="ps-empty" style="color:var(--bad); grid-column:1/-1;">${e.message}</div>`;
        }
    }

    // ações
    document.getElementById('bt-grid').addEventListener('click', async e => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const act = btn.dataset.act;
        btn.disabled = true;
        try {
            if (act === 'conectar' || act === 'reativar') {
                if (act === 'reativar') {
                    await api(`/campaigns/numbers/${btn.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'ativo' }) });
                    toast('Número reativado', 'info');
                }
                const res = await api('/whatsapp/connect', { method: 'POST', body: JSON.stringify({ number: btn.dataset.number }) });
                if (res.status === 'queued') toast(res.message, 'info');
                else toast('Conectando... aguarde o QR', 'info');
            } else if (act === 'desconectar') {
                await api('/whatsapp/disconnect', { method: 'POST', body: JSON.stringify({ number: btn.dataset.number }) });
                toast('Desconectado', 'info');
            } else if (act === 'banir') {
                if (!confirm('Banir este número? Ele sai de circulação permanentemente.')) { btn.disabled = false; return; }
                await api(`/campaigns/numbers/${btn.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'banido' }) });
                toast('Número banido', 'err');
            } else if (act === 'remover') {
                if (!confirm('Remover sessão deste número? O WhatsApp será deslogado.')) { btn.disabled = false; return; }
                await api('/whatsapp/disconnect', { method: 'POST', body: JSON.stringify({ number: btn.dataset.number, removeSession: true }) });
                toast('Sessão removida', 'info');
            }
        } catch (err) {
            toast(err.message, 'err');
        } finally {
            btn.disabled = false;
            refresh();
        }
    });

    // novo número
    document.getElementById('bt-add-btn').onclick = async () => {
        const number = document.getElementById('bt-num').value.trim().replace(/\D/g, '');
        const label = document.getElementById('bt-label').value.trim();
        if (!number) { toast('Informe o número', 'err'); return; }
        document.getElementById('bt-add-btn').disabled = true;
        try {
            const res = await api('/whatsapp/connect', { method: 'POST', body: JSON.stringify({ number, label }) });
            if (res.status === 'queued') toast(res.message, 'info');
            else toast('Bot adicionado! Conectando...', 'info');
            document.getElementById('bt-num').value = '';
            document.getElementById('bt-label').value = '';
            refresh();
        } catch (err) {
            toast(err.message, 'err');
        } finally {
            document.getElementById('bt-add-btn').disabled = false;
        }
    };

    await refresh();
    return {};
}

export async function destroy() {
    for (const [, id] of _pollers) clearInterval(id);
    _pollers.clear();
}
