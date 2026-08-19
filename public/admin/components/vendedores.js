export async function init() {
    const api = window.api;
    const toast = window.toast;
    const esc = window.escapeHtml;

    async function load() {
        try {
            // with-stats traz o relatório real: funil de leads, envios, taxa de
            // resposta/conversão e números WhatsApp ativos de cada vendedor.
            const sellers = await api('/sellers/with-stats');
            const list = document.getElementById('sellersList');
            if (!sellers.length) {
                list.innerHTML = '<div class="ps-empty">Nenhum vendedor cadastrado.</div>';
                return;
            }
            list.innerHTML = sellers.map(s => `
                <div class="ps-row ps-row-seller">
                    <div class="ps-avatar">${esc(s.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase())}</div>
                    <div class="ps-row-main">
                        <strong>${esc(s.name)}</strong>
                        <span class="ps-row-sub">${esc(s.email)} • bot ${esc(s.phone)} • ${s.active_numbers} número(s) ativo(s)</span>
                    </div>
                    <div class="ps-row-nums">
                        <div><b style="color:var(--primary);">${s.total_leads}</b><span>LEADS</span></div>
                        <div><b>${s.total_sends}</b><span>ENVIOS</span></div>
                        <div><b style="color:${s.response_rate >= 30 ? '#12813b' : 'inherit'};">${s.response_rate}%</b><span>RESPOSTA</span></div>
                        <div><b style="color:${s.conversion_rate >= 10 ? '#12813b' : 'inherit'};">${s.conversion_rate}%</b><span>CONVERSÃO</span></div>
                    </div>
                    <span class="ps-pill" style="border-color:${s.active ? '#10b981' : '#c74838'}; background:${s.active ? '#e3faea' : '#ffe5e0'}; color:${s.active ? '#12813b' : '#c74838'};">${s.active ? 'ATIVO' : 'INATIVO'}</span>
                    <button type="button" class="ps-btn secondary" data-seller-numbers="${s.id}" data-seller-name="${esc(s.name)}"><i class="fas fa-phone"></i> NÚMEROS</button>
                </div>`).join('');
        } catch (e) {
            if (e.status === 403) document.getElementById('sellersList').innerHTML = '<div class="ps-empty" style="color:var(--bad);">Acesso restrito ao admin.</div>';
            else document.getElementById('sellersList').innerHTML = `<div class="ps-empty" style="color:var(--bad);">${esc(e.message)}</div>`;
        }
    }

    // ================= NÚMEROS DO VENDEDOR (modal, sem prompt/confirm) =================
    let currentSellerId = null;

    function numberRowHtml(n) {
        return `
        <div class="snm-row">
            <span class="snm-dot ${n.active ? 'on' : 'off'}"></span>
            <div class="snm-main">
                <strong>${esc(n.number)}</strong>
                <span>${esc(n.label || 'operacional')}</span>
            </div>
            <div class="snm-actions">
                ${n.active
                    ? `<button type="button" class="ps-btn secondary" data-connect="${n.id}"><i class="fas fa-qrcode"></i> CONECTAR</button>
                       <button type="button" class="ps-icon-btn danger" data-deactivate="${n.id}" title="Desativar"><i class="fas fa-ban"></i></button>`
                    : `<button type="button" class="ps-btn secondary" data-activate="${n.id}"><i class="fas fa-rotate-left"></i> REATIVAR</button>`}
            </div>
        </div>`;
    }

    async function loadSellerNumbers() {
        const box = document.getElementById('snm-list');
        box.innerHTML = '<div class="ps-loading"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
        try {
            const numbers = await api(`/sellers/${currentSellerId}/numbers`);
            box.innerHTML = numbers.length
                ? numbers.map(numberRowHtml).join('')
                : '<div class="ps-empty">Nenhum número cadastrado ainda.</div>';
        } catch (e) {
            box.innerHTML = `<div class="ps-empty" style="color:var(--bad);">${esc(e.message)}</div>`;
        }
    }

    function openSellerNumbers(sellerId, sellerName) {
        currentSellerId = sellerId;
        document.getElementById('snm-seller-name').textContent = sellerName || '—';
        document.getElementById('snm-new-number').value = '';
        document.getElementById('snm-new-label').value = '';
        document.getElementById('sellerNumbersModal').style.display = 'flex';
        loadSellerNumbers();
    }

    document.getElementById('sellersList').addEventListener('click', e => {
        const btn = e.target.closest('[data-seller-numbers]');
        if (!btn) return;
        openSellerNumbers(Number(btn.dataset.sellerNumbers), btn.dataset.sellerName);
    });

    document.getElementById('snm-close').onclick = () => document.getElementById('sellerNumbersModal').style.display = 'none';
    document.getElementById('sellerNumbersModal').addEventListener('click', e => { if (e.target.id === 'sellerNumbersModal') e.target.style.display = 'none'; });

    document.getElementById('snm-add-form').addEventListener('submit', async e => {
        e.preventDefault();
        const number = document.getElementById('snm-new-number').value.trim();
        if (!number) return;
        try {
            await api(`/sellers/${currentSellerId}/numbers`, { method: 'POST', body: JSON.stringify({ number, label: document.getElementById('snm-new-label').value.trim() || 'operacional' }) });
            toast('Número cadastrado!');
            document.getElementById('snm-add-form').reset();
            loadSellerNumbers();
        } catch (err) { toast(err.message, 'err'); }
    });

    document.getElementById('snm-list').addEventListener('click', async e => {
        const connectBtn = e.target.closest('[data-connect]');
        const deactivateBtn = e.target.closest('[data-deactivate]');
        const activateBtn = e.target.closest('[data-activate]');
        try {
            if (connectBtn) return connectNumber(Number(connectBtn.dataset.connect));
            if (deactivateBtn) {
                await api(`/sellers/${currentSellerId}/numbers/${Number(deactivateBtn.dataset.deactivate)}`, { method: 'PATCH', body: JSON.stringify({ active: false }) });
                toast('Número desativado');
                loadSellerNumbers();
            }
            if (activateBtn) {
                await api(`/sellers/${currentSellerId}/numbers/${Number(activateBtn.dataset.activate)}`, { method: 'PATCH', body: JSON.stringify({ active: true }) });
                toast('Número reativado');
                loadSellerNumbers();
            }
        } catch (err) { toast(err.message, 'err'); }
    });

    // ================= QR DE CONEXÃO (modal, sem overlay ad-hoc) =================
    function setQrBody(html) { document.getElementById('snq-body').innerHTML = html; }

    async function connectNumber(id) {
        document.getElementById('sellerQrModal').style.display = 'flex';
        setQrBody('<div class="ps-loading"><i class="fas fa-spinner fa-spin"></i> Conectando...</div>');
        try {
            const started = await api(`/sellers/connections/${id}/connect`, { method: 'POST' });
            if (started.status === 'queued') {
                setQrBody('<div class="ps-empty">Bots estão desativados no ambiente.</div>');
                return;
            }
            for (let i = 0; i < 20; i++) {
                await new Promise(r => setTimeout(r, 1500));
                if (document.getElementById('sellerQrModal').style.display === 'none') return; // usuário fechou
                const state = await api(`/sellers/connections/${id}/qr`);
                if (state.status === 'connected') {
                    setQrBody('<div class="ps-empty"><i class="fas fa-circle-check" style="color:var(--ok);"></i> Número conectado!</div>');
                    toast('Número conectado!');
                    loadSellerNumbers();
                    return;
                }
                if (state.qr) {
                    setQrBody(`<img src="${state.qr}" alt="QR WhatsApp" style="max-width:100%;border:3px solid var(--dark);border-radius:12px;"><p class="ps-hint" style="margin-top:10px;">Escaneie no WhatsApp do vendedor.</p>`);
                }
            }
            setQrBody('<div class="ps-empty" style="color:var(--bad);">QR não ficou disponível a tempo. Feche e tente conectar de novo.</div>');
        } catch (err) {
            setQrBody(`<div class="ps-empty" style="color:var(--bad);">${esc(err.message)}</div>`);
        }
    }

    document.getElementById('snq-close').onclick = () => document.getElementById('sellerQrModal').style.display = 'none';
    document.getElementById('sellerQrModal').addEventListener('click', e => { if (e.target.id === 'sellerQrModal') e.target.style.display = 'none'; });

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
