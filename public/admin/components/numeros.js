const STATUS = { ativo: { cls: 'novo', bg: '#e3faea', color: '#12813b' }, resfriado: { cls: 'contato', bg: '#fff5c9', color: '#7c5c10' }, banido: { cls: 'bloqueado', bg: '#ffe5e0', color: '#c74838' } };

export async function init() {
    const api = window.api;

    async function load() {
        try {
            const numbers = await api('/campaigns/numbers');
            const list = document.getElementById('numbersList');
            if (!numbers.length) {
                list.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted); font-weight:800; border:2px dashed #c4b7ac; border-radius:14px;">Nenhum número cadastrado. Adicione o primeiro acima.</div>';
                return;
            }
            list.innerHTML = numbers.map(n => {
                const s = STATUS[n.status] || STATUS.ativo;
                return `
                <div style="display:grid; grid-template-columns: 1fr auto auto auto; gap:14px; align-items:center; padding:12px 14px; border:3px solid var(--dark); border-radius:13px; background:#fff; box-shadow:3px 3px 0 var(--dark); margin-bottom:10px;">
                    <div>
                        <strong style="font-family:'Bebas Neue',sans-serif; font-size:1.2rem; letter-spacing:0.5px;">${n.number}</strong>
                        <span style="display:block; font-size:0.68rem; font-weight:700; color:var(--text-muted); margin-top:2px;">${n.label || 'descartável'} • criado ${n.created_at ? n.created_at.slice(0, 10) : '—'}</span>
                    </div>
                    <div style="display:grid; grid-template-columns:auto auto; align-items:baseline; gap:8px;">
                        <b style="font-family:'Bebas Neue',sans-serif; font-size:1.3rem; color:var(--primary);">${n.messages_sent}</b>
                        <span style="font-size:0.58rem; font-weight:900; color:var(--text-muted);">MSGS HOJE</span>
                    </div>
                    <span style="padding:5px 10px; border:2px solid; border-radius:999px; font-size:0.6rem; font-weight:900; background:${s.bg}; color:${s.color}; border-color:${s.color};">${n.status.toUpperCase()}</span>
                    <div style="display:flex; gap:6px;">
                        <button class="num-btn" onclick="numReset(${n.id})" title="Reativar"><i class="fas fa-rotate-left"></i></button>
                        <button class="num-btn" onclick="numBan(${n.id})" title="Banir" style="color:var(--danger);"><i class="fas fa-ban"></i></button>
                    </div>
                </div>`;
            }).join('');
        } catch (e) {
            document.getElementById('numbersList').innerHTML = `<div style="color:var(--danger); font-weight:800;">${e.message}</div>`;
        }
    }

    window.addNumber = async function () {
        const number = document.getElementById('numNumber').value.trim();
        const label = document.getElementById('numLabel').value.trim();
        if (!number) return alert('Informe o número');
        try {
            await api('/campaigns/numbers', { method: 'POST', body: JSON.stringify({ number, label }) });
            document.getElementById('numNumber').value = '';
            document.getElementById('numLabel').value = '';
            await load();
        } catch (e) { alert(e.message); }
    };

    window.numReset = async function (id) {
        // reativa via banco — endpoint simples de refresh de status
        await api('/config', { method: 'PUT', body: JSON.stringify({ [`num_reset_${id}`]: String(Date.now()) }) });
        await load();
    };

    window.numBan = function (id) {
        alert('Número banido — removido de circulação. (API pendente)');
    };

    await load();
    return {};
}

export async function destroy() {
    window.addNumber = undefined;
    window.numReset = undefined;
    window.numBan = undefined;
}