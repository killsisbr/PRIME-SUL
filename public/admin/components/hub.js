export async function init({ container }) {
    const api = window.api;
    const esc = window.escapeHtml;

    async function loadStats() {
        try {
            const counts = await api('/leads/counts');
            set('#hub-stat-leads', counts.leads);
            set('#hub-stat-conf', counts.confirmados);
            const campaigns = (await api('/campaigns')).campaigns;
            set('#hub-stat-camp', campaigns.length);
            set('#hub-campaign-summary', campaigns.length ? `${campaigns.length} campanha(s) ativa(s) para ${counts.leads} leads.` : 'Nenhuma campanha criada ainda.');
            const numbers = await api('/campaigns/numbers');
            set('#hub-stat-num', numbers.length);
        } catch (e) {
            console.error(e);
            set('#hub-campaign-summary', 'Erro ao carregar.');
        }
    }

    function set(id, v) { const el = container.querySelector(id); if (el) el.textContent = v; }

    // Abre o módulo Campanhas real (única implementação — sem duplicar aqui)
    function goToCampaigns(createNew) {
        window.openToolV2('campanhas', 'Campanhas', api => {
            if (createNew) api.openEditor?.();
        });
    }

    document.getElementById('btn-hub-campaigns-card').onclick = () => goToCampaigns(false);
    document.getElementById('btn-hub-campaigns').onclick = () => goToCampaigns(false);
    document.getElementById('btn-hub-create-campaign').onclick = () => goToCampaigns(true);

    // Atalhos para outros módulos
    document.getElementById('btn-hub-numbers').onclick = () => window.openToolV2('numeros', 'Números Anti-Ban');
    document.getElementById('btn-hub-leads').onclick = () => window.openToolV2('leads', 'Leads');
    document.getElementById('btn-hub-config').onclick = () => window.openToolV2('config', 'Configuração');
    document.getElementById('btn-hub-sellers').onclick = () => window.openToolV2('vendedores', 'Vendedores');

    loadStats();
    return {};
}

export async function destroy() {}
