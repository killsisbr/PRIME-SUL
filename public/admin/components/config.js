export async function init() {
    const api = window.api;
    const toast = window.toast;

    document.querySelectorAll('#cfgTabbar [data-cfg-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('#cfgTabbar [data-cfg-tab]').forEach(t => t.classList.toggle('active', t === tab));
            document.querySelectorAll('[data-cfg-panel]').forEach(panel => panel.hidden = panel.dataset.cfgPanel !== tab.dataset.cfgTab);
        });
    });

    function updateModeCards(isDisposable) {
        const cardDisp = document.getElementById('cfgModeCardDisposable');
        const cardDir = document.getElementById('cfgModeCardDirect');
        const radioDisp = document.getElementById('cfgModeRadioDisposable');
        const radioDir = document.getElementById('cfgModeRadioDirect');
        const badge = document.getElementById('cfgModeBadge');

        if (radioDisp) radioDisp.checked = isDisposable;
        if (radioDir) radioDir.checked = !isDisposable;

        if (cardDisp) {
            cardDisp.classList.toggle('active', isDisposable);
            cardDisp.style.borderColor = isDisposable ? 'var(--dark)' : '#cbd5e1';
            cardDisp.style.background = isDisposable ? '#f0fdf4' : '#fff';
        }
        if (cardDir) {
            cardDir.classList.toggle('active', !isDisposable);
            cardDir.style.borderColor = !isDisposable ? 'var(--dark)' : '#cbd5e1';
            cardDir.style.background = !isDisposable ? '#eff6ff' : '#fff';
        }
        if (badge) {
            badge.textContent = isDisposable ? 'MODO HÍBRIDO (DESCARTÁVEL)' : 'MODO DIRETO (VENDEDOR)';
            badge.style.background = isDisposable ? '#10b981' : '#3b82f6';
        }
    }

    document.querySelectorAll('input[name="cfg_dispatch_mode"]').forEach(r => {
        r.addEventListener('change', (e) => {
            updateModeCards(e.target.value === 'true');
        });
    });

    document.getElementById('cfgModeCardDisposable')?.addEventListener('click', () => updateModeCards(true));
    document.getElementById('cfgModeCardDirect')?.addEventListener('click', () => updateModeCards(false));

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
            if (s.cfg_recontact_days) document.getElementById('cfgRecontactDays').value = s.cfg_recontact_days;
            if (s.cfg_wa_slots) document.getElementById('cfgWaSlots').value = s.cfg_wa_slots;

            const isDisp = s.cfg_disposable_bots_mode !== 'false';
            updateModeCards(isDisp);
        } catch (e) { console.error(e); }
    }

    window.saveFiscalSettings = async function () {
        const btn = document.querySelector('button[onclick="saveFiscalSettings()"]');
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SALVANDO...';
        btn.disabled = true;
        try {
            const isDisp = document.getElementById('cfgModeRadioDisposable')?.checked ?? true;
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
                    cfg_recontact_days: document.getElementById('cfgRecontactDays').value,
                    cfg_wa_slots: document.getElementById('cfgWaSlots').value,
                    cfg_disposable_bots_mode: isDisp ? 'true' : 'false'
                })
            });
            toast('Configurações salvas!');
        } catch (e) {
            toast('Erro ao salvar: ' + e.message, 'err');
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