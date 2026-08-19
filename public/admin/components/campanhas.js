const STATUS = { draft: { bg: '#fff5c9', c: '#7c5c10' }, running: { bg: '#e3faea', c: '#12813b' }, paused: { bg: '#ffe5e0', c: '#c74838' }, done: { bg: '#e8e4df', c: '#181716' }, cancelled: { bg: '#e5e7eb', c: '#6b7280' } };

let _timer = null;

export async function init() {
    const api = window.api;
    const toast = window.toast;
    let delayMs = 15000;
    let cpTargetCount = null;

    async function load() {
        try {
            const data = await api('/campaigns');
            const campaigns = data.campaigns || [];
            delayMs = data.config && data.config.delayMs || delayMs;
            renderStats(campaigns);
            renderList(campaigns);
        } catch (e) {
            document.getElementById('campaignsList').innerHTML = `<div class="ps-empty" style="color:var(--bad);">${escapeHtml(e.message)}</div>`;
        }
    }

    function renderStats(campaigns) {
        const set = (id, v) => document.getElementById(id).textContent = v;
        set('cp-stat-total', campaigns.length);
        set('cp-stat-running', campaigns.filter(c => c.status === 'running').length);
        set('cp-stat-sent', campaigns.reduce((a, c) => a + (c.total_sent || 0), 0));
        set('cp-stat-yes', campaigns.reduce((a, c) => a + (c.total_yes || 0), 0));
        set('cp-stat-fail', campaigns.reduce((a, c) => a + (c.falhou || 0), 0));
    }

    function chips(c) {
        let f = {};
        try { f = c.filters ? JSON.parse(c.filters) : {}; } catch (e) { /* ignore */ }
        const out = [];
        const statuses = Array.isArray(f.status) && f.status.length ? f.status : ['novo', 'contato'];
        out.push(statuses.map(s => ({ t: { novo: 'NOVO', contato: 'EM CONTATO' }[s] || s.toUpperCase(), k: 'st' })).flat());
        if (f.origem) out.push([{ t: f.origem.toUpperCase(), k: 'origem' }]);
        if (f.prioridade) out.push([{ t: 'PRIO ' + f.prioridade.toUpperCase(), k: 'prio' }]);
        if (f.cidade) out.push([{ t: 'CIDADE: ' + f.cidade.toUpperCase(), k: 'cid' }]);
        if (f.limit) out.push([{ t: 'MÁX ' + f.limit, k: 'lim' }]);
        return out.flat().map(x => `<span class="cp-chip">${escapeHtml(String(x.t))}</span>`).join('');
    }

    function renderList(campaigns) {
        const list = document.getElementById('campaignsList');
        if (!campaigns.length) {
            list.innerHTML = '<div class="ps-empty"><i class="fas fa-inbox"></i>Nenhuma campanha criada.</div>';
            return;
        }
        list.innerHTML = campaigns.map(c => {
            const s = STATUS[c.status] || STATUS.draft;
            const total = c.total_target || 0;
            const done = c.total_sent || 0;
            const fail = c.falhou || 0;
            const pend = c.pending || 0;
            const pct = total ? Math.round((done + fail) / total * 100) : 0;
            const eta = pend && delayMs ? Math.ceil(pend * delayMs / 60000) : 0;

            const btn = (cls, act, icon, label, disabled) =>
                `<button class="cp-btn ${cls}" data-act="${act}" data-id="${c.id}" ${disabled ? 'disabled' : ''}><i class="fas ${icon}"></i> ${label}</button>`;

            return `
            <div class="cp-card" data-id="${c.id}">
                <div class="cp-card-head">
                    <div>
                        <div class="cp-card-name">${escapeHtml(String(c.name))}</div>
                        <div class="cp-card-meta">Criada em ${(c.created_at || '').slice(0, 10)} • ${total} alvo(s) • <b style="color:${s.c};">${c.status.toUpperCase()}</b></div>
                    </div>
                    <span class="ps-pill" style="background:${s.bg}; color:${s.c}; border-color:${s.c};">${c.status.toUpperCase()}</span>
                </div>
                <div class="cp-card-msg">${escapeHtml((c.message || '').slice(0, 120))}${c.message && c.message.length > 120 ? '…' : ''}</div>
                <div class="cp-chips">${chips(c)}</div>
                <div class="cp-progress" title="${pct}% processado">
                    <i class="done" style="width:${total ? Math.round(done / total * 100) : 0}%"></i>
                    <i class="fail" style="width:${total ? Math.round(fail / total * 100) : 0}%"></i>
                </div>
                <div class="cp-metrics">
                    <div class="cp-metric"><b>${total}</b><span>ALVOS</span></div>
                    <div class="cp-metric sent"><b>${done}</b><span>ENVIADOS</span></div>
                    <div class="cp-metric yes"><b>${c.confirmado || 0}</b><span>CONFIRMADOS</span></div>
                    <div class="cp-metric fail"><b>${fail}</b><span>FALHAS</span></div>
                    <div class="cp-metric pend"><b>${pend}</b><span>PENDENTES</span></div>
                </div>
                <div class="cp-actions">
                    ${btn('start', 'start', 'fa-play', 'INICIAR', c.status === 'running' || c.status === 'done' || c.status === 'cancelled')}
                    ${btn('pause', 'pause', 'fa-pause', 'PAUSAR', c.status !== 'running')}
                    ${btn('retry', 'retry', 'fa-rotate', 'REENVIAR FALHAS', !fail || c.status === 'running')}
                    ${btn('cancel', 'cancel', 'fa-ban', 'CANCELAR', !(c.status === 'running' || c.status === 'paused'))}
                    ${eta ? `<span class="cp-note"><i class="fas fa-clock"></i> ~${eta} min restantes</span>` : ''}
                </div>
                ${c.error === 'not_connected' ? `<div class="cp-note"><i class="fas fa-plug"></i> Bot offline — a campanha retoma automaticamente quando reconectar.</div>` : ''}
            </div>`;
        }).join('');
    }

    function escapeHtml(s) {
        return s.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    async function loadNumbers() {
        try {
            const numbers = await api('/campaigns/numbers');
            document.getElementById('cNumber').innerHTML =
                numbers.filter(n => n.status === 'ativo').map(n => `<option value="${n.id}">${escapeHtml(n.label || ('Triagem #' + n.id))}</option>`).join('')
                || '<option value="">Nenhum número ativo</option>';
        } catch (e) { console.error(e); }
    }

    function currentFilters() {
        const status = Array.from(document.querySelectorAll('#cStatusChecks input:checked')).map(i => i.value);
        return {
            status,
            origem: document.getElementById('cOrigem').value.trim(),
            prioridade: document.getElementById('cPrioridade').value,
            cidade: document.getElementById('cCidade').value.trim(),
            limit: document.getElementById('cLimit').value ? Number(document.getElementById('cLimit').value) : undefined
        };
    }

    let countTimer = null;
    async function refreshTargetCount() {
        clearTimeout(countTimer);
        countTimer = setTimeout(async () => {
            const line = document.getElementById('cTargetLine');
            const submit = document.getElementById('cSubmit');
            try {
                const r = await api('/campaigns/targets/count', { method: 'POST', body: JSON.stringify(currentFilters()) });
                const f = currentFilters();
                const shown = f.limit ? Math.min(r.count, Number(f.limit)) : r.count;
                cpTargetCount = shown;
                line.innerHTML = shown
                    ? `<i class="fas fa-bullseye"></i> <b>${shown}</b> lead(s) serão atingidos${r.count > shown ? ` (de ${r.count} correspondendo aos filtros)` : ''}`
                    : '<i class="fas fa-triangle-exclamation" style="color:var(--danger);"></i> Nenhum lead corresponde aos filtros';
                submit.disabled = !shown;
            } catch (e) {
                line.textContent = 'Erro ao calcular alvos';
            }
        }, 350);
    }

    window.cpPreview = () => {
        const raw = document.getElementById('cMessage').value;
        const preview = document.getElementById('cPreview');
        const sample = raw.replace(/\{nome\}/g, 'Maria');
        preview.textContent = (sample.trim() ? sample : 'Olá Maria! Aqui é a Prime Sul...') + `\n\n(${raw.length} caracteres)`;
    };

    window.openCampaignEditor = async (opts = {}) => {
        let modal = document.getElementById('campaignEditorModal');
        if (!modal) {
            try {
                const htmlRes = await fetch(`/admin/components/campanhas.html?cb=${Date.now()}`);
                if (htmlRes.ok) {
                    const text = await htmlRes.text();
                    const temp = document.createElement('div');
                    temp.innerHTML = text;
                    const modalEl = temp.querySelector('#campaignEditorModal');
                    if (modalEl) {
                        document.body.appendChild(modalEl);
                        modal = modalEl;
                        // Bind events on new modal elements if created dynamically
                        modalEl.querySelectorAll('#cStatusChecks input').forEach(i =>
                            i.addEventListener('change', () => {
                                i.closest('.cp-check')?.classList.toggle('on', i.checked);
                                refreshTargetCount();
                            })
                        );
                        ['cOrigem', 'cPrioridade', 'cCidade', 'cLimit'].forEach(id =>
                            modalEl.querySelector('#' + id)?.addEventListener('input', refreshTargetCount)
                        );
                        modalEl.querySelector('#campaignForm')?.addEventListener('submit', async (e) => {
                            e.preventDefault();
                            const submit = document.getElementById('cSubmit');
                            if (cpTargetCount === 0) { toast('Nenhum lead corresponde aos filtros', 'err'); return; }
                            submit.disabled = true;
                            try {
                                await api('/campaigns', {
                                    method: 'POST',
                                    body: JSON.stringify({
                                        name: document.getElementById('cName').value.trim(),
                                        message: document.getElementById('cMessage').value.trim(),
                                        number_ids: document.getElementById('cNumber').value ? [Number(document.getElementById('cNumber').value)] : [],
                                        filters: currentFilters()
                                    })
                                });
                                window.closeCampaignEditor();
                                toast('Campanha criada!');
                                if (typeof load === 'function') load();
                            } catch (err) { toast(err.message, 'err'); }
                            submit.disabled = false;
                        });
                    }
                }
            } catch (e) { console.error(e); }
        }
        if (!modal) return;
        modal.style.display = 'flex';
        document.getElementById('cMessage').value = opts.message || 'Olá {nome}! Você pediu uma simulação de crédito. Posso pedir para um vendedor encaminhar? Responda SIM para continuar.';
        if (opts.name) document.getElementById('cName').value = opts.name;
        if (opts.origem) document.getElementById('cOrigem').value = opts.origem;
        if (opts.prioridade) document.getElementById('cPrioridade').value = opts.prioridade;
        if (opts.cidade) document.getElementById('cCidade').value = opts.cidade;
        if (opts.limit) document.getElementById('cLimit').value = opts.limit;

        if (opts.statusList && Array.isArray(opts.statusList)) {
            document.querySelectorAll('#cStatusChecks input').forEach(input => {
                input.checked = opts.statusList.includes(input.value);
                input.closest('.cp-check')?.classList.toggle('on', input.checked);
            });
        } else if (opts.stage) {
            document.querySelectorAll('#cStatusChecks input').forEach(input => {
                input.checked = (input.value === opts.stage);
                input.closest('.cp-check')?.classList.toggle('on', input.checked);
            });
        }
        window.cpPreview?.();
        await loadNumbers();
        refreshTargetCount();
    };
    window.closeCampaignEditor = () => {
        const modal = document.getElementById('campaignEditorModal');
        if (modal) modal.style.display = 'none';
    };

    window.campaignAction = async (act, id) => {
        try {
            let r;
            if (act === 'start') r = await api(`/campaigns/${id}/start`, { method: 'POST' });
            else if (act === 'pause') { await api(`/campaigns/${id}/pause`, { method: 'POST' }); r = { message: 'Campanha pausada' }; }
            else if (act === 'retry') r = await api(`/campaigns/${id}/retry`, { method: 'POST' });
            else if (act === 'cancel') { await api(`/campaigns/${id}/cancel`, { method: 'POST' }); r = { message: 'Campanha cancelada' }; }
            toast(r.message || 'OK');
            load();
        } catch (e) { toast(e.message, 'err'); }
    };

    document.getElementById('campaignsList').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');
        if (btn) window.campaignAction(btn.dataset.act, Number(btn.dataset.id));
    });

    document.querySelectorAll('#cStatusChecks input').forEach(i =>
        i.addEventListener('change', () => {
            i.closest('.cp-check').classList.toggle('on', i.checked);
            refreshTargetCount();
        })
    );
    ['cOrigem', 'cPrioridade', 'cCidade', 'cLimit'].forEach(id =>
        document.getElementById(id).addEventListener('input', refreshTargetCount)
    );

    document.getElementById('campaignForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submit = document.getElementById('cSubmit');
        if (cpTargetCount === 0) { toast('Nenhum lead corresponde aos filtros', 'err'); return; }
        submit.disabled = true;
        try {
            await api('/campaigns', {
                method: 'POST',
                body: JSON.stringify({
                    name: document.getElementById('cName').value.trim(),
                    message: document.getElementById('cMessage').value.trim(),
                    number_ids: document.getElementById('cNumber').value ? [Number(document.getElementById('cNumber').value)] : [],
                    filters: currentFilters()
                })
            });
            window.closeCampaignEditor();
            document.getElementById('campaignForm').reset();
            window.cpPreview();
            toast('Campanha criada!');
            load();
        } catch (err) { toast(err.message, 'err'); }
        submit.disabled = false;
    });

    await load();
    _timer = setInterval(load, 3000); // progresso ao vivo
}

export async function destroy() {
    clearInterval(_timer);
    _timer = null;
    window.openCampaignEditor = undefined;
    window.closeCampaignEditor = undefined;
    window.campaignAction = undefined;
    window.cpPreview = undefined;
}
