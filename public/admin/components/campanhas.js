const STATUS = { draft: { bg: '#fff5c9', c: '#7c5c10' }, running: { bg: '#e3faea', c: '#12813b' }, paused: { bg: '#ffe5e0', c: '#c74838' }, done: { bg: '#e8e4df', c: '#181716' }, cancelled: { bg: '#e5e7eb', c: '#6b7280' } };

export async function init() {
    const api = window.api;
    const toast = window.toast;

    async function load() {
        try {
            const campaigns = await api('/campaigns');
            const list = document.getElementById('campaignsList');
            if (!campaigns.length) {
                list.innerHTML = '<div class="ps-empty"><i class="fas fa-inbox"></i>Nenhuma campanha criada.</div>';
                return;
            }
            list.innerHTML = campaigns.map(c => {
                const s = STATUS[c.status] || STATUS.draft;
                return `
                <div class="ps-row">
                    <div class="ps-row-main">
                        <strong>${c.name}</strong>
                        <span class="ps-row-sub">${c.message ? c.message.slice(0, 90) : 'Mensagem padrão do bot'}${c.message && c.message.length > 90 ? '…' : ''}</span>
                    </div>
                    <div class="ps-row-nums">
                        <div><b>${c.total_sent}</b><span>ENVIADOS</span></div>
                        <div><b style="color:var(--primary);">${c.total_yes}</b><span>CONFIRMADOS</span></div>
                    </div>
                    <span class="ps-pill" style="background:${s.bg}; color:${s.c}; border-color:${s.c};">${c.status.toUpperCase()}</span>
                    <div class="ps-actions">
                        <button class="ps-icon-btn start" title="Iniciar" onclick="startCampaign(${c.id})"><i class="fas fa-play"></i></button>
                        <button class="ps-icon-btn warn" title="Pausar" onclick="pauseCampaign(${c.id})"><i class="fas fa-pause"></i></button>
                    </div>
                </div>`;
            }).join('');
        } catch (e) {
            document.getElementById('campaignsList').innerHTML = `<div class="ps-empty" style="color:var(--bad);">${e.message}</div>`;
        }
    }

    async function loadNumbers() {
        try {
            const numbers = await api('/campaigns/numbers');
            document.getElementById('cNumber').innerHTML =
                numbers.filter(n => n.status === 'ativo').map(n => `<option value="${n.id}">${n.number} (${n.messages_sent} enviadas)</option>`).join('')
                || '<option value="">Nenhum número ativo</option>';
        } catch (e) { console.error(e); }
    }

    window.openCampaignEditor = async () => {
        document.getElementById('campaignEditorModal').style.display = 'flex';
        await loadNumbers();
    };
    window.closeCampaignEditor = () => document.getElementById('campaignEditorModal').style.display = 'none';
    window.startCampaign = async (id) => {
        try { const r = await api(`/campaigns/${id}/start`, { method: 'POST' }); toast(r.message || 'Campanha iniciada!'); load(); } catch (e) { toast(e.message, 'err'); }
    };
    window.pauseCampaign = async (id) => {
        try { await api(`/campaigns/${id}/pause`, { method: 'POST' }); toast('Campanha pausada'); load(); } catch (e) { toast(e.message, 'err'); }
    };

    document.getElementById('campaignForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            await api('/campaigns', {
                method: 'POST',
                body: JSON.stringify({
                    name: document.getElementById('cName').value.trim(),
                    message: document.getElementById('cMessage').value.trim(),
                    number_ids: document.getElementById('cNumber').value ? [Number(document.getElementById('cNumber').value)] : []
                })
            });
            window.closeCampaignEditor();
            document.getElementById('campaignForm').reset();
            toast('Campanha criada!');
            load();
        } catch (e) { toast(e.message, 'err'); }
    });

    await load();
    return {};
}

export async function destroy() {
    window.openCampaignEditor = undefined;
    window.closeCampaignEditor = undefined;
    window.startCampaign = undefined;
    window.pauseCampaign = undefined;
}
