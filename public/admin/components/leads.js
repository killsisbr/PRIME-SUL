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

    async function load(status = 'TODOS') {
        try {
            const q = status === 'TODOS' ? '' : `?status=${status}`;
            const leads = await api('/leads' + q);
            const grid = document.getElementById('leadsGrid');
            if (!leads.length) {
                grid.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted); font-weight:800; border:2px dashed #c4b7ac; border-radius:14px; grid-column:1/-1;"><i class="fas fa-inbox" style="font-size:1.8rem; display:block; margin-bottom:8px; color:var(--primary);"></i>Nenhum lead encontrado.</div>';
                return;
            }
            grid.innerHTML = leads.map(l => {
                const s = STATUS[l.status] || STATUS.novo;
                const ini = l.name.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                return `
                <div style="display:flex; flex-direction:column; justify-content:space-between; padding:14px; border:3px solid var(--dark); border-radius:16px; background:#fff; box-shadow:5px 5px 0 var(--dark);">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                        <div style="display:grid; place-items:center; width:40px; height:40px; border:2px solid var(--dark); border-radius:10px; background:var(--secondary); font-weight:900; font-size:0.8rem;">${ini}</div>
                        <div style="flex:1; min-width:0;">
                            <strong style="font-family:'Bebas Neue',sans-serif; font-size:1.15rem; letter-spacing:0.5px; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${l.name}</strong>
                            <span style="font-size:0.65rem; font-weight:700; color:var(--text-muted);">${l.phone} • ${l.city || '—'}</span>
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="padding:4px 8px; border:2px solid ${s.c}; border-radius:999px; font-size:0.58rem; font-weight:900; background:${s.bg}; color:${s.c};">${s.l}</span>
                        <span style="font-family:'Bebas Neue',sans-serif; font-size:1.1rem; color:var(--dark);">${l.limite_est || 'R$ —'}</span>
                    </div>
                </div>`;
            }).join('');
        } catch (e) {
            document.getElementById('leadsGrid').innerHTML = `<div style="color:var(--danger); font-weight:800; grid-column:1/-1;">${e.message}</div>`;
        }
    }

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

export async function destroy() {}