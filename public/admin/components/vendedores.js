export async function init() {
    const api = window.api;

    async function load() {
        try {
            const sellers = await api('/sellers');
            const list = document.getElementById('sellersList');
            if (!sellers.length) {
                list.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted); font-weight:800;">Nenhum vendedor cadastrado.</div>';
                return;
            }
            list.innerHTML = sellers.map(s => `
                <div style="display:grid; grid-template-columns: auto 1fr auto auto; gap:14px; align-items:center; padding:14px; border:3px solid var(--dark); border-radius:13px; background:#fff; box-shadow:4px 4px 0 var(--dark); margin-bottom:12px;">
                    <div style="display:grid; place-items:center; width:46px; height:46px; border:2px solid var(--dark); border-radius:12px; background:#8b5cf6; color:#fff; font-weight:900;">${s.name.split(' ').map(p => p[0]).slice(0,2).join('').toUpperCase()}</div>
                    <div>
                        <strong style="font-family:'Bebas Neue',sans-serif; font-size:1.3rem; letter-spacing:0.5px;">${s.name} ${s.role === 'admin' ? '<span style="font-size:0.6rem; background:var(--primary); color:#fff; padding:2px 6px; border-radius:6px; vertical-align:middle;">ADMIN</span>' : ''}</strong>
                        <span style="display:block; font-size:0.68rem; font-weight:700; color:var(--text-muted); margin-top:2px;">${s.email} • bot ${s.phone}</span>
                    </div>
                    <div style="text-align:center;">
                        <b style="font-family:'Bebas Neue',sans-serif; font-size:1.4rem; color:var(--primary);">${s.total_leads}</b>
                        <span style="display:block; font-size:0.58rem; font-weight:900; color:var(--text-muted);">LEADS</span>
                    </div>
                    <span style="padding:5px 10px; border:2px solid ${s.active ? '#10b981' : '#c74838'}; border-radius:999px; font-size:0.6rem; font-weight:900; background:${s.active ? '#e3faea' : '#ffe5e0'}; color:${s.active ? '#12813b' : '#c74838'};">${s.active ? 'ATIVO' : 'INATIVO'}</span>
                </div>`).join('');
        } catch (e) {
            if (e.status === 403) document.getElementById('sellersList').innerHTML = '<div style="color:var(--danger); font-weight:800;">Acesso restrito ao admin.</div>';
            else document.getElementById('sellersList').innerHTML = `<div style="color:var(--danger); font-weight:800;">${e.message}</div>`;
        }
    }

    window.openSellerEditor = () => document.getElementById('sellerEditorModal').style.display = 'flex';
    window.closeSellerEditor = () => document.getElementById('sellerEditorModal').style.display = 'none';

    document.getElementById('sellerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await api('/sellers', {
                method: 'POST',
                body: JSON.stringify({
                    name: document.getElementById('sName').value.trim(),
                    email: document.getElementById('sEmail').value.trim(),
                    password: document.getElementById('sPass').value,
                    phone: document.getElementById('sPhone').value.trim(),
                    max_leads: Number(document.getElementById('sMaxLeads').value) || 0
                })
            });
            window.closeSellerEditor();
            document.getElementById('sellerForm').reset();
            load();
        } catch (e) { alert(e.message); }
    });

    await load();
    return {};
}

export async function destroy() {
    window.openSellerEditor = undefined;
    window.closeSellerEditor = undefined;
}