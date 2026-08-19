const STATUS = { draft: { bg: '#fff5c9', c: '#7c5c10' }, running: { bg: '#e3faea', c: '#12813b' }, paused: { bg: '#ffe5e0', c: '#c74838' }, done: { bg: '#e8e4df', c: '#181716' }, cancelled: { bg: '#e5e7eb', c: '#6b7280' } };

let _timer = null;

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

export async function init() {
    const api = window.api;
    const toast = window.toast;
    let delayMs = 15000;
    let cpTargetCount = null;
    let allCampaigns = [];
    let templates = [];
    let editingId = null;
    let cpTargetLeads = [];
    let cpDeselected = new Set();
    let cpListOpen = false;
    let cpListLoaded = false;

    async function load() {
        try {
            const data = await api('/campaigns');
            allCampaigns = data.campaigns || [];
            delayMs = data.config && data.config.delayMs || delayMs;
            renderStats(allCampaigns);
            renderList();
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
        const labels = { novo: 'NOVO', contato: 'EM CONTATO', confirmado: 'CONFIRMADO', concluido: 'CONCLUÍDO' };
        out.push(statuses.map(s => ({ t: labels[s] || s.toUpperCase(), k: 'st' })).flat());
        if (f.origem) out.push([{ t: f.origem.toUpperCase(), k: 'origem' }]);
        if (f.prioridade) out.push([{ t: 'PRIO ' + f.prioridade.toUpperCase(), k: 'prio' }]);
        if (f.cidade) out.push([{ t: 'CIDADE: ' + f.cidade.toUpperCase(), k: 'cid' }]);
        if (f.limit) out.push([{ t: 'MÁX ' + f.limit, k: 'lim' }]);
        return out.flat().map(x => `<span class="cp-chip">${escapeHtml(String(x.t))}</span>`).join('');
    }

    function applyListFilters(campaigns) {
        const q = (document.getElementById('cp-search').value || '').trim().toLowerCase();
        const st = document.getElementById('cp-filter-status').value;
        return campaigns.filter(c => {
            if (st && c.status !== st) return false;
            if (q && !String(c.name).toLowerCase().includes(q)) return false;
            return true;
        });
    }

    function renderList() {
        const list = document.getElementById('campaignsList');
        const campaigns = applyListFilters(allCampaigns);
        if (!allCampaigns.length) {
            list.innerHTML = '<div class="ps-empty"><i class="fas fa-inbox"></i>Nenhuma campanha criada.</div>';
            return;
        }
        if (!campaigns.length) {
            list.innerHTML = '<div class="ps-empty"><i class="fas fa-magnifying-glass"></i>Nenhuma campanha corresponde à busca.</div>';
            return;
        }
        list.innerHTML = campaigns.map(c => {
            const s = STATUS[c.status] || STATUS.draft;
            const total = c.total_target || 0;
            const done = c.total_sent || 0;
            const fail = c.falhou || 0;
            const pend = c.pending || 0;
            const eta = pend && delayMs ? Math.ceil(pend * delayMs / 60000) : 0;
            const scheduledBadge = (c.status === 'draft' && c.scheduled_at)
                ? `<span class="cp-badge-scheduled"><i class="fas fa-clock"></i> AGENDADA ${escapeHtml(formatSchedule(c.scheduled_at))}</span>` : '';

            const BTN_TITLES = {
                start: 'Começa a enviar a mensagem pros alvos da campanha',
                pause: 'Interrompe o envio; retome quando quiser',
                retry: 'Tenta reenviar só pros que falharam',
                cancel: 'Encerra a campanha — não pode ser retomada depois',
                edit: 'Muda o nome ou a mensagem (alvos não mudam)',
                delete: 'Apaga essa campanha permanentemente'
            };
            const btn = (cls, act, icon, label, disabled) =>
                `<button class="cp-btn ${cls}" data-act="${act}" data-id="${c.id}" title="${BTN_TITLES[act] || ''}" ${disabled ? 'disabled' : ''}><i class="fas ${icon}"></i>${label ? ' ' + label : ''}</button>`;
            const pct = total ? Math.round((done + fail) / total * 100) : 0;
            const canStart = !(c.status === 'running' || c.status === 'done' || c.status === 'cancelled');

            return `
            <div class="cp-card" data-id="${c.id}">
                <div class="cp-card-head">
                    <span class="cp-status-dot ${c.status}"></span>
                    <div class="cp-card-head-main">
                        <div class="cp-card-name">${escapeHtml(String(c.name))}${scheduledBadge}</div>
                        <div class="cp-card-meta">Criada em ${(c.created_at || '').slice(0, 10)} • ${total} alvo(s)</div>
                    </div>
                    <span class="ps-pill" style="background:${s.bg}; color:${s.c}; border-color:${s.c};">${c.status.toUpperCase()}</span>
                </div>
                <div class="cp-card-msg">${escapeHtml((c.message || '').slice(0, 120))}${c.message && c.message.length > 120 ? '…' : ''}</div>
                <div class="cp-chips">${chips(c)}</div>
                <div class="cp-progress-wrap">
                    <div class="cp-progress" title="progresso">
                        <i class="done" style="width:${total ? Math.round(done / total * 100) : 0}%"></i>
                        <i class="fail" style="width:${total ? Math.round(fail / total * 100) : 0}%"></i>
                    </div>
                    <span class="cp-progress-label">${pct}% processado</span>
                </div>
                <div class="cp-metrics">
                    <div class="cp-metric"><b>${total}</b><span>ALVOS</span></div>
                    <div class="cp-metric sent"><b>${done}</b><span>ENVIADOS</span></div>
                    <div class="cp-metric yes"><b>${c.confirmado || 0}</b><span>CONFIRMADOS</span></div>
                    <div class="cp-metric fail"><b>${fail}</b><span>FALHAS</span></div>
                    <div class="cp-metric pend"><b>${pend}</b><span>PENDENTES</span></div>
                </div>
                <div class="cp-actions">
                    <div class="cp-actions-main">
                        ${canStart
                            ? btn('start', 'start', 'fa-play', 'INICIAR', false)
                            : btn('pause', 'pause', 'fa-pause', 'PAUSAR', c.status !== 'running')}
                        ${btn('retry', 'retry', 'fa-rotate', 'REENVIAR FALHAS', !fail || c.status === 'running')}
                        ${btn('cancel', 'cancel', 'fa-ban', 'CANCELAR', !(c.status === 'running' || c.status === 'paused'))}
                        ${btn('edit', 'edit', 'fa-pen', 'EDITAR', c.status === 'running')}
                    </div>
                    ${btn('delete', 'delete', 'fa-trash', '', c.status === 'running')}
                </div>
                ${eta ? `<div class="cp-note"><i class="fas fa-clock"></i> ~${eta} min restantes no ritmo atual</div>` : ''}
                ${c.error === 'not_connected' ? `<div class="cp-note warn"><i class="fas fa-plug"></i> Bot offline — a campanha retoma automaticamente quando reconectar.</div>` : ''}
            </div>`;
        }).join('');
    }

    function formatSchedule(iso) {
        const d = new Date((iso || '').replace(' ', 'T') + 'Z');
        if (isNaN(d)) return '';
        return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    async function loadNumbers() {
        try {
            const numbers = await api('/campaigns/numbers');
            document.getElementById('cNumber').innerHTML =
                numbers.filter(n => n.status === 'ativo').map(n => `<option value="${n.id}">${escapeHtml(n.label || ('Triagem #' + n.id))}</option>`).join('')
                || '<option value="">Nenhum número ativo</option>';
        } catch (e) { console.error(e); }
    }

    async function loadTemplates() {
        try {
            templates = (await api('/templates')).filter(t => t.purpose === 'screening');
            document.getElementById('cTemplate').innerHTML =
                '<option value="">Nenhum — escrever manualmente</option>' +
                templates.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
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
        if (editingId) return;
        // filtros mudaram: a seleção individual antiga não vale mais
        cpListLoaded = false;
        cpDeselected.clear();
        cpTargetLeads = [];
        if (cpListOpen) await loadTargetList();
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
                    ? `<i class="fas fa-bullseye"></i> <b>${shown}</b> lead(s) serão atingidos${r.count > shown ? ` (de ${r.count} correspondendo aos filtros)` : ''} <i class="fas fa-chevron-down cp-target-chevron"></i>`
                    : '<i class="fas fa-triangle-exclamation" style="color:var(--danger);"></i> Nenhum lead corresponde aos filtros';
                submit.disabled = !shown;
                line.disabled = !shown;
            } catch (e) {
                line.textContent = 'Erro ao calcular alvos';
            }
        }, 350);
    }

    async function loadTargetList() {
        const wrap = document.getElementById('cTargetListWrap');
        const listEl = document.getElementById('cTargetList');
        listEl.innerHTML = '<div class="ps-loading"><i class="fas fa-spinner fa-spin"></i> Carregando leads...</div>';
        try {
            const leads = await api('/campaigns/targets/list', { method: 'POST', body: JSON.stringify(currentFilters()) });
            cpTargetLeads = leads.leads || [];
            cpListLoaded = true;
            renderTargetList();
        } catch (e) {
            listEl.innerHTML = `<div class="ps-empty" style="color:var(--bad);">${escapeHtml(e.message)}</div>`;
        }
    }

    function renderTargetList() {
        const listEl = document.getElementById('cTargetList');
        if (!cpTargetLeads.length) {
            listEl.innerHTML = '<div class="ps-empty">Nenhum lead corresponde aos filtros.</div>';
            return;
        }
        listEl.innerHTML = cpTargetLeads.map(l => {
            const checked = !cpDeselected.has(l.id);
            return `
            <label class="cp-target-item ${checked ? '' : 'off'}">
                <input type="checkbox" data-lead-id="${l.id}" ${checked ? 'checked' : ''}>
                <span class="cp-target-item-main">
                    <strong>${escapeHtml(l.name)}</strong>
                    <small>${escapeHtml(l.phone)}${l.city ? ' • ' + escapeHtml(l.city) : ''}</small>
                </span>
            </label>`;
        }).join('');
    }

    function updateSelectedCountLabel() {
        const line = document.getElementById('cTargetLine');
        if (!cpListLoaded) return;
        const total = cpTargetLeads.length;
        const selected = total - cpDeselected.size;
        line.innerHTML = `<i class="fas fa-bullseye"></i> <b>${selected}</b> de ${total} lead(s) selecionado(s) <i class="fas fa-chevron-${cpListOpen ? 'up' : 'down'} cp-target-chevron"></i>`;
        cpTargetCount = selected;
        document.getElementById('cSubmit').disabled = !selected;
    }

    function updatePreview() {
        const raw = document.getElementById('cMessage').value.trim();
        const text = raw ? raw.replace(/\{nome\}/g, 'Maria') : 'Olá! Você pediu uma simulação de crédito...';
        document.getElementById('cp-preview-text').textContent = text;
    }

    function setEditMode(isEdit) {
        document.querySelectorAll('.cp-create-only').forEach(el => el.style.display = isEdit ? 'none' : '');
        document.getElementById('cFiltersLockedNote').style.display = isEdit ? '' : 'none';
        document.getElementById('cEditorEyebrow').textContent = isEdit ? 'EDITAR CAMPANHA' : 'NOVA CAMPANHA';
        document.getElementById('cEditorTitle').textContent = isEdit ? 'EDITAR DISPARO' : 'CRIAR DISPARO EM MASSA';
        document.getElementById('cSubmit').innerHTML = isEdit ? '<i class="fas fa-save"></i> Salvar' : '<i class="fas fa-save"></i> Criar';
        document.getElementById('cSubmit').disabled = false;
    }

    function openEditor(opts = {}) {
        editingId = null;
        document.getElementById('cEditId').value = '';
        setEditMode(false);
        document.getElementById('campaignForm').reset();
        cpListOpen = false;
        cpListLoaded = false;
        cpDeselected.clear();
        cpTargetLeads = [];
        document.getElementById('cTargetListWrap').hidden = true;
        document.querySelectorAll('#cStatusChecks input').forEach(input => input.closest('.cp-check')?.classList.toggle('on', input.checked));
        document.getElementById('campaignEditorModal').style.display = 'flex';
        document.getElementById('cMessage').value = opts.message || 'Olá {nome}! Você pediu uma simulação de crédito. Posso pedir para um vendedor encaminhar? Responda SIM para continuar.';
        if (opts.name) document.getElementById('cName').value = opts.name;
        if (opts.origem) document.getElementById('cOrigem').value = opts.origem;
        if (opts.prioridade) document.getElementById('cPrioridade').value = opts.prioridade;
        if (opts.cidade) document.getElementById('cCidade').value = opts.cidade;
        if (opts.limit) document.getElementById('cLimit').value = opts.limit;

        const hasAdvanced = !!(opts.origem || opts.prioridade || opts.cidade || opts.limit);
        document.getElementById('cAdvancedRow').hidden = !hasAdvanced;
        document.getElementById('cAdvancedToggle').innerHTML = hasAdvanced
            ? '<i class="fas fa-chevron-up"></i> Ocultar filtros extras'
            : '<i class="fas fa-sliders"></i> Mais filtros (origem, prioridade, cidade, limite)';

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
        updatePreview();
        loadTemplates();
        loadNumbers();
        refreshTargetCount();
    }

    function closeEditor() {
        document.getElementById('campaignEditorModal').style.display = 'none';
    }

    function editCampaign(id) {
        const c = allCampaigns.find(x => x.id === id);
        if (!c) return;
        editingId = id;
        document.getElementById('cEditId').value = id;
        setEditMode(true);
        document.getElementById('campaignForm').reset();
        document.getElementById('campaignEditorModal').style.display = 'flex';
        document.getElementById('cName').value = c.name;
        document.getElementById('cMessage').value = c.message || '';
        updatePreview();
        loadTemplates();
    }

    async function deleteCampaignUI(id) {
        const c = allCampaigns.find(x => x.id === id);
        if (!confirm(`Excluir a campanha "${c ? c.name : id}"? Esta ação não pode ser desfeita.`)) return;
        try {
            await api(`/campaigns/${id}`, { method: 'DELETE' });
            toast('Campanha excluída');
            load();
        } catch (e) { toast(e.message, 'err'); }
    }

    document.getElementById('btn-new-campaign').onclick = () => openEditor();
    document.getElementById('btn-close-campaign-editor').onclick = closeEditor;
    document.getElementById('btn-cancel-campaign').onclick = closeEditor;
    document.getElementById('campaignEditorModal').addEventListener('click', e => { if (e.target.id === 'campaignEditorModal') closeEditor(); });

    document.getElementById('cTemplate').addEventListener('change', e => {
        const t = templates.find(x => x.id === Number(e.target.value));
        if (t) { document.getElementById('cMessage').value = t.body; updatePreview(); }
    });
    document.getElementById('cMessage').addEventListener('input', updatePreview);

    document.querySelectorAll('#cStatusChecks input').forEach(i =>
        i.addEventListener('change', () => {
            i.closest('.cp-check').classList.toggle('on', i.checked);
            refreshTargetCount();
        })
    );
    ['cOrigem', 'cPrioridade', 'cCidade', 'cLimit'].forEach(id =>
        document.getElementById(id).addEventListener('input', refreshTargetCount)
    );

    document.getElementById('cAdvancedToggle').onclick = () => {
        const row = document.getElementById('cAdvancedRow');
        row.hidden = !row.hidden;
        document.getElementById('cAdvancedToggle').innerHTML = row.hidden
            ? '<i class="fas fa-sliders"></i> Mais filtros (origem, prioridade, cidade, limite)'
            : '<i class="fas fa-chevron-up"></i> Ocultar filtros extras';
    };

    document.getElementById('cTargetLine').addEventListener('click', async () => {
        if (!cpTargetCount) return;
        cpListOpen = !cpListOpen;
        document.getElementById('cTargetListWrap').hidden = !cpListOpen;
        if (cpListOpen && !cpListLoaded) await loadTargetList();
        updateSelectedCountLabel();
    });

    document.getElementById('cTargetList').addEventListener('change', e => {
        const cb = e.target.closest('input[data-lead-id]');
        if (!cb) return;
        const id = Number(cb.dataset.leadId);
        if (cb.checked) cpDeselected.delete(id); else cpDeselected.add(id);
        cb.closest('.cp-target-item').classList.toggle('off', !cb.checked);
        updateSelectedCountLabel();
    });

    document.getElementById('cTargetSelAll').onclick = () => { cpDeselected.clear(); renderTargetList(); updateSelectedCountLabel(); };
    document.getElementById('cTargetSelNone').onclick = () => { cpTargetLeads.forEach(l => cpDeselected.add(l.id)); renderTargetList(); updateSelectedCountLabel(); };

    document.getElementById('campaignForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const submit = document.getElementById('cSubmit');
        submit.disabled = true;
        try {
            if (editingId) {
                await api(`/campaigns/${editingId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        name: document.getElementById('cName').value.trim(),
                        message: document.getElementById('cMessage').value.trim()
                    })
                });
                toast('Campanha atualizada!');
            } else {
                if (cpTargetCount === 0) { toast('Nenhum lead corresponde aos filtros', 'err'); submit.disabled = false; return; }
                const scheduleRaw = document.getElementById('cScheduleAt').value;
                const scheduled_at = scheduleRaw ? new Date(scheduleRaw).toISOString().slice(0, 19).replace('T', ' ') : null;
                const lead_ids = cpListLoaded
                    ? cpTargetLeads.filter(l => !cpDeselected.has(l.id)).map(l => l.id)
                    : null;
                await api('/campaigns', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: document.getElementById('cName').value.trim(),
                        message: document.getElementById('cMessage').value.trim(),
                        number_ids: document.getElementById('cNumber').value ? [Number(document.getElementById('cNumber').value)] : [],
                        filters: currentFilters(),
                        scheduled_at,
                        lead_ids,
                        template_id: document.getElementById('cTemplate').value || null
                    })
                });
                toast(scheduled_at ? 'Campanha agendada!' : 'Campanha criada!');
            }
            closeEditor();
            load();
        } catch (err) { toast(err.message, 'err'); }
        submit.disabled = false;
    });

    document.getElementById('campaignsList').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const id = Number(btn.dataset.id);
        const act = btn.dataset.act;
        if (act === 'edit') return editCampaign(id);
        if (act === 'delete') return deleteCampaignUI(id);
        campaignAction(act, id);
    });

    async function campaignAction(act, id) {
        try {
            let r;
            if (act === 'start') r = await api(`/campaigns/${id}/start`, { method: 'POST' });
            else if (act === 'pause') { await api(`/campaigns/${id}/pause`, { method: 'POST' }); r = { message: 'Campanha pausada' }; }
            else if (act === 'retry') r = await api(`/campaigns/${id}/retry`, { method: 'POST' });
            else if (act === 'cancel') { await api(`/campaigns/${id}/cancel`, { method: 'POST' }); r = { message: 'Campanha cancelada' }; }
            toast(r.message || 'OK');
            load();
        } catch (e) { toast(e.message, 'err'); }
    }

    document.getElementById('cp-search').addEventListener('input', renderList);
    document.getElementById('cp-filter-status').addEventListener('change', renderList);

    await load();
    _timer = setInterval(load, 3000); // progresso ao vivo

    return { openEditor };
}

export async function destroy() {
    clearInterval(_timer);
    _timer = null;
}
