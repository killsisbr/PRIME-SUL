const PURPOSE_LABEL = { screening: 'TRIAGEM', handoff: 'HANDOFF', followup: 'FOLLOW-UP' };

export async function init() {
    const api = window.api;
    const toast = window.toast;
    const esc = window.escapeHtml;

    function render(stats) {
        document.getElementById('tp-total').textContent = stats.length;
        document.getElementById('tp-campaigns').textContent = stats.reduce((sum, t) => sum + t.campaigns_count, 0);
        document.getElementById('tp-sends').textContent = stats.reduce((sum, t) => sum + t.sends_count, 0);

        const list = document.getElementById('tp-list');
        if (!stats.length) {
            list.innerHTML = '<div class="ps-empty"><i class="fas fa-file-lines"></i>Nenhum template cadastrado ainda.<br>Clique em "NOVO TEMPLATE" pra criar o primeiro.</div>';
            return;
        }
        list.innerHTML = stats.map(t => `
            <div class="tp-row">
                <div class="tp-row-main">
                    <strong>${esc(t.name)}</strong>
                    <span class="ps-row-sub">${PURPOSE_LABEL[t.purpose] || t.purpose} ${t.seller_id ? '• pessoal' : '• compartilhado'} • criado ${esc((t.created_at || '').slice(0, 10))}</span>
                </div>
                <div class="tp-metric"><b>${t.campaigns_count}</b><span>CAMPANHAS</span></div>
                <div class="tp-metric"><b>${t.sends_count}</b><span>ENVIADOS</span></div>
                <div class="tp-metric ${t.sends_count ? '' : 'dim'}"><b>${t.response_rate}%</b><span>RESPOSTA</span></div>
                <div class="tp-metric ${t.sends_count ? '' : 'dim'}"><b>${t.conversion_rate}%</b><span>CONVERSÃO</span></div>
                <button type="button" class="ps-icon-btn danger" data-del="${t.id}" title="Arquivar template"><i class="fas fa-box-archive"></i></button>
            </div>`).join('');
    }

    async function refresh() {
        try {
            render(await api('/templates/stats'));
        } catch (e) {
            document.getElementById('tp-list').innerHTML = `<div class="ps-empty" style="color:var(--bad);">${esc(e.message)}</div>`;
        }
    }

    function openModal() { document.getElementById('tpOverlay').style.display = 'flex'; }
    function closeModal() {
        document.getElementById('tpOverlay').style.display = 'none';
        document.getElementById('tp-name').value = '';
        document.getElementById('tp-body').value = '';
        document.getElementById('tp-purpose').value = 'screening';
        document.getElementById('tp-shared').checked = true;
    }

    document.getElementById('tp-new').onclick = openModal;
    document.getElementById('tp-close').onclick = closeModal;
    document.getElementById('tpOverlay').addEventListener('click', e => { if (e.target.id === 'tpOverlay') closeModal(); });

    document.getElementById('tp-save').onclick = async () => {
        const name = document.getElementById('tp-name').value.trim();
        const body = document.getElementById('tp-body').value.trim();
        if (!name || !body) { toast('Preencha nome e mensagem', 'err'); return; }
        const btn = document.getElementById('tp-save');
        btn.disabled = true;
        try {
            await api('/templates', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    body,
                    purpose: document.getElementById('tp-purpose').value,
                    shared: document.getElementById('tp-shared').checked
                })
            });
            toast('Template criado!');
            closeModal();
            refresh();
        } catch (e) { toast(e.message, 'err'); }
        btn.disabled = false;
    };

    document.getElementById('tp-list').addEventListener('click', async e => {
        const btn = e.target.closest('[data-del]');
        if (!btn) return;
        if (!confirm('Arquivar este template? Ele deixa de aparecer na criação de campanhas (o histórico é mantido).')) return;
        btn.disabled = true;
        try {
            await api(`/templates/${btn.dataset.del}`, { method: 'DELETE' });
            toast('Template arquivado', 'info');
            refresh();
        } catch (e) { toast(e.message, 'err'); btn.disabled = false; }
    });

    await refresh();
    return {};
}

export async function destroy() {}
