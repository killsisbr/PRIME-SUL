const STAGES = [
    { key: 'novo', label: 'NOVO', color: '#3b82f6', dark: false, icon: 'fa-user-plus' },
    { key: 'contato', label: 'EM CONTATO', color: '#ffbd16', dark: true, icon: 'fa-phone-volume' },
    { key: 'confirmado', label: 'CONFIRMADO', color: '#ff7417', dark: false, icon: 'fa-circle-check' },
    { key: 'concluido', label: 'CONCLUÍDO', color: '#10b981', dark: false, icon: 'fa-trophy' }
];

const TRANSITIONS = [
    { from: 'novo', to: 'contato', key: 'novo_contato' },
    { from: 'contato', to: 'confirmado', key: 'contato_confirmado' },
    { from: 'confirmado', to: 'concluido', key: 'confirmado_concluido' }
];

const TAPER = 0.08;
const TAPER_PCT = (TAPER * 100).toFixed(1) + '%';

let drawerSearchTimer = null;
let activeStageKey = null;
let currentStageLeads = [];
let activeClientData = null;
let stageConfigs = {};
let availableNumbers = [];
let templates = [];
let automationJobTimer = null;

const nf = n => Number(n || 0).toLocaleString('pt-BR');
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function scoreCls(s) { return s == null ? 's-low' : (s >= 70 ? 's-high' : s >= 50 ? 's-mid' : 's-low'); }

function relTime(utc) {
    if (!utc) return '';
    const d = new Date(utc.replace(' ', 'T') + 'Z');
    if (isNaN(d)) return '';
    const s = (Date.now() - d) / 1000;
    if (s < 60) return 'agora mesmo';
    const m = s / 60;
    if (m < 60) return Math.floor(m) + ' min atrás';
    const h = m / 60;
    if (h < 24) return Math.floor(h) + ' h atrás';
    const days = h / 24;
    if (days < 7) return Math.floor(days) + ' d atrás';
    return d.toLocaleDateString('pt-BR');
}

// Helper seguro para chamadas do Anime.js
function runAnime(opts) {
    if (typeof window.anime === 'function') {
        return window.anime(opts);
    }
}

// Animação de contadores numéricos usando Anime.js
function animateCounter(elId, targetVal, suffix = '') {
    const el = document.getElementById(elId);
    if (!el) return;
    const isPercent = suffix === '%';
    const numericTarget = parseFloat(targetVal) || 0;
    const obj = { val: 0 };

    runAnime({
        targets: obj,
        val: numericTarget,
        round: isPercent ? 10 : 1,
        duration: 750,
        easing: 'easeOutExpo',
        update: () => {
            el.textContent = (isPercent ? Math.round(obj.val) : Math.round(obj.val).toLocaleString('pt-BR')) + suffix;
        }
    });
}

