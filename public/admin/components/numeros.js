let _qrInterval = null;
let _activeQrNumber = null;

export async function init() {
    const api = window.api;
    const toast = window.toast;
    const esc = window.escapeHtml || (s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));

    function formatPhone(num) {
        if (!num) return '—';
        const digits = String(num).replace(/\D/g, '');
        if (digits.length === 13 && digits.startsWith('55')) {
            return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
        }
        if (digits.length === 11) {
            return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
        }
        return num;
    }

    async function load() {
        try {
            let numbers = [];
            try {
                const waStatus = await api('/whatsapp/status');
                if (waStatus && Array.isArray(waStatus.numbers)) {
                    numbers = waStatus.numbers;
                }
            } catch (err) {
                // Fallback para rota de campanhas caso /whatsapp/status falhe
                numbers = await api('/campaigns/numbers');
            }

            const list = document.getElementById('numbersList');
            const tag = document.getElementById('numTotalTag');
            if (!list) return;

            let ativos = 0, cooling = 0, banidos = 0, totalMsgs = 0, waConectados = 0;
            if (Array.isArray(numbers)) {
                numbers.forEach(n => {
                    if (n.status === 'ativo') ativos++;
                    else if (n.status === 'resfriado') cooling++;
                    else if (n.status === 'banido') banidos++;

                    if (n.connection === 'connected') waConectados++;
                    totalMsgs += Number(n.messages_sent || 0);
                });
            }

            const kAtivos = document.getElementById('numKpiAtivos');
            const kWa = document.getElementById('numKpiWaConectados');
            const kCooling = document.getElementById('numKpiCooling');
            const kMsgs = document.getElementById('numKpiMsgs');

            if (kAtivos) kAtivos.textContent = ativos;
            if (kWa) kWa.textContent = waConectados;
            if (kCooling) kCooling.textContent = cooling;
            if (kMsgs) kMsgs.textContent = totalMsgs;

            if (tag) tag.textContent = `${numbers.length} ${numbers.length === 1 ? 'CHIP CADASTRADO' : 'CHIPS CADASTRADOS'}`;

            if (!numbers || !numbers.length) {
                list.innerHTML = `
                    <div class="num-empty-state">
                        <i class="fas fa-sim-card"></i>
                        <strong>Nenhum chip cadastrado ainda</strong>
                        <span>Cadastre seu primeiro número acima e conecte o WhatsApp para iniciar os disparos com proteção anti-ban.</span>
                    </div>`;
                return;
            }

            list.innerHTML = numbers.map(n => {
                const isAtivo = n.status === 'ativo';
                const isCooling = n.status === 'resfriado';
                const isBanido = n.status === 'banido';
                const stCls = isAtivo ? 'st-ativo' : isCooling ? 'st-resfriado' : 'st-banido';
                const stLabel = isAtivo ? 'ATIVO' : isCooling ? 'RESFRIANDO' : 'BANIDO';

                const isWaConnected = n.connection === 'connected';
                const isWaConnecting = n.connection === 'connecting' || n.waitingQr;
                const waCls = isWaConnected ? 'wa-connected' : isWaConnecting ? 'wa-connecting' : 'wa-offline';
                const waLabel = isWaConnected ? 'WHATSAPP CONECTADO' : isWaConnecting ? 'AGUARDANDO QR' : 'DESCONECTADO';

                const msgs = Number(n.messages_sent || 0);
                const limit = 40;
                const pct = Math.min(100, Math.round((msgs / limit) * 100));

                return `
                <div class="num-row-card">
                    <div class="num-row-left">
                        <div class="num-chip-badge ${stCls}" title="Chip Anti-ban: ${stLabel}">
                            <i class="fas ${isAtivo ? 'fa-mobile-screen' : isCooling ? 'fa-snowflake' : 'fa-ban'}"></i>
                        </div>
                        <div class="num-row-details">
                            <strong class="num-row-phone">${esc(formatPhone(n.number))}</strong>
                            <div class="num-row-meta">
                                <span class="num-meta-label">${esc(n.label || 'Sem rótulo')}</span>
                                ${n.realNumber && n.realNumber !== n.number ? `<span title="Número real vinculado">${esc(formatPhone(n.realNumber))}</span>` : ''}
                                <span>Cadastrado em ${n.created_at ? esc(n.created_at.slice(0, 10)) : 'Hoje'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="num-row-center">
                        <div class="num-msgs-count"><b>${msgs}</b> de ${limit} msgs hoje</div>
                        <div class="num-bar-bg" title="${pct}% do limite diário atingido">
                            <div class="num-bar-fill" style="width:${pct}%; background:${pct > 80 ? '#ef4444' : pct > 50 ? '#eab308' : '#16a34a'};"></div>
                        </div>
                    </div>

                    <div class="num-row-right">
                        <span class="num-wa-badge ${waCls}" title="Status do WhatsApp neste chip">
                            <i class="${isWaConnected ? 'fab fa-whatsapp' : isWaConnecting ? 'fas fa-spinner fa-spin' : 'fab fa-whatsapp'}"></i>
                            ${waLabel}
                        </span>

                        <span class="num-status-pill ${stCls}" title="Status da proteção Anti-ban">
                            <span class="pill-dot"></span>
                            ${stLabel}
                        </span>

                        <div class="num-row-actions">
                            ${!isWaConnected ? `
                                <button type="button" class="btn-retro num-btn-connect ${isWaConnecting ? 'is-connecting' : ''}" onclick="numOpenQr('${n.number}', '${esc(n.label || '')}')" title="Escanear QR Code para conectar WhatsApp">
                                    <i class="fas fa-qrcode"></i> ${isWaConnecting ? 'VER QR' : 'CONECTAR'}
                                </button>
                            ` : `
                                <button type="button" class="num-act-btn btn-disconnect" onclick="numDisconnectWa('${n.number}')" title="Desconectar WhatsApp deste chip">
                                    <i class="fas fa-plug-circle-xmark"></i>
                                </button>
                            `}

                            ${!isAtivo ? `<button type="button" class="num-act-btn btn-reset" onclick="numReset(${n.id})" title="Reativar chip"><i class="fas fa-rotate-left"></i></button>` : ''}
                            ${isAtivo ? `<button type="button" class="num-act-btn btn-ban" onclick="numBan(${n.id})" title="Marcar como banido / pausar"><i class="fas fa-ban"></i></button>` : ''}
                            <button type="button" class="num-act-btn btn-del" onclick="numDelete(${n.id})" title="Remover chip"><i class="fas fa-trash-can"></i></button>
                        </div>
                    </div>
                </div>`;
            }).join('');

            if (typeof window.loadChipsStatus === 'function') window.loadChipsStatus();
        } catch (e) {
            const list = document.getElementById('numbersList');
            if (list) list.innerHTML = `<div class="num-empty-state" style="color:var(--bad);">${esc(e.message)}</div>`;
        }
    }

    // ================= ADICIONAR CHIP =================
    window.addNumber = async function () {
        const numInput = document.getElementById('numNumber');
        const labelInput = document.getElementById('numLabel');
        const number = numInput.value.trim();
        const label = labelInput.value.trim();

        if (!number) return toast('Informe o número com DDD', 'err');

        try {
            await api('/campaigns/numbers', { method: 'POST', body: JSON.stringify({ number, label }) });
            numInput.value = '';
            labelInput.value = '';
            toast('Chip cadastrado! Conecte o WhatsApp escaneando o QR Code.');
            await load();

            // Abre o modal de QR Code imediatamente para o cliente escanear sem esforço!
            window.numOpenQr(number, label);
        } catch (e) {
            toast(e.message, 'err');
        }
    };

    // ================= QR CODE MODAL FLOW =================
    window.numOpenQr = async function (number, label) {
        _activeQrNumber = number;
        if (_qrInterval) {
            clearInterval(_qrInterval);
            _qrInterval = null;
        }

        const modal = document.getElementById('numQrModal');
        const phoneEl = document.getElementById('numQrPhone');
        const labelEl = document.getElementById('numQrLabel');
        const spinner = document.getElementById('numQrSpinner');
        const img = document.getElementById('numQrImg');
        const success = document.getElementById('numQrSuccess');

        if (!modal) return;

        if (phoneEl) phoneEl.textContent = formatPhone(number);
        if (labelEl) labelEl.textContent = label || 'Chip de Disparo';

        if (spinner) {
            spinner.style.display = 'flex';
            spinner.querySelector('span').textContent = 'Iniciando conexão...';
        }
        if (img) {
            img.style.display = 'none';
            img.src = '';
        }
        if (success) success.style.display = 'none';

        modal.style.display = 'flex';

        // Dispara conexão no servidor
        try {
            await api('/whatsapp/connect', { method: 'POST', body: JSON.stringify({ number, label }) });
            if (spinner) spinner.querySelector('span').textContent = 'Gerando QR Code WhatsApp...';
        } catch (e) {
            console.warn('[numOpenQr] Connect call info:', e.message);
        }

        async function pollQr() {
            if (!_activeQrNumber) return;
            try {
                const res = await api(`/whatsapp/qr?number=${encodeURIComponent(_activeQrNumber)}`);

                if (res.status === 'connected') {
                    if (_qrInterval) {
                        clearInterval(_qrInterval);
                        _qrInterval = null;
                    }
                    if (spinner) spinner.style.display = 'none';
                    if (img) img.style.display = 'none';
                    if (success) success.style.display = 'flex';
                    toast('WhatsApp Conectado com sucesso!', 'ok');

                    setTimeout(() => {
                        window.closeQrModal();
                    }, 1800);
                    return;
                }

                if (res.qr) {
                    if (spinner) spinner.style.display = 'none';
                    if (img) {
                        img.src = res.qr;
                        img.style.display = 'block';
                    }
                }
            } catch (err) {
                console.warn('[pollQr] Polling error:', err.message);
            }
        }

        await pollQr();
        _qrInterval = setInterval(pollQr, 1800);
    };

    window.closeQrModal = function () {
        if (_qrInterval) {
            clearInterval(_qrInterval);
            _qrInterval = null;
        }
        _activeQrNumber = null;
        const modal = document.getElementById('numQrModal');
        if (modal) modal.style.display = 'none';
        load();
    };

    // ================= DESCONECTAR WHATSAPP =================
    window.numDisconnectWa = async function (number) {
        if (!confirm(`Deseja desconectar a sessão do WhatsApp do número ${formatPhone(number)}?`)) return;
        try {
            await api('/whatsapp/disconnect', { method: 'POST', body: JSON.stringify({ number, removeSession: true }) });
            toast('WhatsApp desconectado com sucesso!');
            await load();
        } catch (e) {
            toast(e.message, 'err');
        }
    };

    // ================= CONTROLES ANTI-BAN =================
    window.numReset = async function (id) {
        try {
            const r = await api(`/campaigns/numbers/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'ativo' }) });
            toast(`Chip ${r.number} reativado com sucesso!`);
            await load();
        } catch (e) { toast(e.message, 'err'); }
    };

    window.numBan = async function (id) {
        if (!confirm('Deseja marcar este número como banido? Ele será retirado da rotação de disparos imediatamente.')) return;
        try {
            const r = await api(`/campaigns/numbers/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'banido' }) });
            toast(`Chip ${r.number} retirado da rotação`, 'info');
            await load();
        } catch (e) { toast(e.message, 'err'); }
    };

    window.numDelete = async function (id) {
        if (!confirm('Deseja realmente excluir este chip do sistema?')) return;
        try {
            await api(`/campaigns/numbers/${id}`, { method: 'DELETE' });
            toast('Chip excluído com sucesso!');
            await load();
        } catch (e) { toast(e.message, 'err'); }
    };

    // Evento de clique fora para fechar o modal de QR
    const qrModalOverlay = document.getElementById('numQrModal');
    if (qrModalOverlay) {
        qrModalOverlay.addEventListener('click', (e) => {
            if (e.target === qrModalOverlay) {
                window.closeQrModal();
            }
        });
    }

    await load();
    return {};
}

export async function destroy() {
    if (_qrInterval) {
        clearInterval(_qrInterval);
        _qrInterval = null;
    }
    _activeQrNumber = null;
    window.addNumber = undefined;
    window.numOpenQr = undefined;
    window.closeQrModal = undefined;
    window.numDisconnectWa = undefined;
    window.numReset = undefined;
    window.numBan = undefined;
    window.numDelete = undefined;
}
