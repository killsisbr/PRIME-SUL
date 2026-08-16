export async function init({ container }) {
    const api = window.api;

    async function loadStats() {
        try {
            const [counts, wa] = await Promise.all([api('/leads/counts'), api('/whatsapp/status')]);
            set('#hub-stat-leads', counts.leads);
            set('#hub-stat-conf', counts.confirmados);
            const campaigns = await api('/campaigns');
            set('#hub-stat-camp', campaigns.length);
            const active = campaigns.filter(c => c.status === 'running').length;
            set('#hub-manager-active-count', active);
            set('#hub-manager-total-count', campaigns.length);
            set('#hub-manager-sent-count', campaigns.reduce((a, c) => a + c.total_sent, 0));
            set('#hub-manager-confirm-sum', campaigns.reduce((a, c) => a + c.total_yes, 0));
            set('#hub-campaign-summary', campaigns.length ? `${campaigns.length} campanha(s) ativa(s) para ${counts.leads} leads.` : 'Nenhuma campanha criada ainda.');
            const numbers = await api('/campaigns/numbers');
            set('#hub-stat-num', numbers.length);
            renderCampaigns(campaigns);
            loadNumbers();
        } catch (e) {
            console.error(e);
            set('#hub-campaign-summary', 'Erro ao carregar.');
        }
    }

    async function loadNumbers() {
        try {
            const numbers = await api('/campaigns/numbers');
            const sel = document.getElementById('hc-number');
            sel.innerHTML = numbers.filter(n => n.status === 'ativo').map(n =>
                `<option value="${n.id}">${n.number} (${n.messages_sent} enviadas)</option>`).join('')
                || '<option value="">Nenhum número ativo — cadastre em Números Anti-Ban</option>';
        } catch (e) { console.error(e); }
    }

    function renderCampaigns(campaigns) {
        const list = document.getElementById('inline-campaign-list');
        if (!campaigns.length) {
            list.innerHTML = '<div class="hub-empty"><i class="fas fa-inbox"></i> Nenhuma campanha criada.</div>';
            return;
        }
        list.innerHTML = campaigns.map(c => `
            <div class="hub-campaign-row" data-id="${c.id}">
                <span class="hub-campaign-code">${c.name}</span>
                <div class="hub-campaign-detail">
                    <strong>${c.total_target} alvos • ${c.total_sent} enviados • ${c.total_yes} confirmados</strong>
                    <span>${c.message ? c.message.slice(0, 80) : 'Mensagem padrão do bot'}${c.message && c.message.length > 80 ? '…' : ''}</span>
                </div>
                <span class="hub-campaign-status ${c.status}">${c.status.toUpperCase()}</span>
                <div class="hub-campaign-actions">
                    <button type="button" class="hub-icon-btn start" title="Iniciar" onclick="hubStartCampaign(${c.id})"><i class="fas fa-play"></i></button>
                    <button type="button" class="hub-icon-btn toggle" title="Pausar" onclick="hubPauseCampaign(${c.id})"><i class="fas fa-pause"></i></button>
                </div>
            </div>`).join('');
    }

    async function hubStartCampaign(id) {
        try { const r = await api(`/campaigns/${id}/start`, { method: 'POST' }); alert(r.message || 'Campanha iniciada!'); loadStats(); }
        catch (e) { alert(e.message); }
    }
    async function hubPauseCampaign(id) {
        try { await api(`/campaigns/${id}/pause`, { method: 'POST' }); loadStats(); }
        catch (e) { alert(e.message); }
    }
    window.hubStartCampaign = hubStartCampaign;
    window.hubPauseCampaign = hubPauseCampaign;

    function set(id, v) { const el = document.querySelector(id); if (el) el.textContent = v; }

    // Abrir/fechar submodais
    const openModal = (id) => document.getElementById(id).style.display = 'flex';
    const closeModal = (id) => document.getElementById(id).style.display = 'none';

    document.getElementById('btn-hub-campaigns-card').onclick = () => openModal('hub-campaigns-modal');
    document.getElementById('btn-hub-campaigns').onclick = () => openModal('hub-campaigns-modal');
    document.getElementById('btn-hub-create-campaign').onclick = () => { openModal('hub-campaign-editor-modal'); loadNumbers(); };
    document.getElementById('btn-close-hub-campaigns').onclick = () => closeModal('hub-campaigns-modal');
    document.getElementById('btn-close-hub-campaigns-footer').onclick = () => closeModal('hub-campaigns-modal');
    document.getElementById('btn-close-campaign-editor').onclick = () => closeModal('hub-campaign-editor-modal');
    document.getElementById('btn-inline-cancel-campaign').onclick = () => closeModal('hub-campaign-editor-modal');

    // Atalhos para outros módulos
    document.getElementById('btn-hub-numbers').onclick = () => window.openToolV2('numeros', 'Números Anti-Ban');
    document.getElementById('btn-hub-leads').onclick = () => window.openToolV2('leads', 'Leads');
    document.getElementById('btn-hub-config').onclick = () => window.openToolV2('config', 'Configuração');
    document.getElementById('btn-hub-sellers').onclick = () => window.openToolV2('vendedores', 'Vendedores');

    // Form nova campanha
    document.getElementById('hub-campaign-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await api('/campaigns', {
                method: 'POST',
                body: JSON.stringify({
                    name: document.getElementById('hc-name').value.trim(),
                    message: document.getElementById('hc-message').value.trim(),
                    number_ids: document.getElementById('hc-number').value ? [Number(document.getElementById('hc-number').value)] : []
                })
            });
            closeModal('hub-campaign-editor-modal');
            document.getElementById('hub-campaign-form').reset();
            loadStats();
        } catch (e) { alert(e.message); }
    });

    loadStats();
    return {};
}

export async function destroy() {
    window.hubStartCampaign = undefined;
    window.hubPauseCampaign = undefined;
}