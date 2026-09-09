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
    let _currentDisposable = true;

    async function loadMode() {
        try {
            const m = await api('/config/mode');
            _currentDisposable = m.disposable_bots_mode !== false;
            updateModeUI(_currentDisposable);
        } catch (e) {}
    }

    function updateModeUI(isDisp) {
        const btn = document.getElementById('btn-hub-toggle-mode');
        const icon = document.getElementById('hub-mode-icon');
        const label = document.getElementById('hub-mode-label');
        if (!btn || !icon || !label) return;

        if (isDisp) {
            btn.style.background = '#f0fdf4';
            icon.className = 'fas fa-shield-virus';
            icon.style.color = '#10b981';
            label.textContent = 'MODO: DESCARTÁVEL (ANTI-BAN)';
            label.style.color = '#166534';
        } else {
            btn.style.background = '#eff6ff';
            icon.className = 'fas fa-bolt';
            icon.style.color = '#3b82f6';
            label.textContent = 'MODO: DIRETO (VENDEDOR)';
            label.style.color = '#1e40af';
        }
    }

    document.getElementById('btn-hub-toggle-mode')?.addEventListener('click', async () => {
        try {
            const nextMode = !_currentDisposable;
            await api('/config/mode', {
                method: 'POST',
                body: JSON.stringify({ disposable_bots_mode: nextMode })
            });
            _currentDisposable = nextMode;
            updateModeUI(_currentDisposable);
            if (window.toast) {
                window.toast(nextMode ? 'Ativado: Modo Híbrido Anti-Ban (Descartável)' : 'Ativado: Modo Direto do Vendedor');
            }
        } catch (e) {
            if (window.toast) window.toast('Erro ao alternar modo: ' + e.message, 'err');
        }
    });

    loadStats();
    loadMode();
    return {};
}

export async function destroy() {}
