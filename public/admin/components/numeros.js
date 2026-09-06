const STATUS = {
    ativo: { cls: 'st-ativo', label: 'ATIVO' },
    resfriado: { cls: 'st-resfriado', label: 'RESFRIANDO' },
    banido: { cls: 'st-banido', label: 'BANIDO' }
};

export async function init() {
    const api = window.api;
    const toast = window.toast;
    const esc = window.escapeHtml;

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
            const numbers = await api('/campaigns/numbers');
            const list = document.getElementById('numbersList');
            const tag = document.getElementById('numTotalTag');

            let ativos = 0, cooling = 0, banidos = 0, totalMsgs = 0;
            if (Array.isArray(numbers)) {
                numbers.forEach(n => {
                    if (n.status === 'ativo') ativos++;
                    else if (n.status === 'resfriado') cooling++;
                    else if (n.status === 'banido') banidos++;
                    totalMsgs += Number(n.messages_sent || 0);
                });
            }

            const kAtivos = document.getElementById('numKpiAtivos');
            const kCooling = document.getElementById('numKpiCooling');
            const kBanidos = document.getElementById('numKpiBanidos');
            const kMsgs = document.getElementById('numKpiMsgs');
            if (kAtivos) kAtivos.textContent = ativos;
            if (kCooling) kCooling.textContent = cooling;
            if (kBanidos) kBanidos.textContent = banidos;
            if (kMsgs) kMsgs.textContent = totalMsgs;

            if (tag) tag.textContent = `${numbers.length} ${numbers.length === 1 ? 'CHIP CADASTRADO' : 'CHIPS CADASTRADOS'}`;

            if (!numbers || !numbers.length) {
                list.innerHTML = `
                    <div class="num-empty-state">
                        <i class="fas fa-sim-card"></i>
                        <strong>Nenhum chip cadastrado ainda</strong>
                        <span>Cadastre seu primeiro número acima para iniciar os disparos com proteção anti-ban.</span>
                    </div>`;
                return;
            }

            list.innerHTML = numbers.map(n => {
                const isAtivo = n.status === 'ativo';
                const isCooling = n.status === 'resfriado';
                const isBanido = n.status === 'banido';
                const stCls = isAtivo ? 'st-ativo' : isCooling ? 'st-resfriado' : 'st-banido';
                const stLabel = isAtivo ? 'ATIVO' : isCooling ? 'RESFRIANDO' : 'BANIDO';
                const msgs = Number(n.messages_sent || 0);
                const limit = 40;
                const pct = Math.min(100, Math.round((msgs / limit) * 100));

                return `
                <div class="num-row-card">
                    <div class="num-row-left">
                        <div class="num-chip-badge ${stCls}" title="Status: ${stLabel}">
                            <i class="fas ${isAtivo ? 'fa-mobile-screen' : isCooling ? 'fa-snowflake' : 'fa-ban'}"></i>
                        </div>
                        <div class="num-row-details">
                            <strong class="num-row-phone">${esc(formatPhone(n.number))}</strong>
                            <div class="num-row-meta">
                                <span class="num-meta-label">${esc(n.label || 'Sem rótulo')}</span>
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
                        <span class="num-status-pill ${stCls}">
                            <span class="pill-dot"></span>
                            ${stLabel}
                        </span>
                        <div class="num-row-actions">
                            ${!isAtivo ? `<button type="button" class="num-act-btn btn-reset" onclick="numReset(${n.id})" title="Reativar chip"><i class="fas fa-rotate-left"></i></button>` : ''}
                            ${isAtivo ? `<button type="button" class="num-act-btn btn-ban" onclick="numBan(${n.id})" title="Marcar como banido / pausar"><i class="fas fa-ban"></i></button>` : ''}
                            <button type="button" class="num-act-btn btn-del" onclick="numDelete(${n.id})" title="Remover chip"><i class="fas fa-trash-can"></i></button>
                        </div>
                    </div>
                </div>`;
            }).join('');

            if (typeof window.loadChipsStatus === 'function') window.loadChipsStatus();
        } catch (e) {
            document.getElementById('numbersList').innerHTML = `<div class="num-empty-state" style="color:var(--bad);">${esc(e.message)}</div>`;
        }
    }

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
            toast('Chip cadastrado com sucesso!');
            await load();
        } catch (e) { toast(e.message, 'err'); }
    };

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

    await load();
    return {};
}

export async function destroy() {
    window.addNumber = undefined;
    window.numReset = undefined;
    window.numBan = undefined;
    window.numDelete = undefined;
}
