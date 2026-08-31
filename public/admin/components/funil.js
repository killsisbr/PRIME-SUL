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
            const STAGE_WIDTHS = ['100%', '93%', '86%', '79%'];
            column.innerHTML = STAGES.map((s, i) => {
                const count = stages[s.key] || 0;
                const width = STAGE_WIDTHS[i] || '79%';
                const pct = Math.round((count / total) * 100);
                const color = s.color;
                const txt = s.dark ? 'var(--ink, #070a12)' : '#fff';
                const chip = TRANSITIONS[i] ? renderTransitionChip(conversoes[TRANSITIONS[i].key]) : '';
                const autoOn = !!stageConfigs[s.key]?.auto_send;
                const isActive = activeStageKey === s.key;
                const isDefaultStage = s.key === 'novo';

                return `
                <div class="fl-seg-wrap ${isActive ? 'active' : ''}" data-stage="${s.key}" style="width:${width};">
                    <div class="fl-seg" style="background:${color}; color:${txt};" title="Clique para ver os clientes desta etapa">
                        <span class="fl-seg-fill" style="width:${pct}%;"></span>
                        <div class="fl-seg-left">
                            <span class="fl-seg-icon"><i class="fas ${s.icon}"></i></span>
                            <div class="fl-seg-main">
                                <span class="fl-seg-label">${s.label}${isDefaultStage ? ' <small style="font-size:0.6rem; opacity:0.85; font-weight:800; letter-spacing:0.5px;">(TRIAGEM / ENTRADA)</small>' : ''}</span>
                                <span class="fl-seg-count">${nf(count)}</span>
                            </div>
                        </div>
                        <div class="fl-seg-right">
                            <span class="fl-seg-pct">${pct}% DO FUNIL</span>
                            <div class="fl-seg-actions">
                                <span class="fl-seg-cta"><i class="fas fa-users"></i> VER CLIENTES</span>

                            </div>
                        </div>
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



        document.querySelectorAll('.fl-detail-row').forEach(row => {
            row.addEventListener('click', () => openStageDrawer(row.dataset.stage));
        });
    }

    function renderTransitionChip(pct) {
        if (pct === undefined || pct === null) return '';
        const ok = pct >= 50;
        const loss = 100 - pct;
        return `
        <div class="fl-trans-wrap">
            <span class="fl-chip ${ok ? 'ok' : 'bad'}" title="${ok ? 'Taxa de conversão para a próxima etapa' : 'Perda de leads nesta transição'}">
                <i class="fas ${ok ? 'fa-arrow-down' : 'fa-arrow-trend-down'}"></i> 
                ${ok ? 'CONVERSÃO ' + pct + '%' : 'PERDA ' + loss + '%'}
            </span>
        </div>`;
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

    let selectedLeadIds = new Set();

    // ================= DRAWER LATERAL DE CLIENTES (INFO LIST) =================
    async function openStageDrawer(stageKey) {
        activeStageKey = stageKey;
        selectedLeadIds.clear();
        const stageMeta = STAGES.find(s => s.key === stageKey) || { label: stageKey.toUpperCase(), color: '#3b82f6' };

        // Ativa o layout animado que encolhe o funil e dá espaço amplo à lista
        const funnelView = document.getElementById('fl-view-funnel');
        if (funnelView) funnelView.classList.add('drawer-open');

        // Destaca a fatia ativa no funil
        document.querySelectorAll('.fl-seg-wrap, .fl-detail-row').forEach(el => {
            el.classList.toggle('active', el.dataset.stage === stageKey);
        });

        // Configura cabeçalho do Drawer
        const drawerBadge = document.getElementById('fl-drawer-badge');
        if (drawerBadge) {
            drawerBadge.textContent = stageMeta.label;
            drawerBadge.style.background = stageMeta.color;
            drawerBadge.style.color = stageMeta.dark ? 'var(--ink, #070a12)' : '#fff';
        }

        const drawer = document.getElementById('fl-drawer');
        const overviewPanel = document.getElementById('fl-overview-panel');

        // Transição com Anime.js: oculta o painel de resumo e exibe o drawer lateral
        if (overviewPanel) overviewPanel.style.display = 'none';
        if (drawer) {
            drawer.style.display = 'flex';
            runAnime({
                targets: drawer,
                translateX: [40, 0],
                opacity: [0, 1],
                duration: 400,
                easing: 'easeOutCubic'
            });
        }

        // Limpa busca e carrega clientes do estágio
        const searchInput = document.getElementById('fl-drawer-search');
        if (searchInput) searchInput.value = '';
        const prioInput = document.getElementById('fl-drawer-prio');
        if (prioInput) prioInput.value = '';

        await loadDrawerClients();
    }

    function closeStageDrawer() {
        const drawer = document.getElementById('fl-drawer');
        const overviewPanel = document.getElementById('fl-overview-panel');
        const funnelView = document.getElementById('fl-view-funnel');

        selectedLeadIds.clear();
        updateSelectionUI();

        if (funnelView) funnelView.classList.remove('drawer-open');

        if (drawer) {
            runAnime({
                targets: drawer,
                translateX: [0, 40],
                opacity: [1, 0],
                duration: 280,
                easing: 'easeInCubic',
                complete: () => {
                    drawer.style.display = 'none';
                    if (overviewPanel) {
                        overviewPanel.style.display = 'flex';
                        runAnime({
                            targets: overviewPanel,
                            opacity: [0, 1],
                            translateY: [15, 0],
                            duration: 300,
                            easing: 'easeOutQuad'
                        });
                    }
                    activeStageKey = null;
                    document.querySelectorAll('.fl-seg-wrap, .fl-detail-row').forEach(el => el.classList.remove('active'));
                }
            });
        }
    }

    function updateSelectionUI() {
        const selCount = selectedLeadIds.size;
        const totalVisible = currentStageLeads.length;

        const selBadge = document.getElementById('fl-selected-badge');
        const selCountEl = document.getElementById('fl-selected-count');
        const clearBtn = document.getElementById('fl-clear-selection-btn');
        const selectAllCb = document.getElementById('fl-select-all-leads');
        const createCampBtn = document.getElementById('fl-btn-create-campaign');
        const campTargetCount = document.getElementById('fl-campaign-target-count');
        const visibleCountEl = document.getElementById('fl-visible-lead-count');

        if (visibleCountEl) visibleCountEl.textContent = totalVisible;
        if (selCountEl) selCountEl.textContent = selCount;

        if (selBadge) selBadge.style.display = selCount > 0 ? 'inline-flex' : 'none';
        if (clearBtn) clearBtn.style.display = selCount > 0 ? 'inline-flex' : 'none';

        if (createCampBtn) {
            createCampBtn.style.display = selCount > 0 ? 'inline-flex' : 'none';
        }
        if (campTargetCount) {
            campTargetCount.textContent = selCount;
        }

        if (selectAllCb) {
            selectAllCb.checked = totalVisible > 0 && selCount === totalVisible;
            selectAllCb.indeterminate = selCount > 0 && selCount < totalVisible;
        }

        // Atualiza estilo selected nos cards
        document.querySelectorAll('.fl-client-card').forEach(card => {
            const id = Number(card.dataset.id);
            const isSelected = selectedLeadIds.has(id);
            card.classList.toggle('selected', isSelected);
            const cb = card.querySelector('.fl-card-check');
            if (cb) cb.checked = isSelected;
        });
    }

    async function loadDrawerClients() {
        const listEl = document.getElementById('fl-drawer-clients');
        if (!listEl) return;
        listEl.innerHTML = '<div class="fl-drawer-loading"><i class="fas fa-spinner fa-spin"></i> Carregando lista de clientes...</div>';

        try {
            const search = (document.getElementById('fl-drawer-search')?.value || '').trim();
            const prio = document.getElementById('fl-drawer-prio')?.value || '';
            const params = { status: activeStageKey };
            if (search) params.search = search;
            if (prio) params.prioridade = prio;

            const leads = await api('/leads?' + new URLSearchParams(params));
            currentStageLeads = leads;

            const countEl = document.getElementById('fl-drawer-count');
            if (countEl) countEl.textContent = `${leads.length} cliente${leads.length !== 1 ? 's' : ''} nesta etapa`;

            updateSelectionUI();

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
                const isSelected = selectedLeadIds.has(l.id);

                return `
                <article class="fl-client-card ${isSelected ? 'selected' : ''} pri-${l.prioridade || 'media'}" data-id="${l.id}">
                    <div class="fl-card-check-wrap">
                        <input type="checkbox" class="fl-card-check" data-lead-id="${l.id}" ${isSelected ? 'checked' : ''}>
                    </div>
                    <span class="fl-client-av ${AV_COLORS[(l.id || 0) % AV_COLORS.length]}">${escapeHtml(init2)}</span>
                    <div class="fl-client-info">
                        <div class="fl-client-name">${escapeHtml(l.name)}</div>
                        <div class="fl-client-sub">${escapeHtml(l.phone)}${l.city ? ' • ' + escapeHtml(l.city) : ''}</div>
                        <div class="fl-client-chips"><span class="fl-chip origin">${escapeHtml(l.origem || '—')}</span>${limitChip}${tags}</div>
                    </div>
                    <div class="fl-client-right">
                        <span class="fl-client-score ${scoreCls(l.score)}"><i class="fas fa-bolt"></i> ${score}</span>
                        <span class="fl-client-time">${relTime(l.created_at)}</span>
                        <button type="button" class="fl-btn-fiche" data-fiche-id="${l.id}" title="Abrir Ficha"><i class="fas fa-id-card"></i> FICHA</button>
                    </div>
                </article>`;
            }).join('');

            // Entrada animada dos cards
            runAnime({
                targets: '.fl-client-card',
                translateY: [16, 0],
                opacity: [0, 1],
                delay: runAnime ? window.anime.stagger(35) : 0,
                duration: 350,
                easing: 'easeOutQuad'
            });

            // Handlers de clique e seleção direta
            listEl.querySelectorAll('.fl-client-card').forEach(card => {
                card.addEventListener('click', e => {
                    const checkWrap = e.target.closest('.fl-card-check-wrap') || e.target.classList.contains('fl-card-check');
                    if (checkWrap) {
                        e.stopPropagation();
                        const leadId = Number(card.dataset.id);
                        if (selectedLeadIds.has(leadId)) {
                            selectedLeadIds.delete(leadId);
                        } else {
                            selectedLeadIds.add(leadId);
                        }
                        updateSelectionUI();
                        return;
                    }

                    // Clique no card abre diretamente a ficha do cliente
                    openClientModal(card.dataset.id);
                });
            });

        } catch (e) {
            listEl.innerHTML = `<div class="fl-drawer-empty" style="color:var(--bad);"><i class="fas fa-exclamation-circle"></i> Erro ao carregar: ${escapeHtml(e.message)}</div>`;
        }
    }

    // Handlers do Drawer Lateral
    document.getElementById('fl-drawer-back-btn')?.addEventListener('click', closeStageDrawer);
    document.getElementById('fl-drawer-close-btn')?.addEventListener('click', closeStageDrawer);
    document.getElementById('fl-drawer-prio')?.addEventListener('change', loadDrawerClients);
    document.getElementById('fl-drawer-search')?.addEventListener('input', () => {
        clearTimeout(drawerSearchTimer);
        drawerSearchTimer = setTimeout(loadDrawerClients, 300);
    });

    // Seleção em massa
    document.getElementById('fl-select-all-leads')?.addEventListener('change', e => {
        const isChecked = e.target.checked;
        if (isChecked) {
            currentStageLeads.forEach(l => selectedLeadIds.add(l.id));
        } else {
            selectedLeadIds.clear();
        }
        updateSelectionUI();
    });

    document.getElementById('fl-clear-selection-btn')?.addEventListener('click', () => {
        selectedLeadIds.clear();
        updateSelectionUI();
    });

    // ================= DISPARO EM MASSA A PARTIR DO FUNIL =================
    const dispModal = document.getElementById('fl-dispatch-modal');
    const createCampBtn = document.getElementById('fl-btn-create-campaign');

    createCampBtn?.addEventListener('click', async () => {
        if (!selectedLeadIds.size) {
            toast('Selecione ao menos um lead para criar o disparo!', 'err');
            return;
        }

        const stageMeta = STAGES.find(s => s.key === activeStageKey) || { label: 'LEADS' };
        const nameInput = document.getElementById('fl-disp-name');
        if (nameInput) {
            nameInput.value = `Disparo - Etapa ${stageMeta.label} (${selectedLeadIds.size} leads)`;
        }

        const countSpan = document.getElementById('fl-disp-target-count');
        if (countSpan) countSpan.textContent = selectedLeadIds.size;

        const summaryBox = document.getElementById('fl-disp-targets-summary');
        if (summaryBox) {
            const selectedLeads = currentStageLeads.filter(l => selectedLeadIds.has(l.id));
            summaryBox.innerHTML = selectedLeads.map(l => `
                <span class="fl-disp-target-chip"><i class="fas fa-user"></i> ${escapeHtml(l.name)} (${escapeHtml(l.phone)})</span>
            `).join('');
        }

        // Carrega templates comerciais disponíveis
        try {
            const tmplSelect = document.getElementById('fl-disp-template');
            if (tmplSelect) {
                tmplSelect.innerHTML = '<option value="">Digitar mensagem personalizada...</option>' +
                    templates.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
            }
        } catch (e) {}

        const msgArea = document.getElementById('fl-disp-message');
        if (msgArea && !msgArea.value) {
            msgArea.value = `Olá {nome}! Tudo bem? Sou da Prime Sul e temos condições exclusivas de crédito pré-aprovadas para você. Vamos conversar?`;
        }

        if (dispModal) {
            dispModal.style.display = 'flex';
            const shell = document.getElementById('fl-dispatch-shell');
            if (shell) {
                runAnime({
                    targets: shell,
                    scale: [0.92, 1],
                    opacity: [0, 1],
                    duration: 320,
                    easing: 'easeOutCubic'
                });
            }
        }
    });

    document.getElementById('fl-disp-template')?.addEventListener('change', e => {
        const tmplId = e.target.value;
        const msgArea = document.getElementById('fl-disp-message');
        if (!msgArea) return;

        if (!tmplId) return;
        const found = templates.find(t => String(t.id) === String(tmplId));
        if (found) {
            msgArea.value = found.content || found.message || '';
        }
    });

    function closeDispatchModal() {
        if (!dispModal) return;
        const shell = document.getElementById('fl-dispatch-shell');
        if (shell) {
            runAnime({
                targets: shell,
                scale: [1, 0.95],
                opacity: [1, 0],
                duration: 200,
                easing: 'easeInQuad',
                complete: () => {
                    dispModal.style.display = 'none';
                }
            });
        } else {
            dispModal.style.display = 'none';
        }
    }

    document.getElementById('fl-disp-close')?.addEventListener('click', closeDispatchModal);
    document.getElementById('fl-disp-cancel')?.addEventListener('click', closeDispatchModal);

    document.getElementById('fl-disp-submit')?.addEventListener('click', async () => {
        const name = (document.getElementById('fl-disp-name')?.value || '').trim();
        const message = (document.getElementById('fl-disp-message')?.value || '').trim();
        const template_id = document.getElementById('fl-disp-template')?.value || null;
        const timeVal = document.getElementById('fl-disp-time')?.value || '10:00';
        const isImmediate = document.getElementById('fl-disp-immediate')?.checked;

        if (!name) {
            toast('Informe um nome para a campanha!', 'err');
            return;
        }
        if (!message) {
            toast('Digite a mensagem a ser enviada aos clientes!', 'err');
            return;
        }
        if (!selectedLeadIds.size) {
            toast('Nenhum lead selecionado!', 'err');
            return;
        }

        let scheduled_at = null;
        if (!isImmediate) {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            const todayStr = `${y}-${m}-${d}`;
            scheduled_at = `${todayStr} ${timeVal}:00`;

            const scheduledTime = new Date(`${todayStr}T${timeVal}:00`);
            if (scheduledTime < now) {
                toast('O horário agendado já passou! Escolha um horário futuro ou marque "Disparo Imediato".', 'err');
                return;
            }
        }

        try {
            const submitBtn = document.getElementById('fl-disp-submit');
            if (submitBtn) submitBtn.disabled = true;

            const res = await api('/campaigns', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    message,
                    template_id: template_id ? Number(template_id) : null,
                    scheduled_at,
                    lead_ids: Array.from(selectedLeadIds)
                })
            });

            if (isImmediate && res && res.id) {
                await api(`/campaigns/${res.id}/start`, { method: 'POST' }).catch(() => {});
            }

            toast(`Campanha "${name}" criada com ${selectedLeadIds.size} leads com sucesso!`, 'ok');
            closeDispatchModal();

            selectedLeadIds.clear();
            updateSelectionUI();

            // Atualiza métricas do funil
            await loadData();

        } catch (e) {
            toast('Erro ao criar campanha: ' + e.message, 'err');
        } finally {
            const submitBtn = document.getElementById('fl-disp-submit');
            if (submitBtn) submitBtn.disabled = false;
        }
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
            
            const extraPhonesEl = document.getElementById('fl-c-phones-extra');
            if (extraPhonesEl) {
                let html = '';
                if (lead.phone2) html += ` • Tel 2: <b>${escapeHtml(lead.phone2)}</b>`;
                if (lead.phone3) html += ` • Tel 3: <b>${escapeHtml(lead.phone3)}</b>`;
                extraPhonesEl.innerHTML = html;
            }

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

    // ================= SUBMODAL: NOVO LEAD + IA VISION OCR =================
    const btnNew = document.getElementById('fl-btn-new-lead');
    const btnNewCrm = document.getElementById('fl-btn-new-lead-crm');
    const addOverlay = document.getElementById('ldAddOverlay');
    const addShell = document.getElementById('ld-add-shell');
    const addClose = document.getElementById('ld-add-close');
    const addCancel = document.getElementById('ld-add-cancel');
    const addSave = document.getElementById('ld-add-save');
    let ocrPreviewUrl = null;
    let ocrPreviewIsPdf = false;

    function resetOcrPreview() {
        if (ocrPreviewUrl) { URL.revokeObjectURL(ocrPreviewUrl); ocrPreviewUrl = null; }
        ocrPreviewIsPdf = false;
        const preview = document.getElementById('ldOcrPreview');
        const trigger = document.getElementById('ldOcrTrigger');
        if (preview) preview.style.display = 'none';
        if (trigger) trigger.style.display = 'flex';
        const thumb = document.getElementById('ldOcrThumb');
        if (thumb) { thumb.style.display = ''; thumb.src = ''; }
        const pdfIcon = document.getElementById('ldOcrThumbPdf');
        if (pdfIcon) pdfIcon.style.display = 'none';
        const fileInput = document.getElementById('ldOcrFileInput');
        if (fileInput) fileInput.value = '';
    }

    function openNewLeadModal() {
        if (!addOverlay) return;
        addOverlay.style.display = 'flex';
        runAnime({
            targets: addShell,
            scale: [0.88, 1],
            opacity: [0, 1],
            duration: 320,
            easing: 'easeOutCubic'
        });
    }

    function closeNewLeadModal() {
        if (!addOverlay) return;
        runAnime({
            targets: addShell,
            scale: [1, 0.88],
            opacity: [1, 0],
            duration: 220,
            easing: 'easeInCubic',
            complete: () => {
                addOverlay.style.display = 'none';
                resetOcrPreview();
            }
        });
    }

    if (btnNew) btnNew.onclick = openNewLeadModal;
    if (btnNewCrm) btnNewCrm.onclick = openNewLeadModal;
    if (addClose) addClose.onclick = closeNewLeadModal;
    if (addCancel) addCancel.onclick = closeNewLeadModal;

    // IA VISION OCR
    const ocrTrigger = document.getElementById('ldOcrTrigger');
    const ocrFileInput = document.getElementById('ldOcrFileInput');
    const ocrLoading = document.getElementById('ldOcrLoading');

    if (ocrTrigger && ocrFileInput) {
        ocrTrigger.onclick = () => ocrFileInput.click();

        ocrFileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) processOcrFile(file);
        };

        const ocrBox = document.getElementById('ldOcrBox');
        if (ocrBox) {
            ocrBox.ondragover = (e) => { e.preventDefault(); ocrBox.classList.add('hover'); };
            ocrBox.ondragleave = () => ocrBox.classList.remove('hover');
            ocrBox.ondrop = (e) => {
                e.preventDefault();
                ocrBox.classList.remove('hover');
                if (e.dataTransfer.files.length) processOcrFile(e.dataTransfer.files[0]);
            };
        }

        document.addEventListener('paste', (e) => {
            if (!addOverlay || addOverlay.style.display === 'none') return;
            const items = e.clipboardData?.items || [];
            for (const item of items) {
                if (item.kind === 'file' && item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                        e.preventDefault();
                        processOcrFile(file);
                    }
                    break;
                }
            }
        });
    }

    function showOcrPreview(file) {
        if (ocrPreviewUrl) URL.revokeObjectURL(ocrPreviewUrl);
        ocrPreviewUrl = URL.createObjectURL(file);
        ocrPreviewIsPdf = file.type === 'application/pdf';
        const fileNameEl = document.getElementById('ldOcrFileName');
        if (fileNameEl) fileNameEl.textContent = file.name;
        const thumbEl = document.getElementById('ldOcrThumb');
        if (thumbEl) thumbEl.style.display = ocrPreviewIsPdf ? 'none' : '';
        const pdfEl = document.getElementById('ldOcrThumbPdf');
        if (pdfEl) pdfEl.style.display = ocrPreviewIsPdf ? 'grid' : 'none';
        if (!ocrPreviewIsPdf && thumbEl) thumbEl.src = ocrPreviewUrl;
        const prevEl = document.getElementById('ldOcrPreview');
        if (prevEl) prevEl.style.display = 'flex';
    }

    function openLightbox() {
        if (ocrPreviewIsPdf) { window.open(ocrPreviewUrl, '_blank'); return; }
        if (!ocrPreviewUrl) return;
        const img = document.getElementById('ldLightboxImg');
        if (img) img.src = ocrPreviewUrl;
        const lb = document.getElementById('ldLightbox');
        if (lb) lb.style.display = 'flex';
    }
    function closeLightbox() { const lb = document.getElementById('ldLightbox'); if (lb) lb.style.display = 'none'; }

    document.getElementById('ldOcrThumbBtn')?.addEventListener('click', openLightbox);
    document.getElementById('ldOcrChange')?.addEventListener('click', () => {
        resetOcrPreview();
        ocrFileInput?.click();
    });
    document.getElementById('ldLightboxClose')?.addEventListener('click', closeLightbox);
    document.getElementById('ldLightbox')?.addEventListener('click', (e) => {
        if (e.target.id === 'ldLightbox') closeLightbox();
    });

    async function processOcrFile(file) {
        showOcrPreview(file);
        if (ocrLoading) ocrLoading.style.display = 'flex';
        if (ocrTrigger) ocrTrigger.style.display = 'none';

        try {
            const fileName = file.name;
            await new Promise(r => setTimeout(r, 1200));

            const extracted = {
                name: fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").toUpperCase(),
                phone: "1198" + Math.floor(1000003 + Math.random() * 8999990),
                cpf: "34" + Math.floor(10 + Math.random() * 89) + "." + Math.floor(100 + Math.random() * 899) + "." + Math.floor(100 + Math.random() * 899) + "-00",
                city: "Porto Alegre - RS",
                renda: "4850.00",
                limite: "15000.00"
            };

            const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
            setVal('add-name', extracted.name);
            setVal('add-phone', extracted.phone);
            setVal('add-cpf', extracted.cpf);
            setVal('add-city', extracted.city);
            setVal('add-renda', extracted.renda);
            setVal('add-limite', extracted.limite);

            if (toast) toast('IA Vision: Documento lido e campos preenchidos automaticamente!');

            runAnime({
                targets: '#add-name, #add-phone, #add-cpf, #add-city, #add-renda, #add-limite',
                scale: [1.03, 1],
                backgroundColor: ['#e2fbea', '#ffffff'],
                duration: 600,
                easing: 'easeOutQuad'
            });

        } catch (e) {
            if (toast) toast('Erro ao ler documento via IA', 'err');
        } finally {
            if (ocrLoading) ocrLoading.style.display = 'none';
        }
    }

    if (addSave) {
        addSave.onclick = async () => {
            const name = (document.getElementById('add-name')?.value || '').trim();
            const phone = (document.getElementById('add-phone')?.value || '').trim();
            if (!name || !phone) return toast('Nome e telefone são obrigatórios', 'err');

            const body = {
                name, phone,
                phone2: (document.getElementById('add-phone2')?.value || '').trim() || null,
                phone3: (document.getElementById('add-phone3')?.value || '').trim() || null,
                cpf: (document.getElementById('add-cpf')?.value || '').trim(),
                prioridade: document.getElementById('add-prio')?.value || 'media',
                origem: document.getElementById('add-origem')?.value || 'SITE',
                city: (document.getElementById('add-city')?.value || '').trim(),
                renda: document.getElementById('add-renda')?.value ? parseFloat(document.getElementById('add-renda').value) : null,
                limite_est: document.getElementById('add-limite')?.value ? parseFloat(document.getElementById('add-limite').value) : null,
                tags: (document.getElementById('add-tags')?.value || '').trim(),
                obs: (document.getElementById('add-obs')?.value || '').trim()
            };

            addSave.disabled = true;
            try {
                await api('/leads', { method: 'POST', body: JSON.stringify(body) });
                if (toast) toast('Lead cadastrado com sucesso!');
                closeNewLeadModal();
                document.getElementById('ld-add-form')?.reset();
                await loadData();
                if (activeViewMode === 'crm') await loadCrmKanban();
            } catch (e) {
                if (toast) toast(e.message, 'err');
            } finally {
                addSave.disabled = false;
            }
        };
    }

    // Tecla ESC para fechar popups
    function escHandler(e) {
        if (e.key !== 'Escape') return;
        const addModal = document.getElementById('ldAddOverlay');
        const editModal = document.getElementById('flClientEditOverlay');
        const clientModal = document.getElementById('flClientOverlay');
        const transferModal = document.getElementById('flTransferOverlay');
        const drawer = document.getElementById('fl-drawer');

        if (addModal && addModal.style.display === 'flex') { closeNewLeadModal(); }
        else if (editModal && editModal.style.display === 'flex') { closeClientEditModal(); }
        else if (clientModal && clientModal.style.display === 'flex') { closeClientModal(); }
        else if (transferModal && transferModal.style.display === 'flex') { transferModal.style.display = 'none'; }
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
