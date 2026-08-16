export async function init() {
    const api = window.api;

    async function load() {
        try {
            const s = await api('/config');
            if (s.cfg_cnpj) document.getElementById('cfgCnpj').value = s.cfg_cnpj;
            if (s.cfg_parceiro) document.getElementById('cfgParceiro').value = s.cfg_parceiro;
            if (s.cfg_produtos) document.getElementById('cfgProdutos').value = s.cfg_produtos;
            if (s.cfg_ambiente) document.getElementById('cfgAmbiente').value = s.cfg_ambiente;
            if (s.cfg_template) document.getElementById('cfgTemplate').value = s.cfg_template;
            if (s.cfg_daily_limit) document.getElementById('cfgDailyLimit').value = s.cfg_daily_limit;
            if (s.cfg_delay) document.getElementById('cfgDelay').value = s.cfg_delay;
            if (s.cfg_batch) document.getElementById('cfgBatch').value = s.cfg_batch;
            document.getElementById('cfgBotEnabled').checked = s.cfg_bot_enabled === 'true';
        } catch (e) { console.error(e); }
    }

    window.saveFiscalSettings = async function () {
        const btn = document.querySelector('button[onclick="saveFiscalSettings()"]');
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SALVANDO...';
        btn.disabled = true;
        try {
            await api('/config', {
                method: 'PUT',
                body: JSON.stringify({
                    cfg_cnpj: document.getElementById('cfgCnpj').value.trim(),
                    cfg_parceiro: document.getElementById('cfgParceiro').value.trim(),
                    cfg_produtos: document.getElementById('cfgProdutos').value,
                    cfg_ambiente: document.getElementById('cfgAmbiente').value,
                    cfg_template: document.getElementById('cfgTemplate').value.trim(),
                    cfg_daily_limit: document.getElementById('cfgDailyLimit').value,
                    cfg_delay: document.getElementById('cfgDelay').value,
                    cfg_batch: document.getElementById('cfgBatch').value,
                    cfg_bot_enabled: document.getElementById('cfgBotEnabled').checked ? 'true' : 'false'
                })
            });
            alert('Configurações salvas!');
        } catch (e) {
            alert('Erro ao salvar: ' + e.message);
        } finally {
            btn.innerHTML = orig;
            btn.disabled = false;
        }
    };

    await load();
    return {};
}

export async function destroy() {
    window.saveFiscalSettings = undefined;
}