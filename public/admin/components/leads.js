const STATUS_LABEL = {
    novo: 'NOVO', contato: 'EM CONTATO', confirmado: 'CONFIRMADO',
    concluido: 'CONCLUÍDO', bloqueado: 'BLOQUEADO', duplicado: 'DUPLICADO'
};

const COLUMNS = [
    { status: 'novo', label: 'NOVO', color: 'var(--info)' },
    { status: 'contato', label: 'EM CONTATO', color: 'var(--secondary)' },
    { status: 'confirmado', label: 'CONFIRMADO', color: 'var(--primary)' },
    { status: 'concluido', label: 'CONCLUÍDO', color: 'var(--ok)' },
    { status: 'bloqueado', label: 'BLOQUEADOS', color: 'var(--bad)' }
];

let _ctpTimer = null;

export async function init() {
    const api = window.api;
    const toast = window.toast;
    let LEADS = [];

    const initials = n => n.split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
    const colOf = st => (st === 'duplicado') ? 'bloqueado' : st;

    function relTime(utc) {
        const d = new Date((utc || '').replace(' ', 'T') + 'Z');
        if (isNaN(d)) return '';
        const s = (Date.now() - d) / 1000;
        if (s < 60) return 'agora';
        const m = s / 60;
        if (m < 60) return Math.floor(m) + 'min';
        const h = m / 60;
        if (h < 24) return Math.floor(h) + 'h';
        const days = h / 24;
        if (days < 7) return Math.floor(days) + 'd';
        return d.toLocaleDateString('pt-BR');
    }

    function scoreCls(s) { return s == null ? 's-low' : (s >= 70 ? 's-high' : s >= 50 ? 's-mid' : 's-low'); }

    function applyFilters() {
        const search = document.getElementById('kbx-search').value.trim().toLowerCase();
        const origem = document.getElementById('kbx-origem').value;
        const prio = document.getElementById('kbx-prio').value;
        const scoreMin = document.getElementById('kbx-score').value ? Number(document.getElementById('kbx-score').value) : null;
        return LEADS.filter(l => {
            if (origem && l.origem !== origem) return false;
            if (prio && l.prioridade !== prio) return false;
            if (scoreMin !== null && (l.score ?? 0) < scoreMin) return false;
            if (search && !(l.name + ' ' + l.phone + ' ' + (l.city || '')).toLowerCase().includes(search)) return false;
            return true;
        });
    }

    function cardHtml(l) {
        const score = l.score == null ? '—' : l.score;
        const scoreIcon = (l.score ?? 0) >= 70 ? '<i class="fas fa-bolt"></i> ' : '';
        return `
        <article class="kbx-card pri-${l.prioridade || 'media'}" draggable="true" data-id="${l.id}">
            <div class="kbx-card-top">
                <span class="kbx-avatar">${initials(l.name)}</span>
                <div class="kbx-idx">
                    <strong>${l.name}</strong>
                    <span>${l.phone}${l.city ? ' • ' + l.city : ''}</span>
                </div>
            </div>
            <div class="kbx-chips">
                <span class="kbx-score ${scoreCls(l.score)}" title="Score do lead">${scoreIcon}${score}</span>
                <span class="kbx-chip origem">${l.origem}</span>
                ${l.limite_est ? `<span class="kbx-chip limite">${l.limite_est}</span>` : ''}
            </div>
            <div class="kbx-foot">
                <span class="kbx-date"><i class="far fa-clock"></i> ${relTime(l.created_at)}</span>
                <div class="kbx-actions">
                    <button type="button" class="ps-icon-btn start" data-act="confirmar" title="Confirmar"><i class="fas fa-check"></i></button>
                    <button type="button" class="ps-icon-btn danger" data-act="bloquear" title="Bloquear"><i class="fas fa-ban"></i></button>
                </div>
            </div>
        </article>`;
    }

    function render() {
        const list = applyFilters();
        document.getElementById('kbx-total').textContent = `${list.length} lead${list.length !== 1 ? 's' : ''}`;
        const board = document.getElementById('kbx-board');
        board.innerHTML = COLUMNS.map(col => {
            const cards = list.filter(l => colOf(l.status) === col.status);
            return `
            <section class="kbx-col" data-status="${col.status}">
                <header class="kbx-col-head">
                    <span class="kbx-col-dot" style="background:${col.color};"></span>
                    <h3>${col.label}</h3>
                    <button type="button" class="kbx-gear" data-tools="${col.status}" title="Ferramentas da coluna"><i class="fas fa-gear"></i></button>
                    <span class="kbx-col-count">${cards.length}</span>
                </header>
                <div class="kbx-col-body">
                    ${cards.length ? cards.map(cardHtml).join('') : `<div class="kbx-empty"><i class="fas fa-inbox"></i><br>Arraste um lead para cá</div>`}
                </div>
            </section>`;
        }).join('');
        bindColumns(board);
    }

    function bindColumns(board) {
        board.querySelectorAll('.kbx-col-body').forEach(body => {
            body.addEventListener('dragover', e => { e.preventDefault(); body.classList.add('drop-over'); });
            body.addEventListener('dragleave', () => body.classList.remove('drop-over'));
            body.addEventListener('drop', async e => {
                e.preventDefault();
                body.classList.remove('drop-over');
                const id = Number(e.dataTransfer.getData('text/plain'));
                const status = body.closest('.kbx-col').dataset.status;
                const lead = LEADS.find(l => l.id === id);
                if (!lead || colOf(lead.status) === status) return;

                const target = e.target.closest('.kbx-card');
                const oldStatus = lead.status;
                lead.status = status;

                const card = board.querySelector(`.kbx-card[data-id="${id}"]`);
                if (card) card.remove();
                const empty = body.querySelector('.kbx-empty');
                if (empty) empty.remove();
                body.insertBefore(cardElement(lead), target);
                if (!body.children.length) body.innerHTML = `<div class="kbx-empty"><i class="fas fa-inbox"></i><br>Arraste um lead para cá</div>`;
                updateCounts(board);

                try {
                    await api(`/leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
                    if (status === 'bloqueado') toast('Lead bloqueado', 'info');
                    else toast(`Movido para ${STATUS_LABEL[status]}`);
                    refresh();
                } catch (err) {
                    lead.status = oldStatus;
                    toast(err.message, 'err');
                    refresh();
                }
            });
        });
    }

    function cardElement(l) {
        const el = document.createElement('div');
        el.innerHTML = cardHtml(l).trim();
        return el.firstChild;
    }

    function updateCounts(board) {
        board.querySelectorAll('.kbx-col').forEach(col => {
            col.querySelector('.kbx-col-count').textContent = col.querySelectorAll('.kbx-card').length;
        });
    }

    async function refresh() {
        try {
            LEADS = await api('/leads');
            render();
        } catch (e) {
            document.getElementById('kbx-board').innerHTML = `<div class="ps-empty" style="color:var(--bad); width:100%;">${e.message}</div>`;
        }
    }

    // ações rápidas (delegado no board)
    document.getElementById('kbx-board').addEventListener('click', async e => {
        const gear = e.target.closest('.kbx-gear');
        if (gear) { openColumnTools(gear.dataset.tools); return; }
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const card = btn.closest('.kbx-card');
        const id = Number(card.dataset.id);
        const act = btn.dataset.act;
        if (act === 'confirmar') {
            try {
                await api(`/leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'confirmado' }) });
                toast('Lead confirmado');
            } catch (err) { toast(err.message, 'err'); }
        } else if (act === 'bloquear') {
            if (!confirm('Bloquear este lead?')) return;
            try {
                await api(`/leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'bloqueado' }) });
                toast('Lead bloqueado', 'info');
            } catch (err) { toast(err.message, 'err'); }
        }
        refresh();
    });

    // drag de cards
    document.getElementById('kbx-board').addEventListener('dragstart', e => {
        const card = e.target.closest('.kbx-card');
        if (!card) return;
        e.dataTransfer.setData('text/plain', card.dataset.id);
        card.classList.add('dragging');
    });
    document.getElementById('kbx-board').addEventListener('dragend', e => {
        const card = e.target.closest('.kbx-card');
        if (card) card.classList.remove('dragging');
    });

    document.getElementById('kbx-reload').onclick = refresh;
    document.getElementById('kbx-search').addEventListener('input', () => render());
    document.getElementById('kbx-origem').addEventListener('change', () => render());
    document.getElementById('kbx-prio').addEventListener('change', () => render());
    document.getElementById('kbx-score').addEventListener('change', () => render());

    // ================= FERRAMENTAS DE COLUNA =================
    const TOOLS_LABEL = { novo: 'NOVO', contato: 'EM CONTATO', confirmado: 'CONFIRMADO', concluido: 'CONCLUÍDO', bloqueado: 'BLOQUEADO', duplicado: 'DUPLICADO' };
    const DEFAULT_AUTO_MSG = 'Olá {nome}! Você pediu uma simulação de crédito. Posso pedir para um vendedor encaminhar? Responda SIM para continuar.';
    let toolsStatus = 'novo';
    let toolsConfig = {};
    let ctpJobId = null;
    let ctpRunning = false;

    async function loadNumbers() {
        try {
            const numbers = await api('/campaigns/numbers');
            document.getElementById('ctools-number').innerHTML =
                numbers.filter(n => n.status === 'ativo').map(n => `<option value="${n.id}">${n.number} (${n.messages_sent} enviadas)</option>`).join('')
                || '<option value="">Nenhum número ativo</option>';
        } catch (e) { console.error(e); }
    }

    async function loadStageConfig() {
        try { toolsConfig = await api('/tools/stage-config'); } catch (e) { toolsConfig = {}; }
    }

    function openColumnTools(status) {
        toolsStatus = status;
        document.getElementById('ctools-status').textContent = TOOLS_LABEL[status] || status.toUpperCase();
        const canSend = status === 'novo' || status === 'contato';
        document.getElementById('ctools-send-wrap').style.display = canSend ? '' : 'none';
        document.getElementById('ctools-msg').value = DEFAULT_AUTO_MSG;
        document.getElementById('ctools-limit').value = '';
        document.getElementById('ctools-move-limit').value = '';
        document.getElementById('ctools-recalc-limit').value = '';
        document.getElementById('ctools-to').value = status === 'novo' ? 'contato' : 'confirmado';
        const cfg = toolsConfig[status] || {};
        document.getElementById('ctools-auto').checked = !!cfg.auto_send;
        document.getElementById('ctools-auto-msg').value = cfg.message || DEFAULT_AUTO_MSG;
        syncAutoToggle();
        loadNumbers();
        document.getElementById('ctoolsOverlay').style.display = 'flex';
    }

    function syncAutoToggle() {
        const label = document.querySelector('.ctools-toggle');
        if (label) label.classList.toggle('on', document.getElementById('ctools-auto').checked);
    }

    function stopPolling() {
        ctpRunning = false;
        clearTimeout(_ctpTimer);
        _ctpTimer = null;
    }

    function runJob(job, title) {
        ctpJobId = job.id;
        document.getElementById('ctp-title').textContent = title;
        document.getElementById('ctoolsOverlay').style.display = 'none';
        document.getElementById('ctp-cancel').style.display = 'inline-flex';
        document.getElementById('ctp-done-btn').style.display = 'none';
        document.getElementById('ctp-log').style.display = 'none';
        document.getElementById('ctp-log').innerHTML = '';
        document.getElementById('ctoolsProgress').style.display = 'flex';
        stopPolling();
        ctpRunning = true;
        pollJob();
    }

    function pollJob() {
        clearTimeout(_ctpTimer);
        if (!ctpRunning) return;
        _ctpTimer = setTimeout(async () => {
            try {
                const job = await api(`/tools/jobs/${ctpJobId}`);
                renderJob(job);
                if (['done', 'failed', 'cancelled'].includes(job.status)) {
                    stopPolling();
                    document.getElementById('ctp-cancel').style.display = 'none';
                    document.getElementById('ctp-done-btn').style.display = 'inline-flex';
                    if (job.status === 'failed') toast(job.error || 'Ação falhou', 'err');
                    refresh();
                } else {
                    pollJob();
                }
            } catch (e) {
                pollJob();
            }
        }, 1500);
    }

    function renderJob(job) {
        const p = job.payload || {};
        const done = p.done || 0;
        const total = p.total || 0;
        const ok = p.ok != null ? p.ok : (p.changed != null ? p.changed : done);
        const fail = p.fail || 0;
        const pct = total ? Math.round(done / total * 100) : (job.status === 'running' ? 5 : 0);
        document.getElementById('ctp-fill').style.width = pct + '%';
        document.getElementById('ctp-done').textContent = done;
        document.getElementById('ctp-total').textContent = total;
        document.getElementById('ctp-ok').textContent = ok;
        document.getElementById('ctp-fail').textContent = fail;

        const statusEl = document.getElementById('ctp-status');
        statusEl.className = 'ctp-status ' + (job.status === 'failed' ? 'failed' : job.status === 'done' ? 'done' : job.status === 'cancelled' ? 'cancelled' : '');
        statusEl.innerHTML = job.status === 'running' ? '<i class="fas fa-spinner fa-spin"></i> PROCESSANDO...'
            : job.status === 'waiting' ? '<i class="fas fa-hourglass-half"></i> AGUARDANDO NA FILA...'
            : job.status === 'done' ? `<i class="fas fa-check-circle"></i> CONCLUÍDO — ${ok} ok${fail ? `, ${fail} falha(s)` : ''}`
            : job.status === 'failed' ? `<i class="fas fa-xmark-circle"></i> FALHOU: ${job.error || ''}`
            : '<i class="fas fa-ban"></i> CANCELADO';

        const log = document.getElementById('ctp-log');
        if (Array.isArray(p.log) && p.log.length) {
            log.style.display = 'flex';
            log.innerHTML = p.log.slice(-15).map(x =>
                `<div class="ctp-log-item ${x.ok ? 'ok' : 'fail'}"><i class="fas ${x.ok ? 'fa-circle-check' : 'fa-circle-xmark'}"></i><span>${x.label}</span></div>`
            ).join('');
        } else {
            log.style.display = 'none';
        }
    }

    document.getElementById('ctools-close').onclick = () => document.getElementById('ctoolsOverlay').style.display = 'none';
    document.getElementById('ctoolsOverlay').addEventListener('click', e => { if (e.target.id === 'ctoolsOverlay') e.target.style.display = 'none'; });
    document.getElementById('ctp-close').onclick = () => { stopPolling(); document.getElementById('ctoolsProgress').style.display = 'none'; };
    document.getElementById('ctp-done-btn').onclick = () => { stopPolling(); document.getElementById('ctoolsProgress').style.display = 'none'; };
    document.getElementById('ctp-cancel').onclick = async () => {
        try {
            const job = await api(`/tools/jobs/${ctpJobId}`);
            if (job.type === 'campaign_run' && job.ref_id) {
                await api(`/campaigns/${job.ref_id}/pause`, { method: 'POST' });
            }
            await api(`/tools/jobs/${ctpJobId}/cancel`, { method: 'POST' });
            toast('Ação cancelada', 'info');
            stopPolling();
            renderJob({ status: 'cancelled', payload: null });
            refresh();
        } catch (e) { toast(e.message, 'err'); }
    };
    document.getElementById('ctools-auto').addEventListener('change', syncAutoToggle);

    document.getElementById('ctools-save-auto').onclick = async () => {
        const cfg = {
            auto_send: document.getElementById('ctools-auto').checked,
            message: document.getElementById('ctools-auto-msg').value.trim()
        };
        try {
            await api('/tools/stage-config', { method: 'PUT', body: JSON.stringify({ status: toolsStatus, config: cfg }) });
            toolsConfig[toolsStatus] = cfg;
            toast('Configuração da coluna salva!');
        } catch (e) { toast(e.message, 'err'); }
    };

    document.getElementById('ctools-send').onclick = async () => {
        const message = document.getElementById('ctools-msg').value.trim();
        if (!message) return toast('Digite a mensagem', 'err');
        const body = { status: toolsStatus, message };
        const lim = document.getElementById('ctools-limit').value;
        if (lim) body.limit = Number(lim);
        const num = document.getElementById('ctools-number').value;
        if (num) body.number_id = Number(num);
        try {
            const r = await api('/tools/send', { method: 'POST', body: JSON.stringify(body) });
            toast(`Campanha criada (${r.campaign.total_target} alvo${r.campaign.total_target !== 1 ? 's' : ''})`);
            if (r.job_id) runJob({ id: r.job_id }, 'DISPARANDO MENSAGEM');
            else refresh();
        } catch (e) { toast(e.message, 'err'); }
    };

    document.getElementById('ctools-move').onclick = async () => {
        const to_status = document.getElementById('ctools-to').value;
        if (to_status === toolsStatus) return toast('Escolha um estágio diferente', 'err');
        const body = { status: toolsStatus, to_status };
        const lim = document.getElementById('ctools-move-limit').value;
        if (lim) body.limit = Number(lim);
        if (!confirm(`Mover os leads desta coluna para ${TOOLS_LABEL[to_status]}?`)) return;
        try {
            const r = await api('/tools/move', { method: 'POST', body: JSON.stringify(body) });
            runJob(r.job, 'MOVENDO LEADS');
        } catch (e) { toast(e.message, 'err'); }
    };

    document.getElementById('ctools-recalc').onclick = async () => {
        const body = { status: toolsStatus };
        const lim = document.getElementById('ctools-recalc-limit').value;
        if (lim) body.limit = Number(lim);
        try {
            const r = await api('/tools/recalc', { method: 'POST', body: JSON.stringify(body) });
            runJob(r.job, 'RECALCULANDO SCORE');
        } catch (e) { toast(e.message, 'err'); }
    };

    await loadStageConfig();
    await refresh();
    return {};
}

export async function destroy() {
    clearTimeout(_ctpTimer);
    _ctpTimer = null;
}
