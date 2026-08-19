const CONN_LABEL = { connected: 'CONECTADO', connecting: 'CONECTANDO', offline: 'OFFLINE', banned: 'BANIDO' };
const BAN_LABEL = { ativo: 'ATIVO', resfriado: 'RESFRIADO', banido: 'BANIDO' };

const _pollers = new Map();

export async function init() {
    const api = window.api;
    const toast = window.toast;
    const esc = window.escapeHtml;
    let isAdmin = false;
    try { isAdmin = (JSON.parse(localStorage.getItem('prime_sul_user') || '{}').role === 'admin'); } catch (e) { isAdmin = false; }

    let myId = null;
    try { myId = JSON.parse(localStorage.getItem('prime_sul_user') || '{}').id ?? null; } catch (e) { myId = null; }

    const toggleInput = document.getElementById('bt-toggle');
    const toggleWrap = document.getElementById('bt-hero-toggle-wrap');
    if (!isAdmin) {
        toggleInput.disabled = true;
        toggleWrap.classList.add('readonly');
        document.getElementById('bt-toggle-desc').textContent = 'Somente o admin pode pausar as conexões da empresa.';
    }

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
        if (!data.envEnabled) {
            env.className = 'bt-env off';
            env.innerHTML = '<i class="fas fa-circle"></i> DESLIGADO NO AMBIENTE (.ENV)';
        } else if (!data.runtimeEnabled) {
            env.className = 'bt-env paused';
            env.innerHTML = '<i class="fas fa-circle"></i> PAUSADO TEMPORARIAMENTE';
        } else {
            env.className = 'bt-env on';
            env.innerHTML = '<i class="fas fa-circle"></i> BOTS ATIVOS';
        }

        if (document.activeElement !== toggleInput) toggleInput.checked = !!data.runtimeEnabled;
        toggleInput.disabled = !isAdmin || !data.envEnabled;
        if (isAdmin && !data.envEnabled) document.getElementById('bt-toggle-desc').textContent = 'BOT_ENABLED está desligado no .env — ligue lá e reinicie para poder pausar/retomar por aqui.';
        else if (isAdmin) document.getElementById('bt-toggle-desc').textContent = 'Pausar temporariamente todas as conexões da empresa';

        document.getElementById('bt-total').textContent = data.numbers.length;
        document.getElementById('bt-conectados').textContent = Object.values(data.bots).filter(b => b.status === 'connected').length;
        document.getElementById('bt-limite').textContent = data.daily_limit + '/dia';
        document.getElementById('bt-cooldown').textContent = data.cooldown_hours + 'h';

        const grid = document.getElementById('bt-grid');

        // "Meus" slots: para admin, o pool institucional (seller_id nulo); para vendedor, os próprios.
        // Cada organização/vendedor tem direito a `wa_slots_limit` WhatsApp (configurável em Configuração).
        const mine = data.numbers.filter(n => isAdmin ? !n.seller_id : n.seller_id === myId);
        const slotsLimit = data.wa_slots_limit || 2;
        const emptySlots = [];
        for (let i = 1; i <= slotsLimit; i++) {
            if (!mine.some(n => n.slot_index === i)) emptySlots.push(i);
        }

        const slotCards = emptySlots.map(i => `
            <div class="bt-card bt-card-empty">
                <div class="bt-card-head">
                    <div>
                        <span class="bt-num">WhatsApp ${i}</span>
                        <span class="bt-label">slot livre</span>
                    </div>
                    <div class="bt-badges"><span class="bt-badge conn-offline"><i class="fas fa-circle"></i> VAZIO</span></div>
                </div>
                <div class="bt-actions"><button class="bt-action ok" data-act="gerar-slot" data-index="${i}"><i class="fab fa-whatsapp"></i> GERAR QR CODE</button></div>
            </div>`).join('');

        if (!data.numbers.length && !slotCards) {
            grid.innerHTML = '<div class="ps-empty" style="grid-column:1/-1;"><i class="fab fa-whatsapp"></i>Nenhum número cadastrado.</div>';
            return;
        }

        grid.innerHTML = slotCards + data.numbers.map(n => {
            const conn = n.connection;
            const effLimit = n.daily_limit_override || data.daily_limit;
            const pct = effLimit ? Math.min(100, Math.round((n.messages_sent / effLimit) * 100)) : 0;
            const barCls = n.status === 'banido' ? 'danger' : (n.status === 'resfriado' ? 'warn' : '');
            const cooledInfo = n.status === 'resfriado'
                ? (n.cooled_expired ? 'pronto para reativar' : `reativa ${new Date(n.cooled_until).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`)
                : `${n.messages_sent} / ${effLimit} msgs hoje${n.daily_limit_override ? ' (próprio)' : ''}`;

            const actions = [];
            if (conn === 'offline') actions.push(`<button class="bt-action ok" data-act="conectar" data-number="${n.number}"><i class="fas fa-plug"></i> CONECTAR</button>`);
            if (conn === 'connected' || conn === 'connecting') actions.push(`<button class="bt-action warn" data-act="desconectar" data-number="${n.number}"><i class="fas fa-unlink"></i> DESCONECTAR</button>`);
            if (n.status !== 'ativo') actions.push(`<button class="bt-action ok" data-act="reativar" data-id="${n.id}" data-number="${n.number}"><i class="fas fa-rotate-left"></i> REATIVAR</button>`);
            if (n.status !== 'banido') actions.push(`<button class="bt-action danger" data-act="banir" data-id="${n.id}"><i class="fas fa-skull"></i> BANIR</button>`);
            if (conn === 'offline') actions.push(`<button class="bt-action danger" data-act="remover" data-number="${n.number}"><i class="fas fa-trash"></i> REMOVER SESSÃO</button>`);

            const limitEditor = isAdmin ? `
                <div class="bt-limit-edit">
                    <label>Limite próprio</label>
                    <input type="number" min="1" class="bt-input" data-limit-id="${n.id}" placeholder="global (${data.daily_limit})" value="${n.daily_limit_override || ''}">
                    <button type="button" class="bt-action ok" data-act="salvar-limite" data-id="${n.id}"><i class="fas fa-check"></i></button>
                    ${n.daily_limit_override ? `<button type="button" class="bt-action warn" data-act="limpar-limite" data-id="${n.id}" title="Voltar ao global"><i class="fas fa-rotate-left"></i></button>` : ''}
                </div>` : '';

            const isSlot = n.slot_index != null;
            const heading = isSlot ? (n.realNumber ? fmtNum(n.realNumber) : (n.label || `WhatsApp ${n.slot_index}`)) : fmtNum(n.number);
            const subLabel = isSlot ? (n.realNumber ? (n.label || `WhatsApp ${n.slot_index}`) : 'aguardando conexão') : (n.label || 'sem etiqueta');

            return `
            <div class="bt-card" data-number="${n.number}">
                <div class="bt-card-head">
                    <div>
                        <span class="bt-num">${esc(heading)}</span>
                        <span class="bt-label">${esc(subLabel)}</span>
                        ${n.connection === 'connected' && n.realNumber && n.pushName ? `<span class="bt-label" style="display:block;color:var(--ok,#10b981);">${esc(n.pushName)}</span>` : ''}
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
                ${limitEditor}
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
                // Parou de aguardar QR (conectou, ou a sessão morreu por timeout/erro) —
                // sem isso o painel ficava perguntando por QR pra sempre, mesmo depois
                // do backend já ter desistido da sessão.
                if (res.status !== 'connecting') { stopQrPoll(number); refresh(); }
            }
        } catch (e) { stopQrPoll(number); }
    }

    async function refresh() {
        try {
            const data = await api('/whatsapp/status');
            stopPolling();
            render(data);
        } catch (e) {
            document.getElementById('bt-grid').innerHTML = `<div class="ps-empty" style="color:var(--bad); grid-column:1/-1;">${esc(e.message)}</div>`;
        }
    }

    // ações
    document.getElementById('bt-grid').addEventListener('click', async e => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const act = btn.dataset.act;
        btn.disabled = true;
        try {
            if (act === 'gerar-slot') {
                const res = await api(`/whatsapp/slots/${btn.dataset.index}/connect`, { method: 'POST' });
                if (res.status === 'queued') toast(res.message, 'info');
                else toast('Gerando QR... aguarde', 'info');
            } else if (act === 'conectar' || act === 'reativar') {
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
            } else if (act === 'salvar-limite') {
                const input = document.querySelector(`[data-limit-id="${btn.dataset.id}"]`);
                const value = input.value.trim() ? Number(input.value) : null;
                await api(`/whatsapp/numbers/${btn.dataset.id}/limit`, { method: 'PATCH', body: JSON.stringify({ daily_limit_override: value }) });
                toast(value ? `Limite próprio definido: ${value}/dia` : 'Limite próprio removido', 'info');
            } else if (act === 'limpar-limite') {
                await api(`/whatsapp/numbers/${btn.dataset.id}/limit`, { method: 'PATCH', body: JSON.stringify({ daily_limit_override: null }) });
                toast('Voltou a usar o limite global', 'info');
            }
        } catch (err) {
            toast(err.message, 'err');
        } finally {
            btn.disabled = false;
            refresh();
        }
    });

    toggleInput.addEventListener('change', async () => {
        const value = toggleInput.checked;
        toggleInput.disabled = true;
        try {
            await api('/whatsapp/toggle', { method: 'POST', body: JSON.stringify({ enabled: value }) });
            toast(value ? 'Bots retomados' : 'Bots pausados temporariamente', value ? 'ok' : 'info');
        } catch (err) {
            toast(err.message, 'err');
            toggleInput.checked = !value;
        } finally {
            toggleInput.disabled = !isAdmin;
            refresh();
        }
    });

    await refresh();
    return {};
}

export async function destroy() {
    for (const [, id] of _pollers) clearInterval(id);
    _pollers.clear();
}
