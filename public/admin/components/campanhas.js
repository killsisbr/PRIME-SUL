const STATUS = { draft: { bg: '#fff5c9', c: '#7c5c10' }, running: { bg: '#e3faea', c: '#12813b' }, paused: { bg: '#ffe5e0', c: '#c74838' }, done: { bg: '#e8e4df', c: '#181716' }, cancelled: { bg: '#e5e7eb', c: '#6b7280' } };

export async function init() {
    const api = window.api;

    async function load() {
        try {
            const campaigns = await api('/campaigns');
            const list = document.getElementById('campaignsList');
            if (!campaigns.length) {
                list.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted); font-weight:800; border:2px dashed #c4b7ac; border-radius:14px;"><i class="fas fa-inbox" style="font-size:1.8rem; display:block; margin-bottom:8px; color:var(--primary);"></i>Nenhuma campanha criada.</div>';
                return;
            }
            list.innerHTML = campaigns.map(c => {
                const s = STATUS[c.status] || STATUS.draft;
                return `
                <div style="display:grid; grid-template-columns: 1fr auto auto auto; gap:14px; align-items:center; padding:14px; border:3px solid var(--dark); border-radius:13px; background:#fff; box-shadow:4px 4px 0 var(--dark); margin-bottom:12px;">
                    <div>
                        <strong style="font-family:'Bebas Neue',sans-serif; font-size:1.4rem; letter-spacing:0.5px;">${c.name}</strong>
                        <span style="display:block; font-size:0.68rem; font-weight:700; color:var(--text-muted); margin-top:2px;">${c.message ? c.message.slice(0, 90) : 'Mensagem padrão do bot'}${c.message && c.message.length > 90 ? '…' : ''}</span>
                    </div>
                    <div style="display:grid; grid-template-columns:auto auto auto; align-items:baseline; gap:12px;">
                        <div><b style="font-family:'Bebas Neue',sans-serif; font-size:1.3rem;">${c.total_sent}</b><span style="display:block; font-size:0.55rem; font-weight:900; color:var(--text-muted);">ENVIADOS</span></div>
                        <div><b style="font-family:'Bebas Neue',sans-serif; font-size:1.3rem; color:var(--primary);">${c.total_yes}</b><span style="display:block; font-size:0.55rem; font-weight:900; color:var(--text-muted);">CONFIRMADOS</span></div>
                    </div>
                    <span style="padding:5px 10px; border:2px solid ${s.c}; border-radius:999px; font-size:0.6rem; font-weight:900; background:${s.bg}; color:${s.c};">${c.status.toUpperCase()}</span>
                    <div style="display:flex; gap:6px;">
                        <button class="num-btn" title="Iniciar" style="background:#25d366; color:#fff;" onclick="startCampaign(${c.id})"><i class="fas fa-play"></i></button>
                        <button class="num-btn" title="Pausar" onclick="pauseCampaign(${c.id})"><i class="fas fa-pause"></i></button>
                    </div>
                </div>`;
            }).join('');
        } catch (e) {
            document.getElementById('campaignsList').innerHTML = `<div style="color:var(--danger); font-weight:800;">${e.message}</div>`;
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
        try { const r = await api(`/campaigns/${id}/start`, { method: 'POST' }); alert(r.message || 'Iniciada'); load(); } catch (e) { alert(e.message); }
    };
    window.pauseCampaign = async (id) => {
        try { await api(`/campaigns/${id}/pause`, { method: 'POST' }); load(); } catch (e) { alert(e.message); }
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
            load();
        } catch (e) { alert(e.message); }
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