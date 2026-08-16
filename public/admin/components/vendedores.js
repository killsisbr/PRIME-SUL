export async function init() {
    const api = window.api;
    const toast = window.toast;

    async function load() {
        try {
            const sellers = await api('/sellers');
            const list = document.getElementById('sellersList');
            if (!sellers.length) {
                list.innerHTML = '<div class="ps-empty">Nenhum vendedor cadastrado.</div>';
                return;
            }
            list.innerHTML = sellers.map(s => `
                <div class="ps-row ps-row-seller">
                    <div class="ps-avatar">${s.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()}</div>
                    <div class="ps-row-main">
                        <strong>${s.name} ${s.role === 'admin' ? '<span style="font-size:.6rem; background:var(--primary); color:#fff; padding:2px 6px; border-radius:6px; vertical-align:middle;">ADMIN</span>' : ''}</strong>
                        <span class="ps-row-sub">${s.email} • bot ${s.phone}</span>
                    </div>
                    <div class="ps-row-nums">
                        <div><b style="color:var(--primary);">${s.total_leads}</b><span>LEADS</span></div>
                    </div>
                    <span class="ps-pill" style="border-color:${s.active ? '#10b981' : '#c74838'}; background:${s.active ? '#e3faea' : '#ffe5e0'}; color:${s.active ? '#12813b' : '#c74838'};">${s.active ? 'ATIVO' : 'INATIVO'}</span>
                </div>`).join('');
        } catch (e) {
            if (e.status === 403) document.getElementById('sellersList').innerHTML = '<div class="ps-empty" style="color:var(--bad);">Acesso restrito ao admin.</div>';
            else document.getElementById('sellersList').innerHTML = `<div class="ps-empty" style="color:var(--bad);">${e.message}</div>`;
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
            toast('Vendedor criado!');
            load();
        } catch (e) { toast(e.message, 'err'); }
    });

    await load();
    return {};
}

export async function destroy() {
    window.openSellerEditor = undefined;
    window.closeSellerEditor = undefined;
}