export async function init() {
    const api = window.api;
    const toast = window.toast;
    let funnelData = null;
    let userRole = 'operador';
    try { userRole = JSON.parse(localStorage.getItem('prime_sul_user') || '{}').role || 'operador'; } catch (e) {}

    // State de modo de exibição: 'funnel' ou 'crm'
    let activeViewMode = 'funnel';
    let crmSearchTimer = null;

    // Carregamento inicial de dados
    async function loadData() {
        const refreshBtn = document.getElementById('fl-refresh');
        if (refreshBtn) {
            runAnime({
                targets: refreshBtn.querySelector('i'),
                rotate: '1turn',
                duration: 600,
                easing: 'easeInOutCubic'
            });
        }

        try {
            const [funnel, configs, follows] = await Promise.all([
                api('/leads/funnel'),
                api('/tools/stage-config'),
                api('/tools/followups')
            ]);
            funnelData = funnel;
            stageConfigs = configs || {};
            renderReturns(follows || {});
            renderFunnel();
            if (activeViewMode === 'crm') loadCrmKanban();

            // Animação dos contadores do topo
            animateCounter('fl-total', funnel.total);
            animateCounter('fl-hoje', funnel.hoje);
            animateCounter('fl-envios', funnel.envios);
            animateCounter('fl-taxa', funnel.taxa_global, '%');
        } catch (e) {
            document.getElementById('fl-column').innerHTML = `<div class="fl-empty-note">Erro ao carregar funil: ${escapeHtml(e.message)}</div>`;
        }
    }

    // Alternância de visão com transição animada via Anime.js
    function toggleViewMode(targetMode) {
        if (activeViewMode === targetMode) return;

        const funnelView = document.getElementById('fl-view-funnel');
        const crmView = document.getElementById('fl-view-crm');
        const funnelBtn = document.getElementById('fl-mode-funnel');
        const crmBtn = document.getElementById('fl-mode-crm');

        const outgoingView = activeViewMode === 'funnel' ? funnelView : crmView;
        const incomingView = targetMode === 'funnel' ? funnelView : crmView;

        activeViewMode = targetMode;

        funnelBtn.classList.toggle('active', targetMode === 'funnel');
        crmBtn.classList.toggle('active', targetMode === 'crm');

        runAnime({
            targets: outgoingView,
            scale: [1, 0.94],
            opacity: [1, 0],
            duration: 220,
            easing: 'easeInCubic',
            complete: () => {
                outgoingView.style.display = 'none';
                incomingView.style.display = targetMode === 'funnel' ? 'grid' : 'flex';

                if (targetMode === 'crm') {
                    loadCrmKanban();
                }

                runAnime({
                    targets: incomingView,
                    translateY: [25, 0],
                    opacity: [0, 1],
                    scale: [0.97, 1],
                    duration: 380,
                    easing: 'easeOutCubic'
                });
            }
        });
    }

    // Renderização do CRM Kanban Board
    async function loadCrmKanban() {
        const boardEl = document.getElementById('fl-crm-board');
        if (!boardEl) return;
        boardEl.innerHTML = '<div class="fl-drawer-loading" style="grid-column:1/-1;"><i class="fas fa-spinner fa-spin"></i> Carregando Kanban do CRM...</div>';

        try {
            const search = (document.getElementById('fl-crm-search')?.value || '').trim();
            const prio = document.getElementById('fl-crm-prio')?.value || '';
            const params = {};
            if (search) params.search = search;
            if (prio) params.prioridade = prio;

            const leads = await api('/leads?' + new URLSearchParams(params));
            const countEl = document.getElementById('fl-crm-total-count');
            if (countEl) countEl.textContent = `${leads.length} lead${leads.length !== 1 ? 's' : ''} no CRM`;

            const grouped = { novo: [], contato: [], confirmado: [], concluido: [] };
            leads.forEach(l => {
                const st = (l.status || 'novo').toLowerCase();
                if (grouped[st]) grouped[st].push(l);
                else grouped.novo.push(l);
            });

            const AV_COLORS = ['av-blue', 'av-orange', 'av-green', 'av-dark', 'av-yellow'];

            boardEl.innerHTML = STAGES.map((s, stageIdx) => {
                const stageLeads = grouped[s.key] || [];
                const stageColor = s.color;

                const cardsHtml = stageLeads.length ? stageLeads.map(l => {
                    const init2 = (l.name || ' ').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                    const score = l.score == null ? '—' : l.score;
                    const limitChip = l.limite_est ? `<span class="fl-chip value">R$ ${escapeHtml(l.limite_est)}</span>` : '';

                    const prevStage = stageIdx > 0 ? STAGES[stageIdx - 1].key : null;
                    const nextStage = stageIdx < STAGES.length - 1 ? STAGES[stageIdx + 1].key : null;

                    return `
                    <article class="fl-crm-card pri-${l.prioridade || 'media'}" data-id="${l.id}">
                        <div class="fl-crm-card-top">
                            <span class="fl-client-av ${AV_COLORS[(l.id || 0) % AV_COLORS.length]}">${escapeHtml(init2)}</span>
                            <div class="fl-crm-card-main">
                                <div class="fl-crm-card-name">${escapeHtml(l.name)}</div>
                                <div class="fl-crm-card-sub">${escapeHtml(l.phone)}</div>
                            </div>
                            <span class="fl-client-score ${scoreCls(l.score)}"><i class="fas fa-bolt"></i> ${score}</span>
                        </div>
                        <div class="fl-crm-card-chips">
                            <span class="fl-chip origin">${escapeHtml(l.origem || '—')}</span>
                            ${limitChip}
                            ${l.city ? `<span class="fl-tag">${escapeHtml(l.city)}</span>` : ''}
                        </div>
                        <div class="fl-crm-card-actions">
                            ${prevStage ? `<button type="button" class="fl-crm-move-btn" data-move-to="${prevStage}" title="Recuar para ${prevStage.toUpperCase()}"><i class="fas fa-chevron-left"></i></button>` : '<span></span>'}
                            <button type="button" class="fl-btn-fiche"><i class="fas fa-id-card"></i> FICHA</button>
                            ${nextStage ? `<button type="button" class="fl-crm-move-btn" data-move-to="${nextStage}" title="Avançar para ${nextStage.toUpperCase()}"><i class="fas fa-chevron-right"></i></button>` : '<span></span>'}
                        </div>
                    </article>`;
                }).join('') : `<div class="fl-crm-empty-col"><i class="fas fa-inbox"></i> Ninguém nesta etapa</div>`;

                return `
                <div class="fl-crm-column" data-col-stage="${s.key}">
                    <div class="fl-crm-column-header" style="border-top-color:${stageColor};">
                        <div class="fl-crm-col-title">
                            <i class="fas ${s.icon}" style="color:${stageColor};"></i>
                            <strong>${s.label}</strong>
                        </div>
                        <span class="fl-crm-col-badge">${stageLeads.length}</span>
                    </div>
                    <div class="fl-crm-column-body">${cardsHtml}</div>
                </div>`;
            }).join('');

            // Animação staggered dos cards no Kanban via Anime.js
            runAnime({
                targets: '.fl-crm-card',
                translateY: [20, 0],
                opacity: [0, 1],
                delay: runAnime ? window.anime.stagger(30) : 0,
                duration: 350,
                easing: 'easeOutQuad'
            });

            // Handlers dos cards e movimentação no Kanban
            boardEl.querySelectorAll('.fl-crm-card').forEach(card => {
                card.addEventListener('click', e => {
                    const moveBtn = e.target.closest('[data-move-to]');
                    if (moveBtn) {
                        e.stopPropagation();
                        const targetStage = moveBtn.dataset.moveTo;
                        moveLeadCrm(card.dataset.id, targetStage);
                        return;
                    }
                    openClientModal(card.dataset.id);
                });
            });

        } catch (e) {
            boardEl.innerHTML = `<div class="fl-drawer-empty" style="grid-column:1/-1; color:var(--bad);"><i class="fas fa-exclamation-circle"></i> Erro no Kanban: ${escapeHtml(e.message)}</div>`;
        }
    }

    async function moveLeadCrm(leadId, targetStage) {
        try {
            await api(`/leads/${leadId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: targetStage })
            });
            toast(`Lead movido para ${targetStage.toUpperCase()}!`);
            await loadData();
            await loadCrmKanban();
        } catch (e) {
            toast(e.message, 'err');
        }
    }

    // Renderização dos Retornos de Hoje
    function renderReturns(follows) {
        const box = document.getElementById('fl-returns');
        const items = (follows.today || []).slice(0, 8);
        if (!items.length) {
            box.innerHTML = '<div class="fl-return-empty"><i class="fas fa-circle-check"></i> Nenhum retorno pendente para hoje.</div>';
            return;
        }
        box.innerHTML = items.map(f => {
            const overdue = new Date((f.due_at || '').replace(' ', 'T') + 'Z') < new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
            const initials = (f.name || ' ').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
            return `
            <div class="fl-return ${overdue ? 'overdue' : ''} pri-${f.prioridade || 'media'}" data-lead="${f.lead_id}" role="button" title="Abrir ficha do cliente">
                <span class="fl-return-avatar">${escapeHtml(initials)}</span>
                <div class="fl-return-main">
                    <strong>${escapeHtml(f.name)}</strong>
                    <span>${escapeHtml(f.phone)}</span>
                </div>
                <span class="fl-return-badge">${overdue ? 'ATRASADO' : 'HOJE'}</span>
            </div>`;
        }).join('');

        box.querySelectorAll('.fl-return').forEach(el => {
            el.addEventListener('click', () => openClientModal(el.dataset.lead));
        });
    }

    // Renderização Principal do Funil
    function renderFunnel() {
        const { stages, total, conversoes } = funnelData;
        const column = document.getElementById('fl-column');

        if (total === 0) {
            column.innerHTML = '<div class="fl-empty-note"><i class="fas fa-filter-circle-xmark"></i><br>Nenhum lead no funil ainda.<br>Cadastre leads para visualizar a conversão.</div>';
        } else {
            column.innerHTML = STAGES.map((s, i) => {
                const count = stages[s.key] || 0;
                const width = (Math.pow(1 - 2 * TAPER, i) * 100).toFixed(1);
                const pct = Math.round((count / total) * 100);
                const color = s.color;
                const txt = s.dark ? 'var(--ink)' : '#fff';
                const chip = TRANSITIONS[i] ? renderTransitionChip(conversoes[TRANSITIONS[i].key]) : '';
                const autoOn = !!stageConfigs[s.key]?.auto_send;
                const isActive = activeStageKey === s.key;

                return `
                <div class="fl-seg-wrap ${isActive ? 'active' : ''}" data-stage="${s.key}" style="width:${width}%">
                    <div class="fl-seg" style="--t:${TAPER_PCT}; background:${color}; color:${txt};" title="Clique para ver os clientes desta etapa">
                        <span class="fl-seg-fill" style="width:${pct}%;"></span>
                        <span class="fl-seg-icon"><i class="fas ${s.icon}"></i></span>
                        <span class="fl-seg-main">
                            <span class="fl-seg-label">${s.label}</span>
                            <span class="fl-seg-count">${nf(count)}</span>
                        </span>
                        <span class="fl-seg-right">
                            <span class="fl-seg-pct">${pct}% DO FUNIL</span>
                            <span class="fl-seg-cta"><i class="fas fa-users"></i> CLIENTES</span>
                        </span>
                        <button type="button" class="fl-tools-btn" data-tools-stage="${s.key}" title="Automações desta etapa">
                            <i class="fas ${autoOn ? 'fa-wand-magic-sparkles' : 'fa-gear'}"></i>
                        </button>
                    </div>
                    ${chip}
                </div>`;
            }).join('');

            // Animação de entrada dos segmentos do funil via Anime.js
            runAnime({
                targets: '.fl-seg-wrap',
                translateY: [35, 0],
                opacity: [0, 1],
                delay: runAnime ? window.anime.stagger(90) : 0,
                duration: 650,
                easing: 'easeOutElastic(1, .8)'
            });
        }

        // Renderiza legenda e detalhes do painel
        document.getElementById('fl-legend').innerHTML =
            STAGES.map(s => `<span class="fl-legend-item"><span class="fl-legend-dot" style="background:${s.color};"></span> ${s.label}</span>`).join('') +
            (funnelData.descartados > 0 ? `<span class="fl-legend-item"><span class="fl-legend-dot" style="background:#999;"></span> ${nf(funnelData.descartados)} descartados</span>` : '');

        renderDetail();
        renderBottleneck();

        // Handlers de interação no funil
        document.querySelectorAll('.fl-seg-wrap').forEach(seg => {
            seg.addEventListener('click', () => {
                const stage = seg.dataset.stage;
                // Efeito de pulso animado na fatia clicada
                runAnime({
                    targets: seg,
                    scale: [1, 1.04, 1],
                    duration: 300,
                    easing: 'easeInOutQuad'
                });
                openStageDrawer(stage);
            });
        });

        document.querySelectorAll('[data-tools-stage]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                openAutomationPopup(btn.dataset.toolsStage);
            });
        });

        document.querySelectorAll('.fl-detail-row').forEach(row => {
            row.addEventListener('click', () => openStageDrawer(row.dataset.stage));
        });
    }

    function renderTransitionChip(pct) {
        if (pct === undefined) return '';
        const ok = pct >= 50;
        const loss = 100 - pct;
        return `<span class="fl-chip ${ok ? '' : 'bad'}">${ok ? 'descida ' + pct + '%' : 'perda ' + loss + '%'} <i class="fas fa-arrow-down"></i></span>`;
    }

    function renderDetail() {
        const { stages, total, conversoes } = funnelData;
        const rows = STAGES.map((s, i) => {
            const count = stages[s.key] || 0;
            const pct = total ? Math.round((count / total) * 100) : 0;
            const trans = TRANSITIONS[i];
            const nextPct = trans ? (conversoes[trans.key] ?? '-') + '%' : '—';
            const isActive = activeStageKey === s.key;
            return `
                <div class="fl-detail-row ${isActive ? 'active' : ''}" data-stage="${s.key}">
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
        const { stages, conversoes } = funnelData;
        let worst = null;
        for (const t of TRANSITIONS) {
            const from = stages[t.from] || 0;
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
            <p>A maior perda está em <b>${from.label} → ${to.label}</b>: <b>${worst.loss}%</b> dos leads não avançam deste estágio. Foque em qualificar a entrada dele.</p>`;
    }

    // ================= DRAWER LATERAL DE CLIENTES (INFO LIST) =================
    async function openStageDrawer(stageKey) {
        activeStageKey = stageKey;
        const stageMeta = STAGES.find(s => s.key === stageKey) || { label: stageKey.toUpperCase(), color: '#3b82f6' };

        // Destaca a fatia ativa no funil
        document.querySelectorAll('.fl-seg-wrap, .fl-detail-row').forEach(el => {
            el.classList.toggle('active', el.dataset.stage === stageKey);
        });

        // Configura cabeçalho do Drawer
        const drawerBadge = document.getElementById('fl-drawer-badge');
        drawerBadge.textContent = stageMeta.label;
        drawerBadge.style.background = stageMeta.color;
        drawerBadge.style.color = stageMeta.dark ? 'var(--ink)' : '#fff';

        const drawer = document.getElementById('fl-drawer');
        const overviewPanel = document.getElementById('fl-overview-panel');

        // Transição com Anime.js: oculta o painel de resumo e exibe o drawer lateral deslizante
        overviewPanel.style.display = 'none';
        drawer.style.display = 'flex';

        runAnime({
            targets: drawer,
            translateX: ['100%', '0%'],
            opacity: [0, 1],
            duration: 450,
            easing: 'easeOutCubic'
        });

        // Limpa busca e carrega clientes do estágio
        document.getElementById('fl-drawer-search').value = '';
        document.getElementById('fl-drawer-prio').value = '';
        await loadDrawerClients();
    }

    function closeStageDrawer() {
        const drawer = document.getElementById('fl-drawer');
        const overviewPanel = document.getElementById('fl-overview-panel');

        runAnime({
            targets: drawer,
            translateX: ['0%', '100%'],
            opacity: [1, 0],
            duration: 320,
            easing: 'easeInCubic',
            complete: () => {
                drawer.style.display = 'none';
                overviewPanel.style.display = 'flex';
                activeStageKey = null;
                document.querySelectorAll('.fl-seg-wrap, .fl-detail-row').forEach(el => el.classList.remove('active'));

                runAnime({
                    targets: overviewPanel,
                    opacity: [0, 1],
                    translateY: [15, 0],
                    duration: 300,
                    easing: 'easeOutQuad'
                });
            }
        });
    }

    async function loadDrawerClients() {
        const listEl = document.getElementById('fl-drawer-clients');
        listEl.innerHTML = '<div class="fl-drawer-loading"><i class="fas fa-spinner fa-spin"></i> Carregando lista de clientes...</div>';

        try {
            const search = (document.getElementById('fl-drawer-search').value || '').trim();
            const prio = document.getElementById('fl-drawer-prio').value;
            const params = { status: activeStageKey };
            if (search) params.search = search;
            if (prio) params.prioridade = prio;

            const leads = await api('/leads?' + new URLSearchParams(params));
            currentStageLeads = leads;

            const countEl = document.getElementById('fl-drawer-count');
            countEl.textContent = `${leads.length} cliente${leads.length !== 1 ? 's' : ''} nesta etapa`;

            if (!leads.length) {
                listEl.innerHTML = `
                    <div class="fl-drawer-empty">
                        <i class="fas fa-users-slash"></i>
                        <p>Nenhum cliente encontrado na etapa <b>${activeStageKey.toUpperCase()}</b>.</p>
                    </div>`;
                return;
            }

            const AV_COLORS = ['av-blue', 'av-orange', 'av-green', 'av-dark', 'av-yellow'];

            listEl.innerHTML = leads.map(l => {
                const init2 = (l.name || ' ').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                const score = l.score == null ? '—' : l.score;
                const limitChip = l.limite_est ? `<span class="fl-chip value">R$ ${escapeHtml(l.limite_est)}</span>` : '';
                const tags = l.tags ? l.tags.split(',').map(t => `<span class="fl-tag">${escapeHtml(t.trim())}</span>`).join('') : '';

                return `
                <article class="fl-client-card pri-${l.prioridade || 'media'}" data-id="${l.id}">
                    <span class="fl-client-av ${AV_COLORS[(l.id || 0) % AV_COLORS.length]}">${escapeHtml(init2)}</span>
                    <div class="fl-client-info">
                        <div class="fl-client-name">${escapeHtml(l.name)}</div>
                        <div class="fl-client-sub">${escapeHtml(l.phone)}${l.city ? ' • ' + escapeHtml(l.city) : ''}</div>
                        <div class="fl-client-chips"><span class="fl-chip origin">${escapeHtml(l.origem || '—')}</span>${limitChip}${tags}</div>
                    </div>
                    <div class="fl-client-right">
                        <span class="fl-client-score ${scoreCls(l.score)}"><i class="fas fa-bolt"></i> ${score}</span>
                        <span class="fl-client-time">${relTime(l.created_at)}</span>
                        <button type="button" class="fl-btn-fiche" title="Abrir Ficha"><i class="fas fa-id-card"></i> FICHA</button>
                    </div>
                </article>`;
            }).join('');

            // Entrada animada cascata (staggered) dos cards de clientes via Anime.js
            runAnime({
                targets: '.fl-client-card',
                translateY: [22, 0],
                opacity: [0, 1],
                scale: [0.96, 1],
                delay: runAnime ? window.anime.stagger(45) : 0,
                duration: 400,
                easing: 'easeOutQuad'
            });

            // Handlers de clique nos cards de cliente
            listEl.querySelectorAll('.fl-client-card').forEach(card => {
                card.addEventListener('click', () => {
                    const leadId = card.dataset.id;
                    openClientModal(leadId);
                });
            });
        } catch (e) {
            listEl.innerHTML = `<div class="fl-drawer-empty" style="color:var(--bad);"><i class="fas fa-exclamation-circle"></i> Erro ao carregar: ${escapeHtml(e.message)}</div>`;
        }
    }

    // Handlers do Drawer Lateral
    document.getElementById('fl-drawer-back-btn').onclick = closeStageDrawer;
    document.getElementById('fl-drawer-close-btn').onclick = closeStageDrawer;
    document.getElementById('fl-drawer-prio').addEventListener('change', loadDrawerClients);
    document.getElementById('fl-drawer-search').addEventListener('input', () => {
        clearTimeout(drawerSearchTimer);
        drawerSearchTimer = setTimeout(loadDrawerClients, 300);
    });

    // System de Edição Inline Interativa (Click-to-Edit)
    function setupInlineEdit(triggerEl, fieldKey, options = {}) {
        if (!triggerEl) return;
        triggerEl.onclick = (e) => {
            e.stopPropagation();
            if (triggerEl.querySelector('input, select')) return;

            const currentValue = activeClientData ? (activeClientData[fieldKey] ?? '') : '';
            let inputEl;

            if (options.type === 'select') {
                inputEl = document.createElement('select');
                inputEl.className = 'fl-inline-select';
                options.options.forEach(opt => {
                    const optEl = document.createElement('option');
                    optEl.value = opt.value;
                    optEl.textContent = opt.label;
                    if (opt.value === currentValue) optEl.selected = true;
                    inputEl.appendChild(optEl);
                });
            } else {
                inputEl = document.createElement('input');
                inputEl.type = options.type || 'text';
                inputEl.className = 'fl-inline-input';
                if (options.step) inputEl.step = options.step;
                inputEl.value = currentValue;
                inputEl.placeholder = options.placeholder || '';
            }

            const originalHTML = triggerEl.innerHTML;
            triggerEl.innerHTML = '';
            triggerEl.appendChild(inputEl);
            inputEl.focus();

            let saved = false;
            async function commitSave() {
                if (saved) return;
                saved = true;

                const rawVal = inputEl.value.trim();
                let patchVal = rawVal;
                if (options.type === 'number') {
                    patchVal = rawVal ? parseFloat(rawVal) : null;
                }

                if (patchVal === (activeClientData[fieldKey] ?? null)) {
                    triggerEl.innerHTML = originalHTML;
                    return;
                }

                try {
                    const updated = await api(`/leads/${activeClientData.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ [fieldKey]: patchVal })
                    });
                    activeClientData = updated;
                    toast('Informação atualizada!');
                    await openClientModal(activeClientData.id);
                    await loadData();
                    if (activeViewMode === 'crm') await loadCrmKanban();
                    if (activeStageKey) await loadDrawerClients();
                } catch (err) {
                    toast(err.message, 'err');
                    triggerEl.innerHTML = originalHTML;
                }
            }

            inputEl.onblur = commitSave;
            inputEl.onkeydown = (ev) => {
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    inputEl.blur();
                } else if (ev.key === 'Escape') {
                    saved = true;
                    triggerEl.innerHTML = originalHTML;
                }
            };
        };
    }

    // ================= SUBMODAL: FICHA DO CLIENTE =================
    async function openClientModal(leadId) {
        const overlay = document.getElementById('flClientOverlay');
        const shell = document.getElementById('fl-client-shell');

        try {
            overlay.style.display = 'flex';

            // Animação de entrada com escala elástica do modal via Anime.js
            runAnime({
                targets: shell,
                scale: [0.85, 1],
                opacity: [0, 1],
                duration: 380,
                easing: 'easeOutBack'
            });

            // Carrega dados completos do lead e seu histórico em paralelo
            const [lead, history] = await Promise.all([
                api(`/leads/${leadId}`),
                api(`/leads/${leadId}/history`).catch(() => [])
            ]);

            activeClientData = lead;

            // Renderiza cabeçalho e identidade do cliente
            const initials = (lead.name || ' ').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
            document.getElementById('fl-c-avatar').textContent = initials;
            document.getElementById('fl-c-name').textContent = lead.name;

            const phoneValEl = document.getElementById('fl-c-phone-val');
            if (phoneValEl) phoneValEl.textContent = lead.phone || '--';
            const cpfValEl = document.getElementById('fl-c-cpf-val');
            if (cpfValEl) cpfValEl.textContent = lead.cpf || '--';

            const stageMeta = STAGES.find(s => s.key === lead.status) || { label: (lead.status || 'NOVO').toUpperCase(), color: '#3b82f6' };
            const stagePill = document.getElementById('fl-c-stage-pill');
            stagePill.textContent = stageMeta.label;
            stagePill.style.background = stageMeta.color;
            stagePill.style.color = stageMeta.dark ? 'var(--ink)' : '#fff';

            const prioPill = document.getElementById('fl-c-prio-pill');
            const prio = (lead.prioridade || 'media').toUpperCase();
            prioPill.textContent = `PRIORIDADE ${prio}`;
            prioPill.className = `fl-client-prio-pill fl-editable-pill pri-${lead.prioridade || 'media'}`;

            // Configura os editores inline interativos (click-to-edit)
            setupInlineEdit(document.getElementById('fl-c-name'), 'name', { placeholder: 'Nome do cliente' });
            setupInlineEdit(phoneValEl, 'phone', { placeholder: 'Telefone' });
            setupInlineEdit(cpfValEl, 'cpf', { placeholder: 'CPF' });
            setupInlineEdit(prioPill, 'prioridade', {
                type: 'select',
                options: [
                    { value: 'alta', label: 'PRIORIDADE ALTA' },
                    { value: 'media', label: 'PRIORIDADE MÉDIA' },
                    { value: 'baixa', label: 'PRIORIDADE BAIXA' }
                ]
            });
            setupInlineEdit(document.getElementById('fl-c-renda-card'), 'renda', { type: 'number', step: '0.01', placeholder: '0.00' });
            setupInlineEdit(document.getElementById('fl-c-desejado-card'), 'valor_desejado', { type: 'number', step: '0.01', placeholder: '0.00' });
            setupInlineEdit(document.getElementById('fl-c-limite-card'), 'limite_est', { type: 'number', step: '0.01', placeholder: '0.00' });
            setupInlineEdit(document.getElementById('fl-c-cidade-card'), 'city', { placeholder: 'Cidade - UF' });

            // Renderiza Stepper de movimentação rápida de estágio
            renderClientStepper(lead.status, lead.id);

            // Renderiza campos financeiros
            document.getElementById('fl-c-renda').textContent = lead.renda ? `R$ ${nf(lead.renda)}` : 'Não informada';
            document.getElementById('fl-c-desejado').textContent = lead.valor_desejado ? `R$ ${nf(lead.valor_desejado)}` : 'Não informado';
            document.getElementById('fl-c-limite').textContent = lead.limite_est ? `R$ ${nf(lead.limite_est)}` : 'Pendente simulação';
            document.getElementById('fl-c-origem').textContent = `${lead.city || 'Cidade N/D'} • ${lead.origem || 'Origem N/D'}`;
            document.getElementById('fl-c-score').textContent = lead.score != null ? `${lead.score} / 100` : 'Pendente';
            document.getElementById('fl-c-vendedor').textContent = lead.seller_name || 'Atribuído ao vendedor';
            document.getElementById('fl-c-obs').value = lead.obs || '';
            document.getElementById('fl-c-created-at').textContent = `Cadastrado em ${new Date(lead.created_at).toLocaleDateString('pt-BR')} (${relTime(lead.created_at)})`;

            // Botão WhatsApp (Abre popup flutuante emulado arrastável)
            document.getElementById('fl-c-wa-btn').onclick = () => {
                if (typeof window.openWaFloatingWidget === 'function') {
                    window.openWaFloatingWidget(lead);
                } else {
                    const cleanPhone = (lead.phone || '').replace(/\D/g, '');
                    if (!cleanPhone) return toast('Telefone inválido', 'err');
                    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
                    window.open(`https://wa.me/${fullPhone}?text=Olá%20${encodeURIComponent(lead.name)},%20sou%20da%20Prime%20Sul!`, '_blank');
                }
            };

            // Botão Editar Dados
            const editBtn = document.getElementById('fl-c-edit-btn');
            if (editBtn) editBtn.onclick = openClientEditModal;

            // Botão Transferir (apenas admin)
            const transferBtn = document.getElementById('fl-c-transfer-btn');
            if (userRole === 'admin') {
                transferBtn.style.display = 'inline-flex';
                transferBtn.onclick = () => {
                    closeClientModal();
                    openTransferModal(lead.id);
                };
            } else {
                transferBtn.style.display = 'none';
            }

            // Renderiza Timeline de histórico
            renderClientTimeline(history);

        } catch (e) {
            toast('Erro ao carregar ficha do cliente: ' + e.message, 'err');
            closeClientModal();
        }
    }

    // ================= SUBMODAL: EDITAR DADOS DO CLIENTE =================
    function openClientEditModal() {
        if (!activeClientData) return;
        const overlay = document.getElementById('flClientEditOverlay');
        const shell = document.getElementById('fl-client-edit-shell');

        document.getElementById('fl-edit-name').value = activeClientData.name || '';
        document.getElementById('fl-edit-phone').value = activeClientData.phone || '';
        document.getElementById('fl-edit-cpf').value = activeClientData.cpf || '';
        document.getElementById('fl-edit-prio').value = activeClientData.prioridade || 'media';
        document.getElementById('fl-edit-origem').value = activeClientData.origem || 'SITE';
        document.getElementById('fl-edit-city').value = activeClientData.city || '';
        document.getElementById('fl-edit-renda').value = activeClientData.renda || '';
        document.getElementById('fl-edit-desejado').value = activeClientData.valor_desejado || '';
        document.getElementById('fl-edit-limite').value = activeClientData.limite_est || '';
        document.getElementById('fl-edit-tags').value = activeClientData.tags || '';

        overlay.style.display = 'flex';
        runAnime({
            targets: shell,
            scale: [0.88, 1],
            opacity: [0, 1],
            duration: 320,
            easing: 'easeOutCubic'
        });
    }

    function closeClientEditModal() {
        const overlay = document.getElementById('flClientEditOverlay');
        const shell = document.getElementById('fl-client-edit-shell');

        runAnime({
            targets: shell,
            scale: [1, 0.88],
            opacity: [1, 0],
            duration: 220,
            easing: 'easeInCubic',
            complete: () => {
                overlay.style.display = 'none';
            }
        });
    }

    async function saveClientEdit() {
        if (!activeClientData) return;
        const name = document.getElementById('fl-edit-name').value.trim();
        const phone = document.getElementById('fl-edit-phone').value.trim();
        if (!name || !phone) return toast('Nome e telefone são obrigatórios', 'err');

        const cpf = document.getElementById('fl-edit-cpf').value.trim();
        const prioridade = document.getElementById('fl-edit-prio').value;
        const origem = document.getElementById('fl-edit-origem').value;
        const city = document.getElementById('fl-edit-city').value.trim();
        const rendaRaw = document.getElementById('fl-edit-renda').value;
        const renda = rendaRaw ? parseFloat(rendaRaw) : null;
        const desejarRaw = document.getElementById('fl-edit-desejado').value;
        const valor_desejado = desejarRaw ? parseFloat(desejarRaw) : null;
        const limiteRaw = document.getElementById('fl-edit-limite').value;
        const limite_est = limiteRaw ? parseFloat(limiteRaw) : null;
        const tags = document.getElementById('fl-edit-tags').value.trim();

        const btn = document.getElementById('fl-edit-save');
        btn.disabled = true;

        try {
            await api(`/leads/${activeClientData.id}`, {
                method: 'PATCH',
                body: JSON.stringify({
                    name, phone, cpf, prioridade, origem, city, renda, valor_desejado, limite_est, tags
                })
            });
            toast('Dados do cliente atualizados com sucesso!');
            closeClientEditModal();
            await loadData();
            await openClientModal(activeClientData.id);
            if (activeStageKey) await loadDrawerClients();
        } catch (e) {
            toast(e.message, 'err');
        } finally {
            btn.disabled = false;
        }
    }

    const editClose = document.getElementById('fl-edit-close');
    if (editClose) editClose.onclick = closeClientEditModal;
    const editCancel = document.getElementById('fl-edit-cancel');
    if (editCancel) editCancel.onclick = closeClientEditModal;
    const editSave = document.getElementById('fl-edit-save');
    if (editSave) editSave.onclick = saveClientEdit;

    function renderClientStepper(currentStatus, leadId) {
        const stepperEl = document.getElementById('fl-c-stepper');
        stepperEl.innerHTML = STAGES.map((s, idx) => {
            const isCurrent = s.key === currentStatus;
            const isDone = STAGES.findIndex(x => x.key === currentStatus) > idx;
            return `
            <button type="button" class="fl-step-btn ${isCurrent ? 'active' : ''} ${isDone ? 'done' : ''}" data-status="${s.key}" title="Mover para ${s.label}">
                <span class="fl-step-icon"><i class="fas ${isDone ? 'fa-check' : s.icon}"></i></span>
                <span class="fl-step-label">${s.label}</span>
            </button>`;
        }).join('<span class="fl-step-connector"></span>');

        stepperEl.querySelectorAll('.fl-step-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const newStatus = btn.dataset.status;
                if (newStatus === currentStatus) return;
                try {
                    btn.disabled = true;
                    await api(`/leads/${leadId}/status`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: newStatus })
                    });
                    toast(`Estágio alterado para ${newStatus.toUpperCase()}!`);
                    await loadData();
                    await openClientModal(leadId);
                    if (activeStageKey) await loadDrawerClients();
                } catch (e) {
                    toast(e.message, 'err');
                }
            });
        });
    }

    function renderClientTimeline(history) {
        const timelineEl = document.getElementById('fl-c-timeline');
        if (!history || !history.length) {
            timelineEl.innerHTML = '<div class="fl-timeline-empty"><i class="fas fa-clock"></i> Nenhum histórico de movimentação registrado ainda.</div>';
            return;
        }

        timelineEl.innerHTML = history.map(h => {
            const dateStr = new Date(h.created_at).toLocaleString('pt-BR');
            return `
            <div class="fl-timeline-item">
                <div class="fl-timeline-dot"><i class="fas fa-circle-dot"></i></div>
                <div class="fl-timeline-content">
                    <div class="fl-timeline-head">
                        <strong>${escapeHtml(h.descricao || h.action || 'Movimentação')}</strong>
                        <small>${dateStr}</small>
                    </div>
                    ${h.usuario ? `<span>por ${escapeHtml(h.usuario)}</span>` : ''}
                </div>
            </div>`;
        }).join('');
    }

    function closeClientModal() {
        const overlay = document.getElementById('flClientOverlay');
        const shell = document.getElementById('fl-client-shell');

        runAnime({
            targets: shell,
            scale: [1, 0.85],
            opacity: [1, 0],
            duration: 250,
            easing: 'easeInBack',
            complete: () => {
                overlay.style.display = 'none';
            }
        });
    }

    // Salvar Observações da Ficha
    document.getElementById('fl-c-save-obs').onclick = async () => {
        if (!activeClientData) return;
        const obs = document.getElementById('fl-c-obs').value.trim();
        const btn = document.getElementById('fl-c-save-obs');
        btn.disabled = true;

        try {
            await api(`/leads/${activeClientData.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ obs })
            });
            toast('Observações salvas com sucesso!');
        } catch (e) {
            toast(e.message, 'err');
        } finally {
            btn.disabled = false;
        }
    };

    document.getElementById('fl-c-close-btn').onclick = closeClientModal;
    document.getElementById('fl-c-done-btn').onclick = closeClientModal;
    document.getElementById('flClientOverlay').addEventListener('click', e => {
        if (e.target.id === 'flClientOverlay') closeClientModal();
    });

    // ================= POPUP DE AUTOMAÇÕES DA ETAPA =================
    async function loadAutomationResources() {
        const [configs, numbers, templateRows] = await Promise.all([
            api('/tools/stage-config'),
            api('/campaigns/numbers'),
            api('/templates')
        ]);
        stageConfigs = configs || {};
        availableNumbers = (numbers || []).filter(n => n.status === 'ativo');
        templates = (templateRows || []).filter(t => t.purpose === 'screening');
    }

    function fillSelects() {
        const numberOptions = '<option value="">Seleção automática</option>' + availableNumbers.map(n =>
            `<option value="${n.id}">${escapeHtml(n.label || n.number || ('Número #' + n.id))}</option>`).join('');
        document.getElementById('fla-auto-number').innerHTML = numberOptions;
        const templateOptions = '<option value="">Aplicar um template...</option>' + templates.map(t =>
            `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
        document.getElementById('fla-auto-template').innerHTML = templateOptions;
    }

    function switchFlaTab(name) {
        document.querySelectorAll('#fla-tabbar .fla-tab[data-fla-tab]').forEach(tab => tab.classList.toggle('active', tab.dataset.flaTab === name));
        document.querySelectorAll('[data-fla-panel]').forEach(panel => panel.hidden = panel.dataset.flaPanel !== name);
    }

    async function openAutomationPopup(stage) {
        const meta = STAGES.find(s => s.key === stage) || { label: stage.toUpperCase() };
        document.getElementById('fla-stage').textContent = meta.label;
        document.getElementById('flaOverlay').style.display = 'flex';
        try {
            await loadAutomationResources();
            fillSelects();
            const cfg = stageConfigs[stage] || {};
            const canMessage = ['novo', 'contato'].includes(stage);
            document.getElementById('fla-card-auto').classList.toggle('disabled', !canMessage);
            document.getElementById('fla-card-send').classList.toggle('disabled', !canMessage);
            document.getElementById('fla-auto').checked = !!cfg.auto_send;
            document.getElementById('fla-auto-msg').value = cfg.message || '';
            document.getElementById('fla-auto-number').value = cfg.number_id || '';
            document.getElementById('fla-move-to').value = stage === 'novo' ? 'contato' : stage === 'contato' ? 'confirmado' : 'concluido';
            updatePreview();
            updateAutomationReadiness(cfg, canMessage, stage);
            switchFlaTab(canMessage ? 'auto' : 'move');
        } catch (e) { toast(e.message, 'err'); }
    }

    function updateAutomationReadiness(cfg, canMessage, stage) {
        const hasMessage = !!(cfg.message || '').trim();
        const hasNumber = availableNumbers.length > 0;
        const isActive = !!cfg.auto_send;
        document.getElementById('fla-stat-auto').textContent = isActive ? 'ATIVA' : 'PAUSADA';
        document.getElementById('fla-stat-msg').textContent = hasMessage ? 'PRONTA' : 'PENDENTE';
        document.getElementById('fla-stat-number').textContent = hasNumber ? String(availableNumbers.length) : 'NENHUM';

        if (!canMessage) {
            document.getElementById('fla-ready-label').textContent = 'ETAPA OPERACIONAL';
            document.getElementById('fla-ready-title').textContent = 'GESTÃO EM LOTE';
            document.getElementById('fla-ready-desc').textContent = 'Nesta etapa, use movimentação e score. Mensagens automáticas ficam disponíveis apenas em Novo e Em contato.';
        } else if (isActive && hasMessage && hasNumber) {
            document.getElementById('fla-ready-label').textContent = 'PRONTA PARA USO';
            document.getElementById('fla-ready-title').textContent = 'AUTOMAÇÃO ATIVA';
            document.getElementById('fla-ready-desc').textContent = 'Novos leads desta etapa receberão a mensagem configurada pelo número selecionado ou pela rotação automática.';
        } else {
            const missing = [!hasMessage && 'uma mensagem', !hasNumber && 'um número ativo', !isActive && 'ativar a automação'].filter(Boolean).join(', ');
            document.getElementById('fla-ready-label').textContent = 'CONFIGURAÇÃO PENDENTE';
            document.getElementById('fla-ready-title').textContent = 'FALTA POUCO';
            document.getElementById('fla-ready-desc').textContent = `Para deixar esta etapa pronta, configure ${missing}.`;
        }
    }

    function updatePreview() {
        const raw = document.getElementById('fla-auto-msg').value.trim();
        document.getElementById('fla-preview').textContent = raw
            ? raw.replace(/\{nome\}/g, 'Maria')
            : 'A prévia da mensagem automática aparecerá aqui.';
    }

    document.getElementById('fla-close').onclick = () => document.getElementById('flaOverlay').style.display = 'none';
    document.getElementById('flaOverlay').addEventListener('click', e => { if (e.target.id === 'flaOverlay') e.target.style.display = 'none'; });
    document.querySelectorAll('#fla-tabbar .fla-tab[data-fla-tab]').forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.classList.contains('disabled')) return toast('Mensagens estão disponíveis apenas em Novo e Em contato', 'info');
            switchFlaTab(tab.dataset.flaTab);
        });
    });
    document.getElementById('fla-auto-msg').addEventListener('input', updatePreview);

    document.getElementById('fla-save').onclick = async () => {
        const stage = document.getElementById('fla-stage').textContent.toLowerCase();
        const body = {
            status: stage,
            config: {
                auto_send: document.getElementById('fla-auto').checked,
                message: document.getElementById('fla-auto-msg').value.trim(),
                number_id: Number(document.getElementById('fla-auto-number').value) || null
            }
        };
        try {
            await api('/tools/stage-config', { method: 'PUT', body: JSON.stringify(body) });
            toast('Automação da etapa salva!');
            await loadAutomationResources();
            await loadData();
        } catch (e) { toast(e.message, 'err'); }
    };

    // ================= TRANSFERÊNCIA DE LEAD (ADMIN) =================
    let transferLeadId = null;

    async function openTransferModal(leadId) {
        transferLeadId = leadId;
        const info = document.getElementById('flt-lead-info');
        info.textContent = activeClientData
            ? `Transferir ${activeClientData.name} (${activeClientData.phone}) para outro vendedor.`
            : 'Escolha o vendedor de destino.';

        try {
            const sellers = await api('/sellers');
            document.getElementById('flt-seller').innerHTML =
                '<option value="">Selecione o vendedor...</option>' +
                sellers.filter(s => s.active && s.role !== 'admin').map(s =>
                    `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
            document.getElementById('flTransferOverlay').style.display = 'flex';
        } catch (e) { toast(e.message, 'err'); }
    }

    document.getElementById('flt-close').onclick = () => document.getElementById('flTransferOverlay').style.display = 'none';
    document.getElementById('flt-cancel').onclick = () => document.getElementById('flTransferOverlay').style.display = 'none';
    document.getElementById('flt-confirm').onclick = async () => {
        const toId = Number(document.getElementById('flt-seller').value);
        if (!toId) return toast('Selecione o vendedor de destino', 'err');
        try {
            const r = await api(`/leads/${transferLeadId}/transfer`, { method: 'POST', body: JSON.stringify({ to_seller_id: toId }) });
            toast(r.transferred ? `Lead transferido para ${r.target_name}!` : 'Lead já pertencia a este vendedor', 'info');
            document.getElementById('flTransferOverlay').style.display = 'none';
            await loadData();
            if (activeStageKey) await loadDrawerClients();
        } catch (e) { toast(e.message, 'err'); }
    };

    // Tecla ESC para fechar popups
    function escHandler(e) {
        if (e.key !== 'Escape') return;
        const editModal = document.getElementById('flClientEditOverlay');
        const clientModal = document.getElementById('flClientOverlay');
        const transferModal = document.getElementById('flTransferOverlay');
        const autoModal = document.getElementById('flaOverlay');
        const drawer = document.getElementById('fl-drawer');

        if (editModal && editModal.style.display === 'flex') { closeClientEditModal(); }
        else if (clientModal && clientModal.style.display === 'flex') { closeClientModal(); }
        else if (transferModal && transferModal.style.display === 'flex') { transferModal.style.display = 'none'; }
        else if (autoModal && autoModal.style.display === 'flex') { autoModal.style.display = 'none'; }
        else if (drawer && drawer.style.display === 'flex') { closeStageDrawer(); }
    }

    document.addEventListener('keydown', escHandler);
    document.getElementById('fl-refresh').onclick = loadData;

    // Listeners do Modo CRM / Visão Funil
    const modeFunnelBtn = document.getElementById('fl-mode-funnel');
    if (modeFunnelBtn) modeFunnelBtn.onclick = () => toggleViewMode('funnel');
    const modeCrmBtn = document.getElementById('fl-mode-crm');
    if (modeCrmBtn) modeCrmBtn.onclick = () => toggleViewMode('crm');

    const crmSearchInput = document.getElementById('fl-crm-search');
    if (crmSearchInput) {
        crmSearchInput.addEventListener('input', () => {
            clearTimeout(crmSearchTimer);
            crmSearchTimer = setTimeout(loadCrmKanban, 300);
        });
    }
    const crmPrioSelect = document.getElementById('fl-crm-prio');
    if (crmPrioSelect) crmPrioSelect.addEventListener('change', loadCrmKanban);

    await loadData();
    return {};
}

export async function destroy() {
    clearTimeout(drawerSearchTimer);
    clearTimeout(automationJobTimer);
}
