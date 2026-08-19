const STATUS = { ativo: { cls: 'novo', bg: '#e3faea', color: '#12813b' }, resfriado: { cls: 'contato', bg: '#fff5c9', color: '#7c5c10' }, banido: { cls: 'bloqueado', bg: '#ffe5e0', color: '#c74838' } };

export async function init() {
    const api = window.api;
    const toast = window.toast;
    const esc = window.escapeHtml;

    async function load() {
        try {
            const numbers = await api('/campaigns/numbers');
            const list = document.getElementById('numbersList');
            if (!numbers.length) {
                list.innerHTML = '<div class="ps-empty"><i class="fas fa-inbox"></i>Nenhum número cadastrado. Adicione o primeiro acima.</div>';
                return;
            }
            list.innerHTML = numbers.map(n => {
                const s = STATUS[n.status] || STATUS.ativo;
                return `
                <div class="ps-row">
                    <div class="ps-row-main">
                        <strong>${esc(n.number)}</strong>
                        <span class="ps-row-sub">${esc(n.label || 'triagem')} • criado ${n.created_at ? esc(n.created_at.slice(0, 10)) : '—'}</span>
                    </div>
                    <div class="ps-row-nums">
                        <div><b style="color:var(--primary);">${n.messages_sent}</b><span>MSGS HOJE</span></div>
                    </div>
                    <span class="ps-pill" style="background:${s.bg}; color:${s.color}; border-color:${s.color};">${n.status.toUpperCase()}</span>
                    <div class="ps-actions">
                        <button class="ps-icon-btn warn" onclick="numReset(${n.id})" title="Reativar"><i class="fas fa-rotate-left"></i></button>
                        <button class="ps-icon-btn danger" onclick="numBan(${n.id})" title="Banir"><i class="fas fa-ban"></i></button>
                    </div>
                </div>`;
            }).join('');
        } catch (e) {
            document.getElementById('numbersList').innerHTML = `<div class="ps-empty" style="color:var(--bad);">${esc(e.message)}</div>`;
        }
    }

    window.addNumber = async function () {
        const number = document.getElementById('numNumber').value.trim();
        const label = document.getElementById('numLabel').value.trim();
        if (!number) return toast('Informe o número', 'err');
        try {
            await api('/campaigns/numbers', { method: 'POST', body: JSON.stringify({ number, label }) });
            document.getElementById('numNumber').value = '';
            document.getElementById('numLabel').value = '';
            toast('Número cadastrado!');
            await load();
        } catch (e) { toast(e.message, 'err'); }
    };

    window.numReset = async function (id) {
        try {
            const r = await api(`/campaigns/numbers/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'ativo' }) });
            toast(`Número ${r.number} reativado`);
            await load();
        } catch (e) { toast(e.message, 'err'); }
    };

    window.numBan = async function (id) {
        if (!confirm('Banir este número? Ele sai de circulação imediatamente.')) return;
        try {
            const r = await api(`/campaigns/numbers/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'banido' }) });
            toast(`Número ${r.number} banido`, 'info');
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
}
