const STAGES = [
    { key: 'novo', label: 'NOVO', color: '#3b82f6', dark: false },
    { key: 'contato', label: 'EM CONTATO', color: '#ffbd16', dark: true },
    { key: 'confirmado', label: 'CONFIRMADO', color: '#ff7417', dark: false },
    { key: 'concluido', label: 'CONCLUÍDO', color: '#10b981', dark: false }
];

let popupSearchTimer = null;

const TRANSITIONS = [
    { from: 'novo', to: 'contato', key: 'novo_contato' },
    { from: 'contato', to: 'confirmado', key: 'contato_confirmado' },
    { from: 'confirmado', to: 'concluido', key: 'confirmado_concluido' }
];

// larguras geométricas: cada estágio = (1 - 2*taper) do anterior → os trapézios se encaixam
const TAPER = 0.08;
const TAPER_PCT = (TAPER * 100).toFixed(1) + '%';

const nf = n => Number(n || 0).toLocaleString('pt-BR');

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function scoreCls(s) { return s == null ? 's-low' : (s >= 70 ? 's-high' : s >= 50 ? 's-mid' : 's-low'); }

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

export async function init() {
    const api = window.api;
    let data = null;
    let activeStage = null;

    async function load() {
        const refresh = document.getElementById('fl-refresh');
        refresh.classList.add('spinning');
        try {
            data = await api('/leads/funnel');
            render();
        } catch (e) {
            document.getElementById('fl-column').innerHTML = `<div class="fl-empty-note">Erro ao carregar: ${e.message}</div>`;
        } finally {
            setTimeout(() => refresh.classList.remove('spinning'), 600);
        }
    }

    function render() {
        const { stages, total, conversoes } = data;

        setText('fl-total', nf(total));
        setText('fl-hoje', nf(data.hoje));
        setText('fl-envios', nf(data.envios));
        setText('fl-taxa', data.taxa_global + '%');

        // ----- funil -----
        const column = document.getElementById('fl-column');
        if (total === 0) {
            column.innerHTML = '<div class="fl-empty-note">Nenhum lead no funil ainda.<br>Cadastre leads para ver a conversão.</div>';
        } else {
            column.innerHTML = STAGES.map((s, i) => {
                const count = stages[s.key] || 0;
                const width = (Math.pow(1 - 2 * TAPER, i) * 100).toFixed(1);
                const pct = Math.round((count / total) * 100);
                const color = s.color;
                const txt = s.dark ? 'var(--ink)' : '#fff';
                const chip = TRANSITIONS[i] ? renderChip(conversoes[TRANSITIONS[i].key], i) : '';
                return `
                <div class="fl-seg-wrap ${activeStage === s.key ? 'active' : ''}" data-stage="${s.key}" style="width:${width}%">
                    <div class="fl-seg" style="--t:${TAPER_PCT}; background:${color}; color:${txt};" title="Clique para ver os leads deste estágio">
                        <span class="fl-seg-label">${s.label}</span>
                        <span class="fl-seg-count">${nf(count)}</span>
                        <span class="fl-seg-right">
                            <span class="fl-seg-pct">${pct}% DO FUNIL</span>
                            <span class="fl-seg-cta"><i class="fas fa-arrow-up-right-from-square"></i> VER</span>
                        </span>
                    </div>
                    ${chip}
                </div>`;
            }).join('');
        }

        // ----- legenda -----
        document.getElementById('fl-legend').innerHTML =
            STAGES.map(s => `
                <span class="fl-legend-item"><span class="fl-legend-dot" style="background:${s.color};"></span> ${s.label}</span>`).join('')
            + (data.descartados > 0 ? `<span class="fl-legend-item"><span class="fl-legend-dot" style="background:#999;"></span> ${nf(data.descartados)} descartados</span>` : '');

        // ----- painel -----
        renderDetail();
        renderBottleneck();

        // ----- interação -----
        document.querySelectorAll('.fl-seg-wrap').forEach(seg => {
            seg.addEventListener('click', () => openStagePopup(seg.dataset.stage));
        });
        document.querySelectorAll('.fl-detail-row').forEach(row => {
            row.addEventListener('click', () => openStagePopup(row.dataset.stage));
        });
    }

    function renderChip(pct, i) {
        if (pct === undefined) return '';
        const ok = pct >= 50;
        const loss = 100 - pct;
        return `<span class="fl-chip ${ok ? '' : 'bad'}">${ok ? 'descida ' + pct + '%' : 'perda ' + loss + '%'} <i class="fas fa-arrow-down"></i></span>`;
    }

    function renderDetail() {
        const { stages, total, conversoes } = data;
        const rows = STAGES.map((s, i) => {
            const count = stages[s.key] || 0;
            const pct = total ? Math.round((count / total) * 100) : 0;
            const trans = TRANSITIONS[i];
            const nextPct = trans ? (conversoes[trans.key] ?? '-') + '%' : '—';
            return `
                <div class="fl-detail-row ${activeStage === s.key ? 'active' : ''}" data-stage="${s.key}">
                    <span class="fl-detail-dot" style="background:${s.color};"></span>
                    <div>
                        <span class="fl-detail-name">${s.label}</span>
                        <span class="fl-detail-sub">${pct}% do funil • p/ próximo: ${nextPct}</span>
                    </div>
                    <div class="fl-detail-count"><b>${nf(count)}</b><span>LEADS</span></div>
                </div>`;
        }).join('');
        document.getElementById('fl-detail').innerHTML = rows;
    }

    function renderBottleneck() {
        const el = document.getElementById('fl-bottleneck');
        const { stages, conversoes } = data;
        let worst = null;
        for (const t of TRANSITIONS) {
            const from = stages[t.from] || 0;
            const to = stages[t.to] || 0;
            const pct = conversoes[t.key] || 0;
            const loss = from > 0 ? 100 - pct : 0;
            if (from > 0 && (!worst || loss > worst.loss)) {
                worst = { t, loss };
            }
        }
        if (!worst || worst.loss <= 0) {
            el.classList.add('hidden');
            el.innerHTML = '';
            return;
        }
        el.classList.remove('hidden');
        const from = STAGES.find(s => s.key === worst.t.from);
        const to = STAGES.find(s => s.key === worst.t.to);
        el.innerHTML = `
            <span class="fl-bn-tag">GARGALO</span>
            <p>A maior perda está em <b>${from.label} → ${to.label}</b>: <b>${worst.loss}%</b> dos leads não avançam deste estágio. Foque em qualificar melhor a entrada dele.</p>`;
    }

    // ================= POPUP DE LEADS DO ESTÁGIO =================
    let popupStage = 'novo';

    function openStagePopup(key) {
        popupStage = key;
        activeStage = key;
        document.querySelectorAll('.fl-seg-wrap, .fl-detail-row').forEach(el => {
            el.classList.toggle('active', el.dataset.stage === activeStage);
        });
        const s = STAGES.find(x => x.key === key);
        document.getElementById('flp-label').textContent = s.label;
        document.getElementById('flp-dot').style.background = s.color;
        resetPopupFilters();
        document.getElementById('flpOverlay').style.display = 'flex';
        loadPopup();
    }

    function resetPopupFilters() {
        ['flp-search', 'flp-cidade', 'flp-de', 'flp-ate'].forEach(id => document.getElementById(id).value = '');
        ['flp-origem', 'flp-prio', 'flp-score'].forEach(id => document.getElementById(id).value = '');
    }

    function popupParams() {
        const p = { status: popupStage };
        const v = id => document.getElementById(id).value.trim();
        const s = v('flp-search'); if (s) p.search = s;
        const o = v('flp-origem'); if (o) p.origem = o;
        const pr = v('flp-prio'); if (pr) p.prioridade = pr;
        const sc = v('flp-score'); if (sc) p.score_min = sc;
        const c = v('flp-cidade'); if (c) p.cidade = c;
        const de = v('flp-de'); if (de) p.data_de = de;
        const ate = v('flp-ate'); if (ate) p.data_ate = ate;
        return p;
    }

    async function loadPopup() {
        const list = document.getElementById('flp-list');
        list.innerHTML = '<div class="ps-loading"><i class="fas fa-spinner fa-spin"></i> Carregando leads...</div>';
        try {
            const leads = await api('/leads?' + new URLSearchParams(popupParams()));
            renderPopup(leads);
        } catch (e) {
            list.innerHTML = `<div class="ps-empty" style="color:var(--bad);">${e.message}</div>`;
        }
    }

    function renderPopup(leads) {
        const list = document.getElementById('flp-list');
        const totalEl = document.getElementById('flp-total');
        totalEl.textContent = `${leads.length} lead${leads.length !== 1 ? 's' : ''}`;

        // resumo do estágio
        const hoje = leads.filter(l => (l.created_at || '').slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
        const comLimite = leads.filter(l => l.limite_est).length;
        const somaScore = leads.reduce((a, l) => a + (l.score || 0), 0);
        const scoreMedio = leads.length ? Math.round(somaScore / leads.length) : 0;
        document.getElementById('flp-summary').innerHTML = `
            <span><b>${nf(leads.length)}</b> NO ESTÁGIO</span>
            <span><b>${nf(hoje)}</b> HOJE</span>
            <span><b>${nf(comLimite)}</b> COM LIMITE</span>
            <span><b>${scoreMedio}</b> SCORE MÉDIO</span>`;

        if (!leads.length) {
            list.innerHTML = '<div class="ps-empty"><i class="fas fa-inbox"></i>Nenhum lead neste estágio com os filtros atuais.</div>';
            return;
        }
        list.innerHTML = leads.map(popupCard).join('');
    }

    function popupCard(l) {
        const score = l.score == null ? '—' : l.score;
        const init = (l.name || ' ').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
        const lim = l.limite_est ? `<span class="flp-chip limite">R$ ${escapeHtml(l.limite_est)}</span>` : '';
        return `
        <article class="flp-card pri-${l.prioridade || 'media'}" data-id="${l.id}">
            <span class="flp-avatar">${escapeHtml(init)}</span>
            <div class="flp-main">
                <strong>${escapeHtml(l.name)}</strong>
                <span>${escapeHtml(l.phone)}${l.city ? ' • ' + escapeHtml(l.city) : ''} <i class="far fa-clock"></i> ${relTime(l.created_at)}</span>
                <div class="flp-chips">
                    <span class="flp-chip origem">${escapeHtml(l.origem || '—')}</span>
                    ${lim}
                </div>
            </div>
            <span class="flp-score ${scoreCls(l.score)}" title="Score do lead"><i class="fas fa-bolt"></i> ${score}</span>
            <div class="flp-actions">
                <button type="button" class="ps-icon-btn start" data-act="confirmar" title="Confirmar"><i class="fas fa-check"></i></button>
                <button type="button" class="ps-icon-btn danger" data-act="bloquear" title="Bloquear"><i class="fas fa-ban"></i></button>
            </div>
        </article>`;
    }

    // controles do popup
    document.getElementById('flp-close').onclick = () => document.getElementById('flpOverlay').style.display = 'none';
    document.getElementById('flp-done').onclick = () => document.getElementById('flpOverlay').style.display = 'none';
    document.getElementById('flpOverlay').addEventListener('click', e => { if (e.target.id === 'flpOverlay') e.target.style.display = 'none'; });
    document.getElementById('flp-clear').onclick = () => { resetPopupFilters(); loadPopup(); };
    document.getElementById('flp-search').addEventListener('input', () => {
        clearTimeout(popupSearchTimer);
        popupSearchTimer = setTimeout(loadPopup, 300);
    });
    ['flp-origem', 'flp-prio', 'flp-score', 'flp-cidade', 'flp-de', 'flp-ate'].forEach(id => {
        document.getElementById(id).addEventListener('change', loadPopup);
    });
    document.getElementById('flp-list').addEventListener('click', async e => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const id = Number(btn.closest('.flp-card').dataset.id);
        const act = btn.dataset.act;
        try {
            if (act === 'confirmar') {
                await api(`/leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'confirmado' }) });
                toast('Lead confirmado');
            } else if (act === 'bloquear') {
                if (!confirm('Bloquear este lead?')) return;
                await api(`/leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'bloqueado' }) });
                toast('Lead bloqueado', 'info');
            }
            loadPopup();
            load();
        } catch (err) { toast(err.message, 'err'); }
    });

    function setText(id, v) {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
    }

    document.getElementById('fl-refresh').onclick = load;
    await load();
    return {};
}

export async function destroy() {
    clearTimeout(popupSearchTimer);
}
