const STAGES = [
    { key: 'novo', label: 'NOVO', color: '#3b82f6', dark: false },
    { key: 'contato', label: 'EM CONTATO', color: '#ffbd16', dark: true },
    { key: 'confirmado', label: 'CONFIRMADO', color: '#ff7417', dark: false },
    { key: 'concluido', label: 'CONCLUÍDO', color: '#10b981', dark: false }
];

let popupSearchTimer = null;
let automationJobTimer = null;

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
    const toast = window.toast;
    let data = null;
    let activeStage = null;
    let automationStage = 'novo';
    let stageConfigs = {};
    let availableNumbers = [];
    let templates = [];

    async function load() {
        const refresh = document.getElementById('fl-refresh');
        refresh.classList.add('spinning');
        try {
            const [funnel, configs, follows] = await Promise.all([api('/leads/funnel'), api('/tools/stage-config'), api('/tools/followups')]);
            data = funnel;
            stageConfigs = configs || {};
            renderReturns(follows || {});
            render();
        } catch (e) {
            document.getElementById('fl-column').innerHTML = `<div class="fl-empty-note">Erro ao carregar: ${escapeHtml(e.message)}</div>`;
        } finally {
            setTimeout(() => refresh.classList.remove('spinning'), 600);
        }
    }

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
            <div class="fl-return ${overdue ? 'overdue' : ''} pri-${f.prioridade || 'media'}" data-lead="${f.lead_id}" role="button" title="Abrir lead">
                <span class="fl-return-avatar">${escapeHtml(initials)}</span>
                <div class="fl-return-main">
                    <strong>${escapeHtml(f.name)}</strong>
                    <span>${escapeHtml(f.phone)}</span>
                </div>
                <span class="fl-return-badge">${overdue ? 'ATRASADO' : 'HOJE'}</span>
            </div>`;
        }).join('');
        box.querySelectorAll('.fl-return').forEach(el => {
            el.addEventListener('click', () => openStagePopupForLead(el.dataset.lead));
        });
    }

    async function openStagePopupForLead(leadId) {
        try {
            const leads = await api('/leads');
            const lead = leads.find(l => l.id === Number(leadId));
            if (!lead) return;
            openStagePopup(lead.status === 'duplicado' ? 'bloqueado' : lead.status);
            setTimeout(() => openSellerPopup(lead.seller_id), 400);
        } catch (e) { toast(e.message, 'err'); }
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
                const autoOn = !!stageConfigs[s.key]?.auto_send;
                return `
                <div class="fl-seg-wrap ${activeStage === s.key ? 'active' : ''}" data-stage="${s.key}" style="width:${width}%">
                    <div class="fl-seg" style="--t:${TAPER_PCT}; background:${color}; color:${txt};" title="Clique para ver os leads deste estágio">
                        <span class="fl-seg-label">${s.label}</span>
                        <span class="fl-seg-count">${nf(count)}</span>
                        <span class="fl-seg-right">
                            <span class="fl-seg-pct">${pct}% DO FUNIL</span>
                            <span class="fl-seg-cta"><i class="fas fa-arrow-up-right-from-square"></i> VER</span>
                        </span>
                        <button type="button" class="fl-tools-btn" data-tools-stage="${s.key}" title="Automações desta etapa"><i class="fas ${autoOn ? 'fa-wand-magic-sparkles' : 'fa-gear'}"></i></button>
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
        document.querySelectorAll('[data-tools-stage]').forEach(btn => {
            btn.addEventListener('click', e => { e.stopPropagation(); openAutomationPopup(btn.dataset.toolsStage); });
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

    // ================= POPUP: HUD DE VENDEDORES POR ESTÁGIO =================
    let popupStage = 'novo';
    let isAdmin = false;
    try { isAdmin = (JSON.parse(localStorage.getItem('prime_sul_user') || '{}').role === 'admin'); } catch (e) { isAdmin = false; }
    let sellersData = [];
    let currentSellerId = null;

    const AVATAR_COLORS = ['sv-blue','sv-orange','sv-green','sv-dark','sv-yellow'];

    const STAGE_META = {
        novo:       { icon: 'fa-hand-wave',    desc: 'Organize a base, priorize oportunidades e avance cada contato pelo funil sem perder contexto.', tags: [{ v: '0', l: 'LEADS' }, { v: '0', l: 'ETAPAS' }, { v: 'KANBAN', l: 'VISÃO' }], eyebrow: 'CARTEIRA COMERCIAL' },
        contato:    { icon: 'fa-phone-volume',  desc: 'Leads em ativação. Acompanhe quem está em contato e quem precisa de atenção.', tags: [{ v: '0', l: 'EM CONTATO' }, { v: '0', l: 'PENDENTES' }, { v: 'AUTOMAÇÃO', l: 'ATIVA' }], eyebrow: 'ATIVAÇÃO' },
        confirmado: { icon: 'fa-circle-check',  desc: 'Leads qualificados e confirmados. Pipeline de conversão em andamento.', tags: [{ v: '0', l: 'QUALIFICADOS' }, { v: '0', l: 'EM ANÁLISE' }, { v: 'PROPOSTA', l: 'ENVIADA' }], eyebrow: 'OPORTUNIDADES' },
        concluido:  { icon: 'fa-trophy',        desc: 'Leads convertidos e finalizados. Resultados da equipe nesta etapa.', tags: [{ v: '0', l: 'GANHOS' }, { v: '0', l: 'TOTAL' }, { v: 'META', l: 'ATINGIDA' }], eyebrow: 'RESULTADOS' }
    };

    function openStagePopup(key) {
        popupStage = key;
        activeStage = key;
        document.querySelectorAll('.fl-seg-wrap, .fl-detail-row').forEach(el => {
            el.classList.toggle('active', el.dataset.stage === activeStage);
        });
        const s = STAGES.find(x => x.key === key);
        const meta = STAGE_META[key] || STAGE_META.novo;

        document.getElementById('flp-stage-title').textContent = s.label;
        document.getElementById('flp-stage-panel').style.background =
            `radial-gradient(circle at 88% 14%,${s.color}55,transparent 30%),linear-gradient(145deg,#211c18,#171513)`;
        document.getElementById('flp-stage-eyebrow').textContent = meta.eyebrow;
        document.getElementById('flp-stage-desc').textContent = meta.desc;
        document.getElementById('flp-stage-icon').innerHTML = `<i class="fas ${meta.icon}"></i>`;
        document.getElementById('flp-stage-icon').style.background = s.color;
        document.getElementById('flp-sellers-eyebrow').textContent = meta.eyebrow;
        document.getElementById('flp-sellers-title').textContent = 'VENDEDORES';
        document.getElementById('flp-sellers-sub').textContent = 'Gerencie a equipe e acompanhe o desempenho nesta etapa.';

        document.getElementById('flpOverlay').style.display = 'flex';
        loadSellersForStage();
    }

    async function loadSellersForStage() {
        const grid = document.getElementById('flp-sellers-grid');
        grid.innerHTML = '<div class="ps-loading" style="grid-column:1/-1"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
        try {
            if (isAdmin) {
                sellersData = await api('/sellers/with-stats');
            } else {
                const me = await api('/sellers/me');
                const leads = await api('/leads?' + new URLSearchParams({ status: popupStage }));
                sellersData = [{ ...me, total_leads: leads.length, novo: 0, contato: 0, confirmado: 0, concluido: 0, ganho: 0, perdido: 0, total_fechado: 0 }];
                sellersData[0][popupStage] = leads.length;
            }
            renderHubCards();
        } catch (e) {
            grid.innerHTML = `<div class="ps-empty" style="grid-column:1/-1;color:var(--bad);">${escapeHtml(e.message)}</div>`;
        }
    }

    const STAGE_KEYS = ['novo','contato','confirmado','concluido'];
    function renderHubCards() {
        const grid = document.getElementById('flp-sellers-grid');
        const totalLeads = sellersData.reduce((a, s) => a + (s[popupStage] || 0), 0);
        const totalEquipe = sellersData.length;
        const totalFechado = sellersData.reduce((a, s) => a + (s.total_fechado || 0), 0);
        const idx = STAGE_KEYS.indexOf(popupStage);
        const nextStage = idx < STAGE_KEYS.length - 1 ? STAGE_KEYS[idx + 1] : null;
        const nextLabel = nextStage ? STAGES.find(s => s.key === nextStage)?.label : null;

        const meta = STAGE_META[popupStage] || STAGE_META.novo;
        meta.tags[0].v = String(totalLeads);
        meta.tags[1].v = String(totalEquipe);
        meta.tags[2].v = totalFechado > 0 ? `R$ ${nf(totalFechado)}` : 'KANBAN';

        document.getElementById('flp-stage-tags').innerHTML = meta.tags.map(t =>
            `<div class="flp-bottom-tag"><b>${t.v}</b><span>${t.l}</span></div>`).join('');
        document.getElementById('flp-sellers-count').textContent = `${totalEquipe} vendedor${totalEquipe !== 1 ? 'es' : ''}`;

        let html = '';

        html += `<button type="button" class="flp-res-card" data-res="ver-todos">
            <span class="flp-res-index">01</span>
            <span class="flp-res-icon blue"><i class="fas fa-columns"></i></span>
            <span class="flp-res-eyebrow">CARTEIRA</span>
            <span class="flp-res-title">ABRIR CARTEIRA</span>
            <span class="flp-res-desc">Veja e organize todos os leads desta etapa no quadro completo.</span>
            <span class="flp-res-link">ACESSAR <i class="fas fa-arrow-right"></i></span>
        </button>`;

        html += `<button type="button" class="flp-res-card" data-res="novo-lead">
            <span class="flp-res-index">02</span>
            <span class="flp-res-icon green"><i class="fas fa-user-plus"></i></span>
            <span class="flp-res-eyebrow">RECURSO</span>
            <span class="flp-res-title">NOVO LEAD</span>
            <span class="flp-res-desc">Cadastre uma oportunidade na sua lista exclusiva.</span>
            <span class="flp-res-link">ACESSAR <i class="fas fa-arrow-right"></i></span>
        </button>`;

        html += `<button type="button" class="flp-res-card" data-res="filtro-score">
            <span class="flp-res-index">03</span>
            <span class="flp-res-icon dark"><i class="fas fa-filter"></i></span>
            <span class="flp-res-eyebrow">RECURSO</span>
            <span class="flp-res-title">FILTROS E SCORE</span>
            <span class="flp-res-desc">Encontre prioridades, origens e melhores oportunidades.</span>
            <span class="flp-res-link">ACESSAR <i class="fas fa-arrow-right"></i></span>
        </button>`;

        html += `<button type="button" class="flp-res-card" data-res="automacoes">
            <span class="flp-res-index">04</span>
            <span class="flp-res-icon purple"><i class="fas fa-bolt"></i></span>
            <span class="flp-res-eyebrow">RECURSO</span>
            <span class="flp-res-title">AUTOMAÇÕES</span>
            <span class="flp-res-desc">Configure ações em cada coluna do processo.</span>
            <span class="flp-res-link">ACESSAR <i class="fas fa-arrow-right"></i></span>
        </button>`;

        if (sellersData.length) {
            html += `<div style="grid-column:1/-1;border-top:2px dashed rgba(24,23,22,.12);padding-top:12px;margin-top:4px;">
                <div style="font:900 .6rem var(--font-body);letter-spacing:1px;color:var(--text-muted);margin-bottom:8px;">EQUIPE</div>`;
            sellersData.forEach((s, i) => {
                const init = (s.name || ' ').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                const avClass = AVATAR_COLORS[i % AVATAR_COLORS.length];
                const stageCount = s[popupStage] || 0;
                html += `
                <article class="flp-res-card" style="margin-bottom:8px;" data-seller-id="${s.id}" data-res="seller">
                    <span class="flp-res-index" style="font-size:2rem;">${String(i + 1).padStart(2, '0')}</span>
                    <div style="display:flex;align-items:center;gap:12px;">
                        <span class="flp-seller-card-avatar ${avClass}" style="width:38px;height:38px;font-size:.7rem;">${escapeHtml(init)}</span>
                        <div style="flex:1;min-width:0;">
                            <div style="font:900 .88rem/1.1 var(--font-title);color:var(--dark);">${escapeHtml(s.name)}</div>
                            <div style="font:700 .54rem var(--font-body);color:var(--text-muted);margin-top:2px;">${nf(stageCount)} leads nesta etapa • R$ ${nf(s.total_fechado || 0)} fechado</div>
                        </div>
                        <span style="font:900 .6rem var(--font-body);color:var(--primary);white-space:nowrap;">VER →</span>
                    </div>
                </article>`;
            });
            html += '</div>';
        }

        grid.innerHTML = html;
    }

    function openSellerPopup(sellerId) {
        currentSellerId = sellerId;
        const s = sellersData.find(x => x.id === sellerId);
        if (!s) return;

        const init = (s.name || ' ').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
        const avIdx = sellersData.indexOf(s);
        const avClass = AVATAR_COLORS[avIdx >= 0 ? avIdx % AVATAR_COLORS.length : 0];
        document.getElementById('flp-seller-avatar').textContent = init;
        document.getElementById('flp-seller-avatar').className = `flp-seller-avatar ${avClass}`;
        document.getElementById('flp-seller-name').textContent = s.name;
        const statusEl = document.getElementById('flp-seller-status');
        statusEl.textContent = s.active !== 0 ? 'ATIVO' : 'INATIVO';
        statusEl.className = `flp-seller-status ${s.active !== 0 ? 'active' : 'inactive'}`;

        document.getElementById('flp-seller-info').innerHTML = `
            <div class="flp-info-card"><b>${escapeHtml(s.email || '—')}</b><span>E-MAIL</span></div>
            <div class="flp-info-card"><b>${escapeHtml(s.phone || '—')}</b><span>TELEFONE</span></div>
            <div class="flp-info-card"><b>${nf(s.total_leads || 0)}</b><span>LEADS TOTAIS</span></div>
            <div class="flp-info-card"><b>R$ ${nf(s.total_fechado || 0)}</b><span>VALOR FECHADO</span></div>`;

        const stages = ['novo','contato','confirmado','concluido'];
        const stageLabels = { novo:'NOVO',contato:'CONTATO',confirmado:'CONFIRMADO',concluido:'CONCLUÍDO' };
        document.getElementById('flp-seller-pipeline').innerHTML = stages.map((k, i) => {
            const arrow = i < stages.length - 1 ? '<span class="flp-pipe-arrow"><i class="fas fa-chevron-right"></i></span>' : '';
            return `<div class="flp-pipe-stage s-${k}"><b>${nf(s[k] || 0)}</b><span>${stageLabels[k]}</span></div>${arrow}`;
        }).join('');

        document.getElementById('flpSellerOverlay').style.display = 'flex';
        loadSellerLeads();
    }

    async function loadSellerLeads() {
        const list = document.getElementById('flp-seller-leads');
        list.innerHTML = '<div class="ps-loading"><i class="fas fa-spinner fa-spin"></i> Carregando leads...</div>';
        try {
            const search = (document.getElementById('flp-s-search').value || '').trim();
            const prio = document.getElementById('flp-s-prio').value;
            const params = { status: popupStage };
            if (search) params.search = search;
            if (prio) params.prioridade = prio;
            let leads;
            if (isAdmin) {
                leads = await api(`/leads/by-seller/${currentSellerId}?` + new URLSearchParams(params));
            } else {
                leads = await api('/leads?' + new URLSearchParams(params));
            }
            document.getElementById('flp-seller-total').textContent = `${leads.length} lead${leads.length !== 1 ? 's' : ''}`;
            if (!leads.length) {
                list.innerHTML = '<div class="ps-empty"><i class="fas fa-inbox"></i> Nenhum lead encontrado.</div>';
                return;
            }
            const AV_COLORS = ['av-blue','av-orange','av-green','av-dark','av-yellow'];
            list.innerHTML = leads.map(l => {
                const sc = l.score == null ? '—' : l.score;
                const init2 = (l.name || ' ').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
                const lim = l.limite_est ? `<span class="flp-chip value">R$ ${escapeHtml(l.limite_est)}</span>` : '';
                const tags = l.tags ? l.tags.split(',').map(t => `<span class="flp-tag">${escapeHtml(t.trim())}</span>`).join('') : '';
                return `
                <article class="flp-lead-card pri-${l.prioridade || 'media'}" data-id="${l.id}">
                    <span class="flp-lead-av ${AV_COLORS[(l.id || 0) % AV_COLORS.length]}">${escapeHtml(init2)}</span>
                    <div class="flp-lead-info">
                        <div class="flp-lead-name">${escapeHtml(l.name)}</div>
                        <div class="flp-lead-sub">${escapeHtml(l.phone)}${l.city ? ' • ' + escapeHtml(l.city) : ''}</div>
                        <div class="flp-lead-chips"><span class="flp-chip origin">${escapeHtml(l.origem || '—')}</span>${lim}${tags}</div>
                    </div>
                    <div class="flp-lead-right">
                        <span class="flp-lead-score ${scoreCls(l.score)}"><i class="fas fa-bolt"></i> ${sc}</span>
                        <span class="flp-lead-time">${relTime(l.created_at)}</span>
                    </div>
                </article>`;
            }).join('');
        } catch (e) {
            list.innerHTML = `<div class="ps-empty" style="color:var(--bad);">${escapeHtml(e.message)}</div>`;
        }
    }

    // controles do popup principal
    document.getElementById('flp-close').onclick = () => document.getElementById('flpOverlay').style.display = 'none';
    document.getElementById('flpOverlay').addEventListener('click', e => { if (e.target.id === 'flpOverlay') e.target.style.display = 'none'; });
    document.getElementById('flp-open-all').onclick = () => {
        document.getElementById('flpOverlay').style.display = 'none';
    };

    // cliques nos cards do hub
    document.getElementById('flp-sellers-grid').addEventListener('click', async e => {
        const card = e.target.closest('[data-res]');
        if (!card) return;
        const res = card.dataset.res;
        const sellerId = card.dataset.sellerId ? Number(card.dataset.sellerId) : null;
        if (res === 'seller' && sellerId) {
            openSellerPopup(sellerId);
        } else if (res === 'ver-todos') {
            openSellerPopup(sellersData[0]?.id);
        } else if (res === 'novo-lead') {
            toast('Use o formulário de novo lead no painel', 'info');
        } else if (res === 'filtro-score') {
            toast('Filtros disponíveis na carteira de leads', 'info');
        } else if (res === 'automacoes') {
            toast('Acesse as automações pelo botão de ferramentas', 'info');
        }
    });

    // controles do sub-popup
    document.getElementById('flp-seller-back').onclick = () => document.getElementById('flpSellerOverlay').style.display = 'none';
    document.getElementById('flp-seller-close').onclick = () => document.getElementById('flpSellerOverlay').style.display = 'none';
    document.getElementById('flp-seller-done').onclick = () => document.getElementById('flpSellerOverlay').style.display = 'none';
    document.getElementById('flpSellerOverlay').addEventListener('click', e => { if (e.target.id === 'flpSellerOverlay') e.target.style.display = 'none'; });
    document.getElementById('flp-s-clear').onclick = () => { document.getElementById('flp-s-search').value = ''; document.getElementById('flp-s-prio').value = ''; loadSellerLeads(); };
    document.getElementById('flp-s-search').addEventListener('input', () => { clearTimeout(popupSearchTimer); popupSearchTimer = setTimeout(loadSellerLeads, 300); });
    document.getElementById('flp-s-prio').addEventListener('change', loadSellerLeads);

    // ESC fecha popups
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (document.getElementById('flpSellerOverlay').style.display === 'flex') {
                document.getElementById('flpSellerOverlay').style.display = 'none';
            } else if (document.getElementById('flpOverlay').style.display === 'flex') {
                document.getElementById('flpOverlay').style.display = 'none';
            }
        }
    });

    // ================= POPUP DE AUTOMAÇÕES =================
    async function loadAutomationResources() {
        const [configs, numbers, templateRows] = await Promise.all([
            api('/tools/stage-config'), api('/campaigns/numbers'), api('/templates')
        ]);
        stageConfigs = configs || {};
        availableNumbers = (numbers || []).filter(n => n.status === 'ativo');
        templates = (templateRows || []).filter(t => t.purpose === 'screening');
    }

    function fillSelects() {
        const numberOptions = '<option value="">Seleção automática</option>' + availableNumbers.map(n =>
            `<option value="${n.id}">${escapeHtml(n.label || n.number || ('Número #' + n.id))}</option>`).join('');
        document.getElementById('fla-auto-number').innerHTML = numberOptions;
        document.getElementById('fla-send-number').innerHTML = numberOptions;
        const templateOptions = '<option value="">Aplicar um template...</option>' + templates.map(t =>
            `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
        document.getElementById('fla-auto-template').innerHTML = templateOptions;
    }

    async function openAutomationPopup(stage) {
        automationStage = stage;
        const meta = STAGES.find(s => s.key === stage) || { label: stage.toUpperCase() };
        document.getElementById('fla-stage').textContent = meta.label;
        document.getElementById('flaOverlay').style.display = 'flex';
        document.getElementById('fla-job').style.display = 'none';
        try {
            await loadAutomationResources();
            fillSelects();
            const cfg = stageConfigs[stage] || {};
            const canMessage = ['novo', 'contato'].includes(stage);
            document.getElementById('fla-card-auto').classList.toggle('disabled', !canMessage);
            document.getElementById('fla-card-send').classList.toggle('disabled', !canMessage);
            document.getElementById('fla-open-auto').disabled = !canMessage;
            document.getElementById('fla-open-send').disabled = !canMessage;
            document.getElementById('fla-auto').checked = !!cfg.auto_send;
            document.getElementById('fla-auto-msg').value = cfg.message || '';
            document.getElementById('fla-auto-number').value = cfg.number_id || '';
            document.getElementById('fla-send-msg').value = cfg.message || '';
            document.getElementById('fla-send-number').value = cfg.number_id || '';
            document.getElementById('fla-move-to').value = stage === 'novo' ? 'contato' : stage === 'contato' ? 'confirmado' : 'concluido';
            updatePreview();
            updateAutomationReadiness(cfg, canMessage);
        } catch (e) { toast(e.message, 'err'); }
    }

    function updateAutomationReadiness(cfg, canMessage) {
        const hasMessage = !!(cfg.message || '').trim();
        const hasNumber = availableNumbers.length > 0;
        const isActive = !!cfg.auto_send;
        setText('fla-stat-auto', isActive ? 'ATIVA' : 'PAUSADA');
        setText('fla-stat-msg', hasMessage ? 'PRONTA' : 'PENDENTE');
        setText('fla-stat-number', hasNumber ? String(availableNumbers.length) : 'NENHUM');
        if (!canMessage) {
            setText('fla-ready-label', 'ETAPA OPERACIONAL');
            setText('fla-ready-title', 'GESTÃO EM LOTE');
            setText('fla-ready-desc', 'Nesta etapa, use movimentação e score. Mensagens automáticas ficam disponíveis apenas em Novo e Em contato.');
        } else if (isActive && hasMessage && hasNumber) {
            setText('fla-ready-label', 'PRONTA PARA USO');
            setText('fla-ready-title', 'AUTOMAÇÃO ATIVA');
            setText('fla-ready-desc', 'Tudo certo: novos leads desta etapa receberão a mensagem configurada pelo número selecionado ou pela rotação automática.');
        } else {
            const missing = [!hasMessage && 'uma mensagem', !hasNumber && 'um número ativo', !isActive && 'ativar a automação'].filter(Boolean).join(', ');
            setText('fla-ready-label', 'CONFIGURAÇÃO PENDENTE');
            setText('fla-ready-title', 'FALTA POUCO');
            setText('fla-ready-desc', `Para deixar esta etapa pronta, configure ${missing}.`);
        }
    }

    function openFlaModal(id) { document.getElementById(id).style.display = 'flex'; }
    function closeFlaModal(id) { document.getElementById(id).style.display = 'none'; }

    function applyTemplate(selectId, textareaId) {
        const id = Number(document.getElementById(selectId).value);
        const template = templates.find(t => t.id === id);
        if (template) document.getElementById(textareaId).value = template.body;
        updatePreview();
    }

    function updatePreview() {
        const raw = document.getElementById('fla-auto-msg').value.trim();
        document.getElementById('fla-preview').textContent = raw
            ? raw.replace(/\{nome\}/g, 'Maria')
            : 'A prévia da mensagem automática aparecerá aqui.';
    }

    function withLimit(body, id) {
        const value = Number(document.getElementById(id).value);
        if (value > 0) body.limit = value;
        return body;
    }

    async function watchJob(job, title) {
        clearTimeout(automationJobTimer);
        const box = document.getElementById('fla-job');
        box.style.display = 'block';
        openFlaModal('flaProgressModal');
        document.getElementById('fla-job-title').textContent = title;
        const poll = async () => {
            try {
                const current = await api(`/tools/jobs/${job.id}`);
                const p = current.payload || {};
                const total = Number(p.total || 0);
                const done = Number(p.done || (current.status === 'done' ? total : 0));
                const pct = total ? Math.min(100, Math.round(done / total * 100)) : (current.status === 'done' ? 100 : 0);
                document.getElementById('fla-job-status').textContent = `${pct}% • ${current.status.toUpperCase()}`;
                document.getElementById('fla-job-bar').style.width = pct + '%';
                document.getElementById('fla-job-detail').textContent = `${done} de ${total || '?'} processados`;
                if (['done','failed','cancelled'].includes(current.status)) { load(); return; }
                automationJobTimer = setTimeout(poll, 1200);
            } catch (e) { document.getElementById('fla-job-detail').textContent = e.message; }
        };
        poll();
    }

    // ================= TRANSFERÊNCIA DE LEAD (admin) =================
    let transferLeadId = null;
    let transferLeads = [];

    async function openTransferModal(id) {
        transferLeadId = id;
        const lead = transferLeads.find(l => l.id === id);
        const info = document.getElementById('flt-lead-info');
        info.textContent = lead
            ? `Transferir ${lead.name} (${lead.phone}) para outro vendedor.`
            : 'Escolha o vendedor de destino.';
        try {
            const [sellers, leads] = await Promise.all([api('/sellers'), api('/leads')]);
            transferLeads = leads;
            const current = lead ? lead.seller_id : null;
            document.getElementById('flt-seller').innerHTML =
                '<option value="">Selecione o vendedor...</option>' +
                sellers.filter(s => s.active && s.id !== current && s.role !== 'admin').map(s =>
                    `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
            document.getElementById('flTransferOverlay').style.display = 'flex';
        } catch (e) { toast(e.message, 'err'); }
    }

    document.getElementById('flt-close').onclick = () => document.getElementById('flTransferOverlay').style.display = 'none';
    document.getElementById('flt-cancel').onclick = () => document.getElementById('flTransferOverlay').style.display = 'none';
    document.getElementById('flTransferOverlay').addEventListener('click', e => { if (e.target.id === 'flTransferOverlay') e.target.style.display = 'none'; });
    document.getElementById('flt-confirm').onclick = async () => {
        const toId = Number(document.getElementById('flt-seller').value);
        if (!toId) return toast('Selecione o vendedor de destino', 'err');
        if (!confirm('Confirmar transferência deste lead?')) return;
        try {
            const r = await api(`/leads/${transferLeadId}/transfer`, { method: 'POST', body: JSON.stringify({ to_seller_id: toId }) });
            toast(r.transferred ? `Lead transferido para ${r.target_name}!` : 'Lead já pertencia a este vendedor', 'info');
            document.getElementById('flTransferOverlay').style.display = 'none';
            loadSellersForStage();
            load();
        } catch (e) { toast(e.message, 'err'); }
    };

    document.getElementById('fla-close').onclick = () => document.getElementById('flaOverlay').style.display = 'none';
    document.getElementById('flaOverlay').addEventListener('click', e => { if (e.target.id === 'flaOverlay') e.target.style.display = 'none'; });
    document.querySelectorAll('[data-fla-close]').forEach(btn => btn.onclick = () => closeFlaModal(btn.dataset.flaClose));
    document.querySelectorAll('.fla-editor-overlay').forEach(overlay => overlay.addEventListener('click', e => { if (e.target === overlay) closeFlaModal(overlay.id); }));
    const openMessageTool = id => {
        if (!['novo', 'contato'].includes(automationStage)) return toast('Mensagens estão disponíveis apenas em Novo e Em contato', 'info');
        openFlaModal(id);
    };
    document.getElementById('fla-open-auto').onclick = () => openMessageTool('flaAutoModal');
    document.getElementById('fla-card-auto').onclick = () => openMessageTool('flaAutoModal');
    document.getElementById('fla-open-send').onclick = () => openSendModal();
    document.getElementById('fla-card-send').onclick = () => openSendModal();
    document.getElementById('fla-card-move').onclick = () => openFlaModal('flaMoveModal');
    document.getElementById('fla-card-score').onclick = () => openFlaModal('flaScoreModal');
    document.getElementById('fla-auto-msg').addEventListener('input', updatePreview);

    // ================= MODAL: DISPARO EM MASSA =================
    const SEND_STAGES = [
        { key: 'novo', label: 'NOVO' },
        { key: 'contato', label: 'EM CONTATO' },
        { key: 'confirmado', label: 'CONFIRMADO' },
        { key: 'concluido', label: 'CONCLUÍDO' }
    ];
    let sendSelectedStages = [automationStage];

    function openSendModal() {
        if (typeof window.openCampaignEditor === 'function') {
            window.openCampaignEditor({ stage: automationStage });
        } else {
            openFlaModal('flaSendModal');
        }
    }

    function renderSendChips() {
        document.getElementById('send-stage-chips').innerHTML = SEND_STAGES.map(s =>
            `<button type="button" class="send-chip ${sendSelectedStages.includes(s.key) ? 'active' : ''}" data-stage="${s.key}"><i class="fas fa-circle" style="font-size:.4rem;"></i> ${s.label}</button>`
        ).join('');
        document.querySelectorAll('#send-stage-chips .send-chip').forEach(btn => {
            btn.onclick = () => {
                const k = btn.dataset.stage;
                if (sendSelectedStages.includes(k)) {
                    if (sendSelectedStages.length > 1) sendSelectedStages = sendSelectedStages.filter(s => s !== k);
                } else {
                    sendSelectedStages.push(k);
                }
                renderSendChips();
                updateSendCount();
            };
        });
    }

    function updateSendPreview() {
        const raw = document.getElementById('fla-send-msg').value.trim();
        const text = raw
            ? raw.replace(/\{nome\}/g, 'Maria').replace(/\{NOME\}/g, 'Maria')
            : 'Olá! Você pediu uma simulação de crédito...';
        document.getElementById('send-preview-text').textContent = text;
    }

    async function updateSendCount() {
        const countEl = document.getElementById('send-count');
        try {
            let total = 0;
            for (const st of sendSelectedStages) {
                const params = { status: st };
                const origem = document.getElementById('fla-send-origem').value.trim();
                const prio = document.getElementById('fla-send-prio').value;
                const cidade = document.getElementById('fla-send-cidade').value.trim();
                if (origem) params.origem = origem;
                if (prio) params.prioridade = prio;
                if (cidade) params.cidade = cidade;
                const leads = await api('/leads?' + new URLSearchParams(params));
                total += leads.length;
            }
            const limit = Number(document.getElementById('fla-send-limit').value) || 0;
            const final = limit > 0 ? Math.min(total, limit) : total;
            countEl.innerHTML = `<i class="fas fa-users"></i> <b>${final}</b> lead(s) serão selecionados`;
        } catch (e) {
            countEl.innerHTML = `<i class="fas fa-users"></i> <b>—</b> lead(s) serão selecionados`;
        }
    }

    document.getElementById('fla-send-msg').addEventListener('input', updateSendPreview);
    ['fla-send-origem', 'fla-send-prio', 'fla-send-cidade', 'fla-send-limit'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateSendCount);
        document.getElementById(id).addEventListener('change', updateSendCount);
    });

    document.getElementById('fla-save').onclick = async () => {
        const body = {
            status: automationStage,
            config: {
                auto_send: document.getElementById('fla-auto').checked,
                message: document.getElementById('fla-auto-msg').value.trim(),
                number_id: Number(document.getElementById('fla-auto-number').value) || null
            }
        };
        try {
            await api('/tools/stage-config', { method: 'PUT', body: JSON.stringify(body) });
            toast('Automação da etapa salva!');
            closeFlaModal('flaAutoModal');
            await loadAutomationResources();
            updateAutomationReadiness(stageConfigs[automationStage] || body.config, ['novo', 'contato'].includes(automationStage));
            await load();
        } catch (e) { toast(e.message, 'err'); }
    };

    document.getElementById('fla-send').onclick = async () => {
        const message = document.getElementById('fla-send-msg').value.trim();
        if (!message) return toast('Informe a mensagem do disparo', 'err');
        if (!sendSelectedStages.length) return toast('Selecione pelo menos uma etapa', 'err');
        const name = document.getElementById('fla-send-name').value.trim() || `Disparo ${new Date().toLocaleDateString('pt-BR')}`;
        if (!confirm(`Criar campanha "${name}" para ${sendSelectedStages.length} etapa(s)?`)) return;
        const body = {
            name,
            status: sendSelectedStages.length === 1 ? sendSelectedStages[0] : automationStage,
            stages: sendSelectedStages,
            message,
            number_id: Number(document.getElementById('fla-send-number').value) || null,
            origem: document.getElementById('fla-send-origem').value.trim() || undefined,
            prioridade: document.getElementById('fla-send-prio').value || undefined,
            cidade: document.getElementById('fla-send-cidade').value.trim() || undefined
        };
        const limit = Number(document.getElementById('fla-send-limit').value);
        if (limit > 0) body.limit = limit;
        try {
            const result = await api('/tools/send', { method: 'POST', body: JSON.stringify(body) });
            toast('Campanha criada e iniciada!');
            closeFlaModal('flaSendModal');
            if (result.job_id) watchJob({ id: result.job_id }, 'DISPARO DA ETAPA');
        } catch (e) { toast(e.message, 'err'); }
    };

    document.getElementById('fla-move').onclick = async () => {
        const to = document.getElementById('fla-move-to').value;
        if (to === automationStage) return toast('Escolha uma etapa diferente', 'err');
        if (!confirm(`Mover leads de ${automationStage.toUpperCase()} para ${to.toUpperCase()}?`)) return;
        try {
            const result = await api('/tools/move', { method: 'POST', body: JSON.stringify(withLimit({ status: automationStage, to_status: to }, 'fla-move-limit')) });
            closeFlaModal('flaMoveModal');
            watchJob(result.job, 'MOVENDO LEADS');
        } catch (e) { toast(e.message, 'err'); }
    };

    document.getElementById('fla-score').onclick = async () => {
        try {
            const result = await api('/tools/recalc', { method: 'POST', body: JSON.stringify(withLimit({ status: automationStage }, 'fla-score-limit')) });
            closeFlaModal('flaScoreModal');
            watchJob(result.job, 'RECALCULANDO SCORES');
        } catch (e) { toast(e.message, 'err'); }
    };

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
    clearTimeout(automationJobTimer);
}
