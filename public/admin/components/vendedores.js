export async function init() {
    const api = window.api;
    const toast = window.toast;
    const esc = window.escapeHtml;

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
                    <div class="ps-avatar">${esc(s.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase())}</div>
                    <div class="ps-row-main">
                        <strong>${esc(s.name)} ${s.role === 'admin' ? '<span style="font-size:.6rem; background:var(--primary); color:#fff; padding:2px 6px; border-radius:6px; vertical-align:middle;">ADMIN</span>' : ''}</strong>
                        <span class="ps-row-sub">${esc(s.email)} • bot ${esc(s.phone)}</span>
                    </div>
                    <div class="ps-row-nums">
                        <div><b style="color:var(--primary);">${s.total_leads}</b><span>LEADS</span></div>
                    </div>
                    <span class="ps-pill" style="border-color:${s.active ? '#10b981' : '#c74838'}; background:${s.active ? '#e3faea' : '#ffe5e0'}; color:${s.active ? '#12813b' : '#c74838'};">${s.active ? 'ATIVO' : 'INATIVO'}</span>
                    <button type="button" class="ps-btn secondary" data-seller-numbers="${s.id}"><i class="fas fa-phone"></i> NÚMEROS</button>
                </div>`).join('');
        } catch (e) {
            if (e.status === 403) document.getElementById('sellersList').innerHTML = '<div class="ps-empty" style="color:var(--bad);">Acesso restrito ao admin.</div>';
            else document.getElementById('sellersList').innerHTML = `<div class="ps-empty" style="color:var(--bad);">${esc(e.message)}</div>`;
        }
    }

    document.getElementById('sellersList').addEventListener('click', async e => {
        const btn = e.target.closest('[data-seller-numbers]');
        if (!btn) return;
        const sellerId = Number(btn.dataset.sellerNumbers);
        try {
            const current = await api(`/sellers/${sellerId}/numbers`);
            const summary = current.length ? current.map(n => `#${n.id} ${n.active ? '✓' : '×'} ${n.number} — ${n.label || 'operacional'}`).join('\n') : 'Nenhum número cadastrado.';
            const action = prompt(`Números atuais:\n${summary}\n\nUse: NOVO 5511... | CONECTAR ID | DESATIVAR ID`);
            if (!action) return;
            const [command, value] = action.trim().split(/\s+/, 2);
            if (command.toUpperCase() === 'NOVO') {
                const created = await api(`/sellers/${sellerId}/numbers`, { method: 'POST', body: JSON.stringify({ number: value, label: 'operacional' }) });
                toast('Número do vendedor cadastrado!');
                if (confirm('Deseja conectar e gerar o QR agora?')) await connectNumber(created.id);
            } else if (command.toUpperCase() === 'CONECTAR') {
                await connectNumber(Number(value));
            } else if (command.toUpperCase() === 'DESATIVAR') {
                await api(`/sellers/${sellerId}/numbers/${Number(value)}`, { method: 'PATCH', body: JSON.stringify({ active: false }) });
                toast('Número desativado');
            } else toast('Comando inválido', 'err');
        } catch (err) { toast(err.message, 'err'); }
    });

    async function connectNumber(id) {
        const started = await api(`/sellers/connections/${id}/connect`, { method: 'POST' });
        if (started.status === 'queued') return toast('Bots estão desativados no ambiente', 'info');
        toast('Conectando; aguardando QR...', 'info');
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 1500));
            const state = await api(`/sellers/connections/${id}/qr`);
            if (state.status === 'connected') return toast('Número conectado!');
            if (state.qr) {
                const overlay = document.createElement('div');
                overlay.style.cssText = 'position:fixed;inset:0;z-index:20000;background:#0009;display:grid;place-items:center';
                const box = document.createElement('div'); box.style.cssText = 'background:#fff;padding:20px;border:4px solid #181716;border-radius:14px;text-align:center';
                const img = document.createElement('img'); img.src = state.qr; img.alt = 'QR WhatsApp';
                const text = document.createElement('p'); text.textContent = 'Escaneie o QR no WhatsApp. Clique fora para fechar.';
                box.append(img, text); overlay.append(box); overlay.onclick = () => overlay.remove(); document.body.append(overlay);
                return;
            }
        }
        toast('QR ainda não disponível; tente CONECTAR novamente', 'err');
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
