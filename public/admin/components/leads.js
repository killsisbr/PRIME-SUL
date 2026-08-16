const STATUS = {
    novo: { l: 'NOVO', bg: '#e3faea', c: '#12813b' },
    contato: { l: 'EM CONTATO', bg: '#fff5c9', c: '#7c5c10' },
    confirmado: { l: 'CONFIRMADO', bg: '#fff0e3', c: '#b45309' },
    concluido: { l: 'CONCLUÍDO', bg: '#e8e4df', c: '#181716' },
    bloqueado: { l: 'BLOQUEADO', bg: '#ffe5e0', c: '#c74838' },
    duplicado: { l: 'DUPLICADO', bg: '#ffe5e0', c: '#c74838' }
};

export async function init() {
    const api = window.api;
    const toast = window.toast;

    async function load(status = 'TODOS') {
        try {
            const q = status === 'TODOS' ? '' : `?status=${status}`;
            const leads = await api('/leads' + q);
            const grid = document.getElementById('leadsGrid');
            if (!leads.length) {
                grid.innerHTML = '<div class="ps-empty" style="grid-column:1/-1;"><i class="fas fa-inbox"></i>Nenhum lead encontrado.</div>';
                return;
            }
            grid.innerHTML = leads.map(l => {
                const s = STATUS[l.status] || STATUS.novo;
                const ini = l.name.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                return `
                <div class="ps-lead-card">
                    <div>
                        <div class="ps-lead-top">
                            <div class="ps-avatar">${ini}</div>
                            <div style="flex:1; min-width:0;">
                                <strong class="ps-lead-name">${l.name}</strong>
                                <span class="ps-lead-sub">${l.phone} • ${l.city || '—'}</span>
                            </div>
                        </div>
                        <div class="ps-lead-foot">
                            <span class="ps-pill" style="background:${s.bg}; color:${s.c}; border-color:${s.c};">${s.l}</span>
                            <span class="ps-lead-limite">${l.limite_est || 'R$ —'}</span>
                        </div>
                    </div>
                    <div class="ps-lead-actions">
                        <button class="ps-icon-btn start" title="Confirmar" onclick="leadConfirm(${l.id})"><i class="fas fa-check"></i></button>
                        <button class="ps-icon-btn danger" title="Bloquear" onclick="leadBlock(${l.id})"><i class="fas fa-ban"></i></button>
                    </div>
                </div>`;
            }).join('');
        } catch (e) {
            document.getElementById('leadsGrid').innerHTML = `<div class="ps-empty" style="color:var(--bad); grid-column:1/-1;">${e.message}</div>`;
        }
    }

    window.leadConfirm = async (id) => {
        try {
            await api(`/leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'confirmado' }) });
            toast('Lead confirmado');
            load(document.querySelector('.lead-filter.active')?.dataset.status || 'TODOS');
        } catch (e) { toast(e.message, 'err'); }
    };
    window.leadBlock = async (id) => {
        if (!confirm('Bloquear este lead?')) return;
        try {
            await api(`/leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'bloqueado' }) });
            toast('Lead bloqueado', 'info');
            load(document.querySelector('.lead-filter.active')?.dataset.status || 'TODOS');
        } catch (e) { toast(e.message, 'err'); }
    };

    document.querySelectorAll('.lead-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.lead-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            load(btn.dataset.status);
        });
    });

    await load();
    return {};
}

export async function destroy() {
    window.leadConfirm = undefined;
    window.leadBlock = undefined;
}
