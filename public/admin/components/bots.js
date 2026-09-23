const CONN_LABEL = { connected: 'CONECTADO', connecting: 'CONECTANDO', offline: 'OFFLINE', disconnected: 'DESCONECTADO', logged_out: 'DESCONECTADO', banned: 'BANIDO' };
const BAN_LABEL = { ativo: 'ATIVO', resfriado: 'RESFRIADO', banido: 'BANIDO' };
const WA_STATUS_LABEL = { novos: 'NOVO', enviados: 'EM CONTATO', sim: 'CONFIRMADO', nao: 'SEM INTERESSE', bloqueado: 'BLOQUEADO', duplicado: 'DUPLICADO', novo: 'NOVO', contato: 'EM CONTATO', confirmado: 'CONFIRMADO', concluido: 'CONCLUÍDO' };
const WA_PRIO_LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

const _pollers = new Map();
let _leads = [];
let _activeLead = null;
let _threads = [];
let _activeThreadKey = null;
let _availableBots = [];
let _botFilter = 'all';
let _selectedSendBotNumber = null;
let _onLiveMessage = null;
let _onWaConnected = null;
const threadKey = t => `${t.lead_phone}|${t.bot_number || ''}`;

function fmtNum(n) {
    const d = String(n || '').replace(/\D/g, '');
    if (d.length === 13 && d.startsWith('55')) {
        return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
    }
    if (d.length === 12 && d.startsWith('55')) {
        return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
    }
    if (d.length >= 10) {
        return `(${d.slice(-11, -9)}) ${d.slice(-9, -4)}-${d.slice(-4)}`;
    }
    return n || '';
}

function waPhoneKey(input) {
    let p = String(input || '').replace(/\D/g, '');
    if (!p) return '';
    if (p.startsWith('00')) p = p.slice(2);
    if (p.length >= 11 && p.length <= 13 && p.startsWith('0')) p = p.slice(1);
    if (p.length === 10 || p.length === 11) p = '55' + p;
    if (!p.startsWith('55')) return p;
    const rest = p.slice(2);
    if (rest.length !== 10 && rest.length !== 11) return p;
    const ddd = rest.slice(0, 2);
    const sub = rest.slice(2);
    const core = sub.length === 9 && sub[0] === '9' ? sub.slice(1) : sub;
    return /^[6-9]/.test(core) ? `55${ddd}9${core}` : p;
}

export async function init() {
    const api = window.api;
    const toast = window.toast;
    const esc = window.escapeHtml || (s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));

    let isAdmin = false;
    let myId = null;
    try {
        const u = JSON.parse(localStorage.getItem('prime_sul_user') || '{}');
        isAdmin = (u.role === 'admin');
        myId = u.id ?? null;
    } catch (e) {}

    // ================= TABS SWITCHING =================
    const tabBtns = document.querySelectorAll('.bt-tab-btn');
    const tabPanels = document.querySelectorAll('.bt-tab-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.toggle('active', b === btn));
            tabPanels.forEach(p => p.classList.toggle('active', p.id === `bt-panel-${targetTab}`));
            if (targetTab === 'config') refresh();
            if (targetTab === 'pipeline') loadBotPipeline();
            if (targetTab === 'mensagens') loadBotMessagesConfig();
        });
    });

    // ================= FUNIL BOT: CENTRAL DE CONVERSÃO =================
    function bpRelTime(value) {
        if (!value) return 'sem data';
        const d = new Date(String(value).replace(' ', 'T'));
        if (Number.isNaN(d.getTime())) return 'sem data';
        const diff = Math.max(0, Date.now() - d.getTime());
        const min = Math.floor(diff / 60000);
        if (min < 60) return `${min || 1} min atrás`;
        const h = Math.floor(min / 60);
        if (h < 24) return `${h}h atrás`;
        return `${Math.floor(h / 24)}d atrás`;
    }

    function bpCanonicalStatus(status) {
        return ({ novo: 'novos', contato: 'enviados', confirmado: 'sim', concluido: 'sim' })[status] || status;
    }

    function bpStageLabel(status) {
        const s = bpCanonicalStatus(status);
        return ({ novos: 'A fazer', enviados: 'Aguardando resposta', sim: 'Interessado', nao: 'Não quer', bloqueado: 'Bloqueado', duplicado: 'Duplicado' })[s] || s || 'Lead';
    }

    function showBpContextMenu(event, lead, setStatus, openLead) {
        if (!lead) return;
        document.querySelector('.bp-context-menu')?.remove();
        const phone = String(lead.phone || '').replace(/\D/g, '');
        const wa = phone ? (phone.startsWith('55') ? phone : `55${phone}`) : '';
        const menu = document.createElement('div');
        menu.className = 'bp-context-menu';
        menu.innerHTML = `
            <button type="button" data-act="open"><i class="fas fa-comments"></i><span>Abrir conversa</span></button>
            <button type="button" data-act="enviados"><i class="fas fa-paper-plane"></i><span>Marcar aguardando resposta</span></button>
            <button type="button" data-act="sim"><i class="fas fa-fire"></i><span>Marcar interessado</span></button>
            <button type="button" data-act="nao"><i class="fas fa-ban"></i><span>Marcar não quer</span></button>
            <button type="button" data-act="bloqueado"><i class="fas fa-lock"></i><span>Bloquear lead</span></button>
            ${wa ? `<button type="button" data-act="wa"><i class="fab fa-whatsapp"></i><span>Abrir WhatsApp Web</span></button>` : ''}
        `;
        document.body.appendChild(menu);
        const x = Math.min(event.clientX || 0, window.innerWidth - 250);
        const y = Math.min(event.clientY || 0, window.innerHeight - 250);
        menu.style.left = `${Math.max(8, x)}px`;
        menu.style.top = `${Math.max(8, y)}px`;
        const close = () => menu.remove();
        setTimeout(() => document.addEventListener('click', close, { once: true }), 0);
        menu.addEventListener('click', async e => {
            e.stopPropagation();
            const act = e.target.closest('button')?.dataset.act;
            close();
            if (act === 'open') return openLead(lead);
            if (act === 'wa' && wa) return window.open(`https://wa.me/${wa}`, '_blank');
            if (['novos', 'enviados', 'sim', 'nao', 'bloqueado'].includes(act)) return setStatus(lead, act);
        });
    }

    function showBpStageMenu(event, stage, count, renderStage) {
        document.querySelector('.bp-context-menu')?.remove();
        const menu = document.createElement('div');
        menu.className = 'bp-context-menu bp-stage-context-menu';
        menu.innerHTML = `
            <button type="button" data-act="list"><i class="fas fa-list"></i><span>Listar ${count} leads desta etapa</span></button>
            <button type="button" data-act="clear"><i class="fas fa-layer-group"></i><span>Voltar para prioridade geral</span></button>
            <button type="button" data-act="wallet"><i class="fas fa-address-book"></i><span>Abrir Carteira de Clientes</span></button>
            <button type="button" data-act="refresh"><i class="fas fa-rotate-right"></i><span>Atualizar Funil Bot</span></button>
        `;
        document.body.appendChild(menu);
        const x = Math.min(event.clientX || 0, window.innerWidth - 260);
        const y = Math.min(event.clientY || 0, window.innerHeight - 220);
        menu.style.left = `${Math.max(8, x)}px`;
        menu.style.top = `${Math.max(8, y)}px`;
        const close = () => menu.remove();
        setTimeout(() => document.addEventListener('click', close, { once: true }), 0);
        menu.addEventListener('click', async e => {
            e.stopPropagation();
            const act = e.target.closest('button')?.dataset.act;
            close();
            if (act === 'list') return renderStage(stage);
            if (act === 'clear') return renderStage(null);
            if (act === 'refresh') return loadBotPipeline();
            if (act === 'wallet') {
                const item = document.querySelector('[data-module="leads"], [data-target="leads"], [data-page="leads"]');
                if (item) item.click();
                else toast('Abra a Carteira de Clientes pelo menu lateral.', 'info');
            }
        });
    }

    async function loadBotPipeline() {
        const flowEl = document.getElementById('bp-flow');
        const prioEl = document.getElementById('bp-priority-list');
        const insightEl = document.getElementById('bp-insights');
        if (!flowEl || !prioEl || !insightEl) return;
        flowEl.innerHTML = '<div class="ps-loading"><i class="fas fa-spinner fa-spin"></i> Montando funil inteligente...</div>';
        try {
            const [funnel, leads] = await Promise.all([api('/leads/funnel'), api('/leads')]);
            const normalizedLeads = (leads || []).map(l => ({ ...l, status: bpCanonicalStatus(l.status) }));
            const fromLeads = normalizedLeads.reduce((acc, l) => {
                if (['novos', 'enviados', 'sim', 'nao'].includes(l.status)) acc[l.status] = (acc[l.status] || 0) + 1;
                return acc;
            }, { novos: 0, enviados: 0, sim: 0, nao: 0 });
            const stages = funnel.stages || {};
            const nums = {
                novos: Math.max(Number(stages.novos || 0), fromLeads.novos),
                enviados: Math.max(Number(stages.enviados || 0), fromLeads.enviados),
                sim: Math.max(Number(stages.sim || 0), fromLeads.sim),
                nao: Math.max(Number(stages.nao || 0), fromLeads.nao)
            };
            const total = Math.max(1, nums.novos + nums.enviados + nums.sim + nums.nao, Number(funnel.total || 0), normalizedLeads.length);
            const replyTotal = nums.sim + nums.nao;
            const responseRate = nums.enviados + replyTotal ? Math.round((replyTotal / (nums.enviados + replyTotal)) * 100) : 0;
            const hotRate = replyTotal ? Math.round((nums.sim / replyTotal) * 100) : 0;
            const health = Math.max(0, Math.min(100, Math.round((hotRate * 0.55) + (responseRate * 0.35) + (nums.novos ? 5 : 10))));
            const healthEl = document.getElementById('bp-health');
            const healthLabel = document.getElementById('bp-health-label');
            if (healthEl) healthEl.textContent = `${health}%`;
            if (healthLabel) healthLabel.textContent = health >= 70 ? 'Operação aquecida' : health >= 40 ? 'Funil em formação' : 'Precisa gerar respostas';

            const stageDefs = [
                { key: 'novos', icon: 'fa-seedling', title: 'Captar', sub: 'Leads novos aguardando primeiro disparo', action: 'Criar disparo', color: '#3b82f6' },
                { key: 'enviados', icon: 'fa-paper-plane', title: 'Bot trabalhando', sub: 'Mensagem enviada; esperar SIM/NÃO', action: 'Monitorar retorno', color: '#f59e0b' },
                { key: 'sim', icon: 'fa-fire-flame-curved', title: 'Quentes', sub: 'Cliente demonstrou interesse', action: 'Vendedor atende agora', color: '#10b981' },
                { key: 'nao', icon: 'fa-circle-xmark', title: 'Perdidos', sub: 'Não quer ou sem interesse', action: 'Não insistir', color: '#ef4444' }
            ];

            flowEl.innerHTML = stageDefs.map((s, idx) => {
                const count = nums[s.key] || 0;
                const pct = Math.round((count / total) * 100);
                return `<article class="bp-stage" data-bp-stage="${s.key}" style="--bp:${s.color};" title="Clique para listar. Botão direito para ações da etapa.">
                    <div class="bp-stage-top"><span><i class="fas ${s.icon}"></i></span><em>${String(idx + 1).padStart(2, '0')}</em></div>
                    <h3>${esc(s.title)}</h3>
                    <p>${esc(s.sub)}</p>
                    <div class="bp-stage-num"><b>${count}</b><small>${pct}% do funil</small></div>
                    <div class="bp-stage-bar"><i style="width:${pct}%;"></i></div>
                    <strong data-bp-stage-action="${s.key}">${esc(s.action)}</strong>
                </article>`;
            }).join('');

            let currentBpStage = null;
            const sortPriority = arr => [...arr].sort((a, b) => {
                const rank = { sim: 0, enviados: 1, novos: 2, nao: 3 };
                return (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || Number(b.score || 0) - Number(a.score || 0);
            });
            const findLead = el => normalizedLeads.find(l => String(l.id) === String(el.dataset.bpLead));
            const openLead = lead => {
                const tab = document.querySelector('.bt-tab-btn[data-tab="conversas"]');
                tab?.click();
                if (lead) setTimeout(() => selectLead(lead), 80);
            };
            const setLeadStatus = async (lead, status) => {
                if (!lead) return;
                await api(`/leads/${lead.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
                toast(`Lead movido para ${bpStageLabel(status)}`, 'ok');
                await loadBotPipeline();
                await loadLeads();
            };
            const bindBpRows = () => {
                prioEl.querySelectorAll('[data-bp-lead]').forEach(row => {
                    row.addEventListener('click', async e => {
                        const action = e.target.closest('[data-bp-action]')?.dataset.bpAction;
                        const lead = findLead(row);
                        if (action === 'sim') return setLeadStatus(lead, 'sim');
                        if (action === 'menu') return showBpContextMenu(e, lead, setLeadStatus, openLead);
                        openLead(lead);
                    });
                    row.addEventListener('contextmenu', e => {
                        e.preventDefault();
                        showBpContextMenu(e, findLead(row), setLeadStatus, openLead);
                    });
                });
            };
            const renderBpLeadList = (stage = null) => {
                currentBpStage = stage;
                flowEl.querySelectorAll('.bp-stage').forEach(card => card.classList.toggle('active', !!stage && card.dataset.bpStage === stage));
                const titleEl = document.querySelector('.bp-priority .bp-panel-head b');
                if (titleEl) titleEl.textContent = stage ? `${bpStageLabel(stage)} — ${nums[stage] || 0} leads` : 'Quem merece ação agora';
                const rows = sortPriority(stage ? normalizedLeads.filter(l => l.status === stage) : normalizedLeads.filter(l => ['sim', 'enviados', 'novos'].includes(l.status))).slice(0, stage ? 80 : 8);
                prioEl.innerHTML = rows.length ? rows.map(l => `
                <div class="bp-lead-row" data-bp-lead="${l.id}" title="Clique para abrir. Botão direito para ações rápidas.">
                    <span class="bp-avatar">${esc(String(l.name || '?').split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase())}</span>
                    <span class="bp-lead-main"><b>${esc(l.name || 'Sem nome')}</b><small>${esc(bpStageLabel(l.status))} • ${esc(bpRelTime(l.updated_at || l.created_at))}</small></span>
                    <em>${l.score == null ? '—' : esc(l.score)}</em>
                    <span class="bp-row-actions">
                        <button type="button" data-bp-action="open" title="Abrir conversa"><i class="fas fa-comments"></i></button>
                        <button type="button" data-bp-action="sim" title="Marcar interessado"><i class="fas fa-fire"></i></button>
                        <button type="button" data-bp-action="menu" title="Mais ações"><i class="fas fa-ellipsis-vertical"></i></button>
                    </span>
                </div>`).join('') : '<div class="bp-empty">Nenhum lead nesta etapa.</div>';
                bindBpRows();
            };

            renderBpLeadList(null);
            flowEl.querySelectorAll('.bp-stage').forEach(card => {
                card.addEventListener('click', e => {
                    const stage = card.dataset.bpStage;
                    renderBpLeadList(currentBpStage === stage ? null : stage);
                });
                card.addEventListener('contextmenu', e => {
                    e.preventDefault();
                    showBpStageMenu(e, card.dataset.bpStage, nums[card.dataset.bpStage] || 0, renderBpLeadList);
                });
            });

            const bottleneck = nums.novos >= nums.enviados && nums.novos >= nums.sim ? 'Muitos leads ainda sem abordagem. Priorize disparo de campanha.'
                : nums.enviados > nums.sim ? 'O gargalo está em resposta: acompanhe mensagens e melhore a chamada para SIM.'
                : nums.sim ? 'Você tem leads quentes: vendedor precisa atender rápido para converter.'
                : 'Funil limpo. Gere novos leads ou novos disparos.';
            insightEl.innerHTML = `
                <div class="bp-insight good"><i class="fas fa-chart-line"></i><span>Taxa de resposta estimada</span><b>${responseRate}%</b></div>
                <div class="bp-insight hot"><i class="fas fa-fire"></i><span>Qualidade dos retornos SIM</span><b>${hotRate}%</b></div>
                <div class="bp-insight warn"><i class="fas fa-triangle-exclamation"></i><span>${esc(bottleneck)}</span></div>`;
        } catch (e) {
            flowEl.innerHTML = `<div class="bp-empty">Erro ao carregar funil: ${esc(e.message)}</div>`;
        }
    }

    // ================= WHATSAPP PREVIEW: LEADS LIST =================
    const leadListEl = document.getElementById('waLeadList');
    const searchInput = document.getElementById('waLeadSearch');
    const botFilterBar = document.getElementById('waSidebarBotFilters');

    async function loadBots() {
        try {
            const data = await api('/whatsapp/status');
            if (data && data.numbers) {
                _availableBots = data.numbers;
                renderBotFilters();
            }
        } catch (e) {}
    }

    async function loadLeads() {
        if (!leadListEl) return;
        try {
            await loadBots();
            const res = await api('/leads?limit=50').catch(() => []);
            _leads = Array.isArray(res) ? res : (res.leads || []);
            renderBotFilters();
            applyLeadFilters();
            if (_leads.length > 0 && !_activeLead) {
                selectLead(_leads[0]);
            }
        } catch (e) {
            leadListEl.innerHTML = `<div class="ps-empty" style="padding:20px; color:var(--bad);">Erro ao carregar leads</div>`;
        }
    }

    function renderBotFilters() {
        if (!botFilterBar) return;

        // Mapeia bots a partir de _availableBots e também dos leads
        const map = new Map();
        for (const b of _availableBots) {
            if (b && b.number) {
                map.set(b.number, {
                    number: b.number,
                    label: b.label || (b.slot_index ? `WhatsApp ${b.slot_index}` : 'WhatsApp'),
                    short_name: b.slot_index ? `WA ${b.slot_index}` : (b.label ? (b.label.length > 10 ? b.label.slice(0, 10) : b.label) : 'WA'),
                    slot_index: b.slot_index,
                    real_number: b.realNumber || b.real_number || null,
                    status: b.status,
                    connection: b.connection
                });
            }
        }
        for (const l of _leads) {
            if (l.wa && l.wa.bots) {
                for (const b of l.wa.bots) {
                    if (b && b.number && !map.has(b.number)) {
                        map.set(b.number, b);
                    }
                }
            }
        }

        const botsList = [...map.values()].sort((a, b) => (a.slot_index || 99) - (b.slot_index || 99));

        botFilterBar.innerHTML = `
            <button type="button" class="wa-bot-filter-pill ${ _botFilter === 'all' ? 'active' : '' }" data-bot="all">
                <i class="fas fa-layer-group"></i> Todos
            </button>
            ${botsList.map(b => {
                const active = _botFilter === b.number;
                const slotCls = b.slot_index ? `zap-${b.slot_index}` : 'zap-other';
                const label = b.short_name || b.label || `WA ${b.slot_index || ''}`;
                const title = `${b.label || 'WhatsApp'} ${b.real_number ? '(' + fmtNum(b.real_number) + ')' : ''}`;
                return `<button type="button" class="wa-bot-filter-pill ${slotCls} ${active ? 'active' : ''}" data-bot="${esc(b.number)}" title="${esc(title)}">
                    <i class="fab fa-whatsapp"></i> ${esc(label)}
                </button>`;
            }).join('')}
        `;

        botFilterBar.querySelectorAll('.wa-bot-filter-pill').forEach(btn => {
            btn.onclick = () => {
                _botFilter = btn.dataset.bot;
                botFilterBar.querySelectorAll('.wa-bot-filter-pill').forEach(b => b.classList.toggle('active', b === btn));
                applyLeadFilters();
            };
        });
    }

    function applyLeadFilters() {
        const q = (searchInput ? searchInput.value : '').toLowerCase().trim();
        const filtered = _leads.filter(l => {
            const matchText = !q || (
                (l.name || '').toLowerCase().includes(q) ||
                (l.phone || '').includes(q) ||
                (l.city || '').toLowerCase().includes(q)
            );
            if (!matchText) return false;

            if (_botFilter === 'all') return true;
            const wa = l.wa || {};
            const botNumbers = wa.bot_numbers || [];
            return botNumbers.includes(_botFilter);
        });
        renderLeadList(filtered);
    }

    function renderLeadList(list) {
        if (!leadListEl) return;
        if (!list.length) {
            leadListEl.innerHTML = `<div class="ps-empty" style="padding:20px;">Nenhum lead encontrado</div>`;
            return;
        }
        const byPhone = new Map();
        for (const l of list) {
            const key = waPhoneKey(l.phone) || String(l.id);
            const prev = byPhone.get(key);
            if (!prev) { byPhone.set(key, l); continue; }
            const rank = x => (x.status === 'bloqueado' || x.status === 'duplicado') ? 0 : (x.wa && x.wa.has_chat ? 2 : 1);
            if (rank(l) > rank(prev)) byPhone.set(key, l);
        }
        const viewList = [...byPhone.values()];

        leadListEl.innerHTML = viewList.map(l => {
            const initials = (l.name || 'L').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
            const isActive = _activeLead && _activeLead.id === l.id;
            const statusStr = WA_STATUS_LABEL[l.status] || 'NOVO';
            const wa = l.wa || {};

            // Tags / Chips visíveis de qual WhatsApp da empresa conversou com ele
            let botChips = '';
            if (wa.bots && wa.bots.length > 0) {
                botChips = wa.bots.map(b => {
                    const slotCls = b.slot_index ? `zap-${b.slot_index}` : 'zap-other';
                    const numDisplay = b.real_number ? fmtNum(b.real_number) : (b.number || '');
                    const title = `Conversando via ${b.label || 'WhatsApp'} • ${numDisplay} (${b.status || 'ativo'})`;
                    return `<span class="wa-bot-chip ${slotCls}" title="${esc(title)}"><i class="fab fa-whatsapp"></i> ${esc(b.short_name || 'WA')}</span>`;
                }).join('');
            } else {
                botChips = `<span class="wa-bot-chip zap-none" title="Nenhuma mensagem iniciada ainda"><i class="far fa-comment"></i> Sem msg</span>`;
            }

            let unreadTag = '';
            if (wa.unread) {
                unreadTag = `<span class="wa-lead-tag wa-unread" title="${wa.unread} mensagens não lidas"><i class="fab fa-whatsapp"></i> ${wa.unread}</span>`;
            } else if (wa.has_chat && (!wa.bots || !wa.bots.length)) {
                unreadTag = `<span class="wa-lead-tag"><i class="fab fa-whatsapp"></i></span>`;
            }
            const multiPhone = (wa.phones || 0) > 1 ? `<span class="wa-lead-tag wa-multi" title="${wa.phones} telefones">+${wa.phones - 1} nº</span>` : '';

            return `
                <div class="wa-lead-item ${isActive ? 'active' : ''}" data-lead-id="${l.id}">
                    <div class="wa-lead-avatar">${esc(initials)}</div>
                    <div class="wa-lead-info">
                        <div class="wa-lead-name">
                            <span>${esc(l.name || 'Sem nome')}</span>
                            <small style="font-size:.62rem; color:var(--primary); font-weight:900;">${esc(statusStr)}</small>
                        </div>
                        <div class="wa-lead-meta">
                            <span class="wa-meta-phone">${esc(l.phone || 'Sem telefone')}</span>
                            <span class="wa-meta-city">${esc(l.city || '')}</span>
                            <div class="wa-lead-chips-wrap">
                                ${botChips}
                                ${unreadTag}
                                ${multiPhone}
                            </div>
                        </div>
                    </div>
                </div>`;
        }).join('');

        leadListEl.querySelectorAll('.wa-lead-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = Number(item.dataset.leadId);
                const target = _leads.find(l => l.id === id);
                if (target) selectLead(target);
            });
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            applyLeadFilters();
        });
    }

    // ================= ACTIVE LEAD CHAT & TOOLS =================
    function selectLead(lead) {
        _activeLead = lead;
        // Update list active state
        document.querySelectorAll('.wa-lead-item').forEach(el => {
            el.classList.toggle('active', Number(el.dataset.leadId) === lead.id);
        });

        // Header update
        const initials = (lead.name || 'WA').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
        document.getElementById('waChatAvatar').textContent = initials;
        document.getElementById('waChatName').textContent = lead.name || 'Cliente';
        document.getElementById('waChatPhone').textContent = `${lead.phone || 'Sem telefone'} • ${lead.city || 'Sem cidade'}`;

        // Reset da seleção manual de bot para este lead
        _selectedSendBotNumber = null;

        // Tools updates
        fillLeadInfoCard(lead);
        updateStepperUI(lead.status || 'novo');

        loadChatHistory(lead);
    }

    // Indicador em destaque no topo do Chat sobre qual Zap da empresa está em uso
    function updateHeaderBotIndicator(activeThread) {
        const ind = document.getElementById('waChatBotIndicator');
        const nameEl = document.getElementById('waCbiName');
        const numEl = document.getElementById('waCbiNum');
        const pill = document.getElementById('waCbiPill');
        if (!ind || !nameEl || !numEl || !pill) return;

        if (!_activeLead) {
            ind.style.display = 'none';
            return;
        }

        const botNum = _selectedSendBotNumber || (activeThread ? activeThread.bot_number : null);
        const bot = _availableBots.find(b => b.number === botNum) || (activeThread ? {
            label: activeThread.bot_label,
            slot_index: activeThread.bot_slot_index,
            real_number: activeThread.bot_real_number,
            status: activeThread.bot_status,
            connection: activeThread.bot_connection,
            connected: activeThread.bot_connected
        } : null);

        if (!bot && !_availableBots.length) {
            ind.style.display = 'none';
            return;
        }

        const label = bot?.label || (bot?.slot_index ? `WhatsApp ${bot.slot_index}` : 'WhatsApp da Empresa');
        const realNum = bot?.realNumber || bot?.real_number || (bot?.number && !bot.number.startsWith('slot-') ? bot.number : null);
        const isConnected = bot?.connected || bot?.connection === 'connected';
        const isBanned = bot?.status === 'banido' || bot?.connection === 'banido';

        nameEl.textContent = label;
        numEl.textContent = realNum ? fmtNum(realNum) : (isConnected ? 'Conectado' : (isBanned ? 'Banido' : 'Offline'));

        pill.className = 'wa-cbi-pill ' + (bot?.slot_index ? `zap-${bot.slot_index}` : 'zap-other') +
                         (isConnected ? ' conn-ok' : (isBanned ? ' conn-ban' : ' conn-off'));
        ind.style.display = 'flex';
    }

    // Seletor no footer do chat para escolher por qual WhatsApp enviar
    function updateSendBotSelector(activeThread) {
        const select = document.getElementById('waSendBotSelect');
        const badge = document.getElementById('waSendBotBadge');
        if (!select) return;

        const readyBots = _availableBots.filter(b => {
            const connected = b.connection === 'connected' || b.connected;
            const active = b.status === 'ativo';
            const blocked = b.status === 'banido' || b.connection === 'banido';
            const attendanceOnly = Number(b.campaign_enabled) === 0 || b.usage_type === 'seller_attendance';
            return connected && active && !blocked && attendanceOnly;
        });

        if (!readyBots.length) {
            select.innerHTML = '<option value="">Nenhum WhatsApp conectado e ativo</option>';
            select.disabled = true;
            if (badge) badge.innerHTML = '<span class="wa-sbb-badge-pill wa-sbb-err"><i class="fas fa-circle-xmark"></i> Nenhum número pronto</span>';
            _selectedSendBotNumber = null;
            return;
        }
        select.disabled = false;

        const threadBotNum = activeThread ? activeThread.bot_number : null;
        let chosenNum = _selectedSendBotNumber || threadBotNum;

        const chosenBot = readyBots.find(b => b.number === chosenNum);
        const firstReady = readyBots[0];

        let warnMsg = '';
        if (!chosenBot && chosenNum) {
            warnMsg = 'Número anterior indisponível. Usando um WhatsApp conectado.';
            chosenNum = firstReady.number;
        } else if (!chosenBot) {
            chosenNum = firstReady.number;
        }

        _selectedSendBotNumber = chosenNum;

        select.innerHTML = readyBots.map(b => {
            const numDisp = b.realNumber || b.real_number ? fmtNum(b.realNumber || b.real_number) : b.number;
            const pushDisp = b.pushName || b.push_name ? ` (${b.pushName || b.push_name})` : '';
            const selected = b.number === chosenNum ? 'selected' : '';
            return `<option value="${esc(b.number)}" ${selected}>
                ${esc(b.label || `WhatsApp ${b.slot_index || ''}`)} • ${esc(numDisp)}${esc(pushDisp)}
            </option>`;
        }).join('');

        select.onchange = () => {
            _selectedSendBotNumber = select.value;
            const cur = _availableBots.find(b => b.number === select.value);
            if (badge) {
                if (cur && (cur.connection === 'connected' || cur.connected)) {
                    badge.innerHTML = '<span class="wa-sbb-badge-pill wa-sbb-ok"><i class="fas fa-check-circle"></i> Conectado</span>';
                } else {
                    badge.innerHTML = `<span class="wa-sbb-badge-pill wa-sbb-warn"><i class="fas fa-triangle-exclamation"></i> ${cur ? cur.label : 'Número'} offline</span>`;
                }
            }
            updateHeaderBotIndicator(activeThread);
        };

        if (badge) {
            const cur = _availableBots.find(b => b.number === chosenNum);
            if (warnMsg) {
                badge.innerHTML = `<span class="wa-sbb-badge-pill wa-sbb-warn" title="${esc(warnMsg)}"><i class="fas fa-triangle-exclamation"></i> ${esc(warnMsg)}</span>`;
            } else if (cur && (cur.connection === 'connected' || cur.connected)) {
                badge.innerHTML = '<span class="wa-sbb-badge-pill wa-sbb-ok"><i class="fas fa-check-circle"></i> Conectado</span>';
            } else {
                badge.innerHTML = `<span class="wa-sbb-badge-pill wa-sbb-warn"><i class="fas fa-circle-exclamation"></i> Offline</span>`;
            }
        }

        updateHeaderBotIndicator(activeThread);
    }

    // Barra de abas dos threads (Telefone 1 / Telefone 2 / ...), criada 1x
    function ensureThreadBar() {
        let bar = document.getElementById('waThreadBar');
        if (!bar) {
            const msgBox = document.getElementById('waChatMessages');
            bar = document.createElement('div');
            bar.id = 'waThreadBar';
            bar.className = 'wa-thread-bar';
            msgBox.parentNode.insertBefore(bar, msgBox);
        }
        return bar;
    }

    function renderThreadBar() {
        const bar = ensureThreadBar();
        if (!_threads.length || _threads.length === 1) { bar.style.display = 'none'; return; }
        bar.style.display = 'flex';
        bar.innerHTML = _threads.map(t => {
            const k = threadKey(t);
            const active = k === _activeThreadKey;
            const dot = t.unread ? `<span class="wa-thread-dot">${t.unread}</span>` : '';
            const distinctBots = new Set(_threads.map(x => x.bot_number).filter(Boolean));
            const showBotBadge = distinctBots.size > 1;
            const botName = t.bot_label || (t.bot_slot_index ? `WA ${t.bot_slot_index}` : (t.bot_number ? `via ${t.bot_number.slice(-4)}` : ''));
            const zapBadge = showBotBadge && botName ? `<span class="wa-thread-zap-badge zap-${t.bot_slot_index || 'other'}"><i class="fab fa-whatsapp"></i> ${esc(botName)}</span>` : '';
            return `<button type="button" class="wa-thread-tab${active ? ' active' : ''}" data-key="${k}">
                <span class="wa-thread-title">${esc(t.phone_label)}</span> ${zapBadge} ${dot}
            </button>`;
        }).join('');
        bar.querySelectorAll('.wa-thread-tab').forEach(btn => {
            btn.onclick = () => { _activeThreadKey = btn.dataset.key; renderActiveThread(); };
        });
    }

    function renderActiveThread() {
        const msgBox = document.getElementById('waChatMessages');
        if (!msgBox) return;
        const t = _threads.find(x => threadKey(x) === _activeThreadKey) || _threads[0];
        _activeThreadKey = t ? threadKey(t) : null;
        renderThreadBar();
        updateSendBotSelector(t);
        updateHeaderBotIndicator(t);

        if (!t) {
            msgBox.innerHTML = `<div class="wa-msg-bubble in"><div>Sem conversa ainda. Envie a primeira mensagem.</div></div>`;
            return;
        }

        if (!t.messages.length) {
            const botLabel = t.bot_label || 'WhatsApp';
            msgBox.innerHTML = `<div class="wa-msg-bubble in"><div>Sem mensagens via <strong>${esc(botLabel)}</strong> ainda. Envie a primeira abaixo.</div></div>`;
        } else {
            const msgBots = new Set(t.messages.map(m => m.bot_number || m.bot_label).filter(Boolean));
            const showMsgBotTags = msgBots.size > 1;
            msgBox.innerHTML = t.messages.map(m => {
                const time = new Date(m.created_at || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const tick = m.direction === 'out' ? '<i class="fas fa-check-double" style="color:#34b7f1;"></i>' : '';
                const botTag = showMsgBotTags && m.bot_label ? `<span class="wa-msg-bot-tag zap-${m.bot_slot_index || 'other'}" title="Canal: ${esc(m.bot_label)}">${esc(m.bot_short_name || m.bot_label)}</span>` : '';
                return `<div class="wa-msg-bubble ${m.direction === 'out' ? 'out' : 'in'}">
                    <div>${esc(m.body || '')}</div>
                    <div class="wa-msg-meta">
                        ${botTag}
                        <span>${time}</span> ${tick}
                    </div>
                </div>`;
            }).join('');
        }
        msgBox.scrollTop = msgBox.scrollHeight;

        // marca como lido
        if (t.unread && t.bot_number) {
            api(`/leads/${_activeLead.id}/conversations/read`, {
                method: 'POST',
                body: JSON.stringify({ lead_phone: t.lead_phone, bot_number: t.bot_number })
            }).then(() => { t.unread = 0; renderThreadBar(); }).catch(() => {});
        }
    }

    async function loadChatHistory(lead) {
        const msgBox = document.getElementById('waChatMessages');
        if (!msgBox) return;
        msgBox.innerHTML = '<div class="wa-msg-bubble in"><div>Carregando conversa...</div></div>';
        try {
            const data = await api(`/leads/${lead.id}/conversations`);
            _threads = (data && data.threads) || [];
            if (data && data.available_bots) {
                _availableBots = data.available_bots;
                renderBotFilters();
            }
            // mantém o thread ativo se ainda existir, senão pega o de cima
            if (!_threads.find(t => threadKey(t) === _activeThreadKey)) {
                _activeThreadKey = _threads.length ? threadKey(_threads[0]) : null;
            }
            renderActiveThread();
        } catch (e) {
            _threads = [];
            msgBox.innerHTML = `<div class="wa-msg-bubble in"><div>Inicie uma nova conversa com ${esc(lead.name)}.</div></div>`;
            updateHeaderBotIndicator(null);
            updateSendBotSelector(null);
        }
    }

    // ================= MESSAGE SENDING =================
    const chatInput = document.getElementById('waChatInput');
    const sendBtn = document.getElementById('waChatSendBtn');

    async function sendMessage() {
        if (!chatInput || !_activeLead) return;
        const msgText = chatInput.value.trim();
        if (!msgText) return;

        const msgBox = document.getElementById('waChatMessages');
        const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const bubble = document.createElement('div');
        bubble.className = 'wa-msg-bubble out';
        const metaId = 'bot-meta-' + Date.now();
        bubble.innerHTML = `
            <div>${esc(msgText)}</div>
            <div class="wa-msg-meta" id="${metaId}"><span>${timeStr}</span> <i class="fas fa-clock" style="opacity:.6;"></i></div>`;
        msgBox.appendChild(bubble);
        msgBox.scrollTop = msgBox.scrollHeight;
        chatInput.value = '';
        if (sendBtn) sendBtn.disabled = true;

        const setMeta = html => { const m = document.getElementById(metaId); if (m) m.innerHTML = `<span>${timeStr}</span> ${html}`; };

        // Responde no número do thread ativo pelo bot selecionado no seletor ou pelo mesmo bot que atendeu
        const active = _threads.find(t => threadKey(t) === _activeThreadKey);
        const sendBot = _selectedSendBotNumber || (active ? active.bot_number : null);
        const payload = { lead_id: _activeLead.id, message: msgText };
        if (active && active.lead_phone) payload.to_phone = active.lead_phone;
        if (sendBot) payload.bot_number = sendBot;

        try {
            const r = await api('/tools/send-lead', { method: 'POST', body: JSON.stringify(payload) });
            setMeta('<i class="fas fa-check-double" style="color:#34b7f1;"></i>');
            if (toast) toast('Mensagem entregue no WhatsApp' + (r && r.phone ? ` (${r.phone})` : '') + '!', 'ok');
            loadChatHistory(_activeLead); // recarrega o thread (persiste no F5)
        } catch (e) {
            bubble.style.borderColor = '#ef4444';
            setMeta('<i class="fas fa-triangle-exclamation" style="color:#ef4444;"></i>');
            if (toast) toast(e.message || 'Falha ao enviar a mensagem', 'err');
            if (!chatInput.value) chatInput.value = msgText;
        } finally {
            if (sendBtn) sendBtn.disabled = false;
        }
    }

    if (sendBtn) sendBtn.onclick = sendMessage;
    if (chatInput) {
        chatInput.onkeydown = (e) => {
            if (e.key === 'Enter') sendMessage();
        };
    }

    // ================= EMOJI PICKER & ATTACHMENT SYSTEM =================
    const emojiBtn = document.getElementById('waEmojiBtn');
    const emojiPicker = document.getElementById('waEmojiPicker');
    const emojiGrid = document.getElementById('waEmojiGrid');
    const closeEmojiBtn = document.getElementById('waCloseEmojiBtn');

    const attachBtn = document.getElementById('waAttachBtn');
    const attachMenu = document.getElementById('waAttachMenu');
    const fileInput = document.getElementById('waFileInput');
    const attachPhotoBtn = document.getElementById('waAttachPhotoBtn');
    const attachDocBtn = document.getElementById('waAttachDocBtn');

    const WA_EMOJIS = [
        '😀', '😃', '😄', '😁', '😊', '😍', '🤩',
        '👍', '👏', '🤝', '🙏', '💪', '🔥', '⭐',
        '💰', '💳', '🏦', '🚀', '✅', '📞', '📅',
        '🎯', '🔒', '📄', '📎', '💼', '🚗', '🏡',
        '🎉', '✨', '💯', '🆗', '⏳', '💡', '⚡'
    ];

    if (emojiGrid) {
        emojiGrid.innerHTML = WA_EMOJIS.map(em => `
            <button type="button" class="wa-emoji-btn" data-emoji="${em}">${em}</button>
        `).join('');

        emojiGrid.querySelectorAll('.wa-emoji-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const em = btn.dataset.emoji;
                if (chatInput) {
                    const start = chatInput.selectionStart || chatInput.value.length;
                    const end = chatInput.selectionEnd || chatInput.value.length;
                    chatInput.value = chatInput.value.substring(0, start) + em + chatInput.value.substring(end);
                    chatInput.focus();
                    chatInput.selectionStart = chatInput.selectionEnd = start + em.length;
                }
            };
        });
    }

    if (emojiBtn && emojiPicker) {
        emojiBtn.onclick = (e) => {
            e.stopPropagation();
            const isOpen = emojiPicker.style.display === 'flex';
            emojiPicker.style.display = isOpen ? 'none' : 'flex';
            if (attachMenu) attachMenu.style.display = 'none';
            emojiBtn.classList.toggle('active', !isOpen);
            if (attachBtn) attachBtn.classList.remove('active');
        };
    }

    if (closeEmojiBtn && emojiPicker) {
        closeEmojiBtn.onclick = () => {
            emojiPicker.style.display = 'none';
            if (emojiBtn) emojiBtn.classList.remove('active');
        };
    }

    if (attachBtn && attachMenu) {
        attachBtn.onclick = (e) => {
            e.stopPropagation();
            const isOpen = attachMenu.style.display === 'flex';
            attachMenu.style.display = isOpen ? 'none' : 'flex';
            if (emojiPicker) emojiPicker.style.display = 'none';
            attachBtn.classList.toggle('active', !isOpen);
            if (emojiBtn) emojiBtn.classList.remove('active');
        };
    }

    // Fecha popups ao clicar fora
    document.addEventListener('click', (e) => {
        if (emojiPicker && !emojiPicker.contains(e.target) && e.target !== emojiBtn) {
            emojiPicker.style.display = 'none';
            if (emojiBtn) emojiBtn.classList.remove('active');
        }
        if (attachMenu && !attachMenu.contains(e.target) && e.target !== attachBtn) {
            attachMenu.style.display = 'none';
            if (attachBtn) attachBtn.classList.remove('active');
        }
    });

    if (attachPhotoBtn && fileInput) {
        attachPhotoBtn.onclick = (e) => {
            e.stopPropagation();
            if (attachMenu) attachMenu.style.display = 'none';
            if (attachBtn) attachBtn.classList.remove('active');
            fileInput.accept = 'image/*';
            fileInput.click();
        };
    }

    if (attachDocBtn && fileInput) {
        attachDocBtn.onclick = (e) => {
            e.stopPropagation();
            if (attachMenu) attachMenu.style.display = 'none';
            if (attachBtn) attachBtn.classList.remove('active');
            fileInput.accept = '.pdf,.doc,.docx,.txt,.csv,.xlsx';
            fileInput.click();
        };
    }

    if (fileInput) {
        fileInput.onchange = async () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file || !_activeLead) return;

            const msgBox = document.getElementById('waChatMessages');
            const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const isImg = file.type.startsWith('image/');
            const sizeStr = file.size > 1024 * 1024
                ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
                : Math.ceil(file.size / 1024) + ' KB';

            const bubble = document.createElement('div');
            bubble.className = `wa-msg-bubble out ${isImg ? 'image' : 'doc'}`;

            if (isImg) {
                const reader = new FileReader();
                reader.onload = (re) => {
                    bubble.innerHTML = `
                        <img src="${re.target.result}" class="wa-msg-img-preview" alt="${esc(file.name)}">
                        <div><b>Foto:</b> ${esc(file.name)} (${sizeStr})</div>
                        <div class="wa-msg-meta"><span>${timeStr}</span> <i class="fas fa-check-double" style="color:#34b7f1;"></i></div>
                    `;
                    if (msgBox) {
                        msgBox.appendChild(bubble);
                        msgBox.scrollTop = msgBox.scrollHeight;
                    }
                };
                reader.readAsDataURL(file);
            } else {
                bubble.innerHTML = `
                    <div class="wa-msg-doc-card">
                        <i class="fas fa-file-lines wa-msg-doc-icon"></i>
                        <div class="wa-msg-doc-meta">
                            <div class="wa-msg-doc-name">${esc(file.name)}</div>
                            <div class="wa-msg-doc-size">${sizeStr} • Documento</div>
                        </div>
                    </div>
                    <div class="wa-msg-meta"><span>${timeStr}</span> <i class="fas fa-check-double" style="color:#34b7f1;"></i></div>
                `;
                if (msgBox) {
                    msgBox.appendChild(bubble);
                    msgBox.scrollTop = msgBox.scrollHeight;
                }
            }

            try {
                await api(`/leads/${_activeLead.id}/notes`, {
                    method: 'POST',
                    body: JSON.stringify({ note: `[WhatsApp Web ${isImg ? 'Foto' : 'Documento'}] ${file.name} (${sizeStr})` })
                });
                if (toast) toast(`${isImg ? 'Foto' : 'Documento'} anexado e enviado!`, 'ok');
            } catch (e) {}

            fileInput.value = '';
        };
    }

    // ================= QUICK CHIPS SYSTEM (LOCALSTORAGE + DRAG & DROP + PRIORIDADE) =================
    const STORAGE_CHIPS_KEY = 'prime_sul_quick_chips';
    const DEFAULT_QUICK_CHIPS = [
        { title: 'Saudação', text: 'Olá {nome}! Tudo bem? Como posso te ajudar hoje?' },
        { title: 'Aguarde', text: 'Estou verificando suas informações agora. Pode aguardar um minuto?' },
        { title: 'Aprovado', text: 'Seu cadastro foi localizado com sucesso! Vamos dar andamento?' },
        { title: 'Documentos', text: 'Olá {nome}, para dar andamento preciso que envie foto do seu RG/CPF e comprovante de residência.' },
        { title: 'Dados Bancários', text: 'Por favor, me informe sua chave PIX ou conta bancária para transferência.' }
    ];

    function getQuickChips() {
        try {
            const saved = localStorage.getItem(STORAGE_CHIPS_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {}
        return DEFAULT_QUICK_CHIPS;
    }

    function saveQuickChips(chips) {
        localStorage.setItem(STORAGE_CHIPS_KEY, JSON.stringify(chips));
        renderChipsBar();
        renderQuickManageList();
    }

    let barDraggedIdx = null;

    function renderChipsBar() {
        const chipsContainer = document.getElementById('waQuickChips');
        if (!chipsContainer) return;
        const chips = getQuickChips();

        chipsContainer.innerHTML = chips.map((c, idx) => {
            const prioClass = idx === 0 ? 'prio-1' : idx === 1 ? 'prio-2' : idx === 2 ? 'prio-3' : '';
            return `<span class="wa-chip ${prioClass}" draggable="true" data-index="${idx}" title="Clique: Usar | Arraste p/ Reordenar | Clique Direito: Editar&#10;${esc(c.text)}">${esc(c.title)}</span>`;
        }).join('');

        chipsContainer.querySelectorAll('.wa-chip').forEach(chipEl => {
            // Clique Esquerdo -> Usar template no chat
            chipEl.onclick = (e) => {
                if (chipEl.dataset.justDragged === 'true') {
                    delete chipEl.dataset.justDragged;
                    return;
                }
                e.preventDefault();
                const idx = Number(chipEl.dataset.index);
                const item = chips[idx];
                if (!item) return;
                const firstName = _activeLead ? _activeLead.name.split(' ')[0] : 'cliente';
                const msg = (item.text || '').replace(/{nome}/g, firstName);
                if (chatInput) {
                    chatInput.value = msg;
                    chatInput.focus();
                }
            };

            // Clique Direito (contextmenu) -> Abre o editor direto para este template!
            chipEl.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const idx = Number(chipEl.dataset.index);
                openQuickModal(idx);
            };

            // Arraste direto na barra (Drag and Drop)
            chipEl.addEventListener('dragstart', (e) => {
                barDraggedIdx = Number(chipEl.dataset.index);
                chipEl.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', barDraggedIdx);
            });

            chipEl.addEventListener('dragend', () => {
                chipEl.classList.remove('dragging');
                chipsContainer.querySelectorAll('.wa-chip').forEach(c => c.classList.remove('drag-over'));
                barDraggedIdx = null;
            });

            chipEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                chipEl.classList.add('drag-over');
            });

            chipEl.addEventListener('dragleave', () => {
                chipEl.classList.remove('drag-over');
            });

            chipEl.addEventListener('drop', (e) => {
                e.preventDefault();
                chipEl.classList.remove('drag-over');
                const targetIdx = Number(chipEl.dataset.index);

                if (barDraggedIdx !== null && barDraggedIdx !== targetIdx) {
                    chipEl.dataset.justDragged = 'true';
                    const allChips = [...getQuickChips()];
                    const movedItem = allChips.splice(barDraggedIdx, 1)[0];
                    allChips.splice(targetIdx, 0, movedItem);
                    saveQuickChips(allChips);
                }
            });
        });
    }

    // Modal Manager Logic
    const quickModal = document.getElementById('waQuickModal');
    const closeQuickModalBtn = document.getElementById('waCloseQuickModalBtn');
    const doneQuickModalBtn = document.getElementById('waDoneQuickModalBtn');
    const saveItemBtn = document.getElementById('waQuickSaveItemBtn');
    const cancelEditBtn = document.getElementById('waQuickCancelEditBtn');
    const inputTitle = document.getElementById('waQuickInputTitle');
    const inputText = document.getElementById('waQuickInputText');
    const editIndexEl = document.getElementById('waQuickEditIndex');
    const formTitleEl = document.getElementById('waQuickFormTitle');
    let draggedIdx = null;

    function openQuickModal(editIdx = null) {
        let modal = document.getElementById('waQuickModal');
        if (!modal) return;
        modal.style.display = 'flex';
        const shell = document.getElementById('waQuickModalShell');
        if (shell && window.anime) {
            window.anime({
                targets: shell,
                scale: [0.92, 1],
                opacity: [0, 1],
                duration: 320,
                easing: 'easeOutCubic'
            });
        }
        resetQuickForm();
        renderQuickManageList();

        if (editIdx !== null && editIdx >= 0) {
            const chips = getQuickChips();
            const item = chips[editIdx];
            if (item && inputTitle && inputText && editIndexEl && formTitleEl) {
                inputTitle.value = item.title;
                inputText.value = item.text;
                editIndexEl.value = editIdx;
                formTitleEl.innerHTML = '<i class="fas fa-pen" style="color:#38bdf8;"></i> <span>EDITAR ATALHO</span>';
                if (cancelEditBtn) cancelEditBtn.style.display = 'inline-flex';
                inputTitle.focus();
                inputTitle.select();
            }
        }
    }

    // Event delegation para o botão GERENCIAR (funciona 100% garantido)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#waManageChipsBtn, .wa-chip-manage-btn');
        if (btn) {
            e.preventDefault();
            e.stopPropagation();
            openQuickModal();
        }
    });

    const closeQuickModal = () => {
        const modal = document.getElementById('waQuickModal') || quickModal;
        if (!modal) return;
        const shell = document.getElementById('waQuickModalShell');
        if (shell && window.anime) {
            window.anime({
                targets: shell,
                scale: [1, 0.95],
                opacity: [1, 0],
                duration: 200,
                easing: 'easeInQuad',
                complete: () => {
                    modal.style.display = 'none';
                }
            });
        } else {
            modal.style.display = 'none';
        }
    };
    if (closeQuickModalBtn) closeQuickModalBtn.onclick = closeQuickModal;
    if (doneQuickModalBtn) doneQuickModalBtn.onclick = closeQuickModal;

    function resetQuickForm() {
        if (inputTitle) inputTitle.value = '';
        if (inputText) inputText.value = '';
        if (editIndexEl) editIndexEl.value = '-1';
        if (formTitleEl) formTitleEl.innerHTML = '<i class="fas fa-plus-circle" style="color:#00a884;"></i> <span>ADICIONAR NOVO ATALHO</span>';
        if (cancelEditBtn) cancelEditBtn.style.display = 'none';
    }

    if (cancelEditBtn) cancelEditBtn.onclick = resetQuickForm;

    if (saveItemBtn) {
        saveItemBtn.onclick = () => {
            const title = inputTitle.value.trim();
            const text = inputText.value.trim();
            if (!title || !text) {
                if (toast) toast('Preencha o título e o texto do template', 'err');
                return;
            }
            const chips = [...getQuickChips()];
            const idx = Number(editIndexEl.value);

            if (idx >= 0 && idx < chips.length) {
                chips[idx] = { title, text };
                if (toast) toast('Template atualizado com sucesso!', 'ok');
            } else {
                chips.push({ title, text });
                if (toast) toast('Novo template adicionado!', 'ok');
            }

            saveQuickChips(chips);
            resetQuickForm();
        };
    }

    function renderQuickManageList() {
        const listEl = document.getElementById('waQuickItemsList');
        if (!listEl) return;
        const chips = getQuickChips();

        if (!chips.length) {
            listEl.innerHTML = '<div class="ps-empty" style="padding:16px;">Nenhum template cadastrado.</div>';
            return;
        }

        listEl.innerHTML = chips.map((c, i) => {
            const badgeClass = i === 0 ? 'prio-1' : i === 1 ? 'prio-2' : i === 2 ? 'prio-3' : 'normal';
            const badgeLabel = i === 0 ? '1º Prioridade' : i === 1 ? '2º Prioridade' : i === 2 ? '3º Prioridade' : `Item ${i + 1}`;
            return `
                <div class="wa-quick-manage-item" draggable="true" data-index="${i}">
                    <i class="fas fa-grip-vertical wa-quick-drag-handle" title="Arraste para reordenar"></i>
                    <span class="wa-quick-item-badge ${badgeClass}">${badgeLabel}</span>
                    <div class="wa-quick-item-content">
                        <div class="wa-quick-item-title">${esc(c.title)}</div>
                        <div class="wa-quick-item-text">${esc(c.text)}</div>
                    </div>
                    <div class="wa-quick-item-actions">
                        <button type="button" class="wa-quick-item-btn" data-act="up" data-index="${i}" ${i === 0 ? 'disabled' : ''} title="Mover para cima"><i class="fas fa-arrow-up"></i></button>
                        <button type="button" class="wa-quick-item-btn" data-act="down" data-index="${i}" ${i === chips.length - 1 ? 'disabled' : ''} title="Mover para baixo"><i class="fas fa-arrow-down"></i></button>
                        <button type="button" class="wa-quick-item-btn" data-act="edit" data-index="${i}" title="Editar"><i class="fas fa-pen"></i></button>
                        <button type="button" class="wa-quick-item-btn del" data-act="delete" data-index="${i}" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`;
        }).join('');

        listEl.querySelectorAll('[data-act]').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const act = btn.dataset.act;
                const idx = Number(btn.dataset.index);
                const chips = [...getQuickChips()];

                if (act === 'up' && idx > 0) {
                    const temp = chips[idx];
                    chips[idx] = chips[idx - 1];
                    chips[idx - 1] = temp;
                    saveQuickChips(chips);
                } else if (act === 'down' && idx < chips.length - 1) {
                    const temp = chips[idx];
                    chips[idx] = chips[idx + 1];
                    chips[idx + 1] = temp;
                    saveQuickChips(chips);
                } else if (act === 'edit') {
                    const item = chips[idx];
                    if (item) {
                        inputTitle.value = item.title;
                        inputText.value = item.text;
                        editIndexEl.value = idx;
                        formTitleEl.innerHTML = '<i class="fas fa-pen" style="color:var(--primary);"></i> EDITAR TEMPLATE';
                        cancelEditBtn.style.display = 'inline-flex';
                        inputTitle.focus();
                    }
                } else if (act === 'delete') {
                    const ok = await (window.confirmDialog ? window.confirmDialog({
                        title: 'EXCLUIR TEMPLATE',
                        eyebrow: 'RESPOSTA RÁPIDA',
                        message: `Excluir o template "${chips[idx].title}"?`,
                        description: 'Ele será removido da barra de atalhos rápidos.',
                        confirmText: 'Excluir',
                        cancelText: 'Cancelar',
                        type: 'danger',
                        icon: 'fa-trash-can'
                    }) : Promise.resolve(confirm(`Excluir o template "${chips[idx].title}"?`)));
                    if (ok) {
                        chips.splice(idx, 1);
                        saveQuickChips(chips);
                        resetQuickForm();
                        if (toast) toast('Template excluído!', 'info');
                    }
                }
            };
        });

        const itemEls = listEl.querySelectorAll('.wa-quick-manage-item');
        itemEls.forEach(el => {
            el.addEventListener('dragstart', (e) => {
                draggedIdx = Number(el.dataset.index);
                el.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            el.addEventListener('dragend', () => {
                el.classList.remove('dragging');
                draggedIdx = null;
            });

            el.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            el.addEventListener('drop', (e) => {
                e.preventDefault();
                const targetIdx = Number(el.dataset.index);
                if (draggedIdx !== null && draggedIdx !== targetIdx) {
                    const chips = [...getQuickChips()];
                    const movedItem = chips.splice(draggedIdx, 1)[0];
                    chips.splice(targetIdx, 0, movedItem);
                    saveQuickChips(chips);
                }
            });
        });
    }

    renderChipsBar();

    // Toggle tools button (inicia SEMPRE fechado; só abre se o usuário clicar)
    const toggleToolsBtn = document.getElementById('waToggleToolsBtn');
    const previewToolsPanel = document.getElementById('waPreviewTools');
    if (toggleToolsBtn && previewToolsPanel) {
        previewToolsPanel.style.display = 'none';
        previewToolsPanel.classList.remove('active');
        toggleToolsBtn.classList.remove('active');

        toggleToolsBtn.onclick = () => {
            const isCurrentlyOpen = previewToolsPanel.classList.contains('active') || (previewToolsPanel.style.display === 'flex');
            if (isCurrentlyOpen) {
                previewToolsPanel.style.display = 'none';
                previewToolsPanel.classList.remove('active');
                toggleToolsBtn.classList.remove('active');
            } else {
                previewToolsPanel.style.display = 'flex';
                previewToolsPanel.classList.add('active');
                toggleToolsBtn.classList.add('active');
            }
        };
    }

    // Floating WhatsApp Widget Popout button
    const floatBtn = document.getElementById('waFloatWidgetBtn');
    if (floatBtn) {
        floatBtn.onclick = () => {
            if (!_activeLead) {
                if (toast) toast('Selecione uma conversa primeiro!', 'info');
                return;
            }
            if (window.openWaFloatingWidget) {
                window.openWaFloatingWidget(_activeLead);
            }
            // Fecha modal principal para o operador continuar operando com a janela flutuante
            const closeBtn = document.querySelector('#toolModalClose, .btn-close-modal, .tool-modal-close');
            if (closeBtn) {
                closeBtn.click();
            } else {
                const modal = document.getElementById('dynamicModal') || document.getElementById('toolModal');
                if (modal) modal.classList.remove('active');
            }
            if (toast) toast(`Conversa com ${_activeLead.name} aberta no pop-up flutuante!`, 'ok');
        };
    }

    // External WhatsApp button
    const externalBtn = document.getElementById('waExternalBtn');
    if (externalBtn) {
        externalBtn.onclick = () => {
            if (!_activeLead) return;
            const cleanPhone = (_activeLead.phone || '').replace(/\D/g, '');
            const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
            window.open(`https://wa.me/${fullPhone}?text=Olá%20${encodeURIComponent(_activeLead.name)},%20sou%20da%20Prime%20Sul!`, '_blank');
        };
    }

    // ================= LEAD TOOLS CARDS =================
    function formatMoney(v) {
        const n = parseFloat(v);
        if (!v || isNaN(n)) return '—';
        return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function fillLeadInfoCard(lead) {
        const scoreEl = document.getElementById('wapt-score');
        if (scoreEl) {
            const score = lead.score;
            scoreEl.textContent = score == null ? '—' : score;
            scoreEl.className = 'wa-info-score' + (score >= 70 ? ' hi' : score >= 40 ? ' mid' : score != null ? ' low' : '');
        }

        const prioEl = document.getElementById('wapt-prio');
        if (prioEl) prioEl.textContent = WA_PRIO_LABEL[lead.prioridade] || 'Média';

        const origemEl = document.getElementById('wapt-origem');
        if (origemEl) origemEl.textContent = lead.origem || 'SITE';

        const statusEl = document.getElementById('wapt-status');
        if (statusEl) statusEl.textContent = WA_STATUS_LABEL[lead.status] || 'NOVO';

        const set = (id, value, copyRaw) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = value || '—';
            if (copyRaw !== undefined) el.dataset.copy = value || '';
        };

        set('wapt-name', lead.name);
        set('wapt-phone', lead.phone, lead.phone);
        set('wapt-cpf', lead.cpf, lead.cpf);
        set('wapt-city', lead.city);
        set('wapt-renda', lead.renda ? formatMoney(lead.renda) : null);
        set('wapt-limite', lead.limite_est ? formatMoney(lead.limite_est) : null);

        // Header tooltips
        set('waPtCpf', lead.cpf);
        set('waPtRenda', lead.renda ? formatMoney(lead.renda) : null);
        set('waPtLimite', lead.limite_est ? formatMoney(lead.limite_est) : null);

        const noteIcon = document.getElementById('waHeaderNoteIcon');
        const noteText = document.getElementById('waPtObs');
        if (noteIcon && noteText) {
            if (lead.obs && lead.obs.trim().length > 0) {
                noteIcon.style.display = 'inline-block';
                noteText.textContent = lead.obs;
            } else {
                noteIcon.style.display = 'none';
                noteText.textContent = '—';
            }
        }
    }

    function canonicalStage(stage) {
        return ({ novo: 'novos', contato: 'enviados', confirmado: 'sim', concluido: 'sim' })[stage] || stage;
    }

    function updateStepperUI(currentStage) {
        const cur = canonicalStage(currentStage);
        document.querySelectorAll('#wapt-stepper .wa-tool-step-btn').forEach(b => {
            b.classList.toggle('active', canonicalStage(b.dataset.stage) === cur);
        });
    }

    // Tool 1: Stepper
    document.querySelectorAll('#wapt-stepper .wa-tool-step-btn').forEach(btn => {
        btn.onclick = async () => {
            if (!_activeLead) return;
            const stage = canonicalStage(btn.dataset.stage);
            try {
                await api(`/leads/${_activeLead.id}/status`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status: stage })
                });
                if (toast) toast(`Lead movido para ${stage.toUpperCase()}!`, 'ok');
                _activeLead.status = stage;
                updateStepperUI(stage);
                document.getElementById('wapt-status').textContent = WA_STATUS_LABEL[stage] || stage.toUpperCase();
                loadLeads();
            } catch (e) {
                if (toast) toast(e.message, 'err');
            }
        };
    });

    // Tool 3: Anotações
    const saveNoteBtn = document.getElementById('wapt-note-save');
    if (saveNoteBtn) {
        saveNoteBtn.onclick = async () => {
            const noteEl = document.getElementById('wapt-note');
            const note = noteEl ? noteEl.value.trim() : '';
            if (!note || !_activeLead) return;
            try {
                await api(`/leads/${_activeLead.id}/notes`, {
                    method: 'POST',
                    body: JSON.stringify({ note: `[Anotação Rápida] ${note}` })
                });
                if (toast) toast('Anotação salva com sucesso!', 'ok');
                noteEl.value = '';
                loadChatHistory(_activeLead);
            } catch (e) {}
        };
    }

    // Tool 4: Sugestão IA
    const aiSugBtn = document.getElementById('wapt-ai-btn');
    if (aiSugBtn) {
        aiSugBtn.onclick = () => {
            if (!_activeLead) return;
            const sug = `Olá ${_activeLead.name.split(' ')[0]}! Vi que você se interessou pela nossa simulação de crédito Prime Sul. Qual o melhor horário para conversarmos sobre seu limite liberado?`;
            if (chatInput) {
                chatInput.value = sug;
                chatInput.focus();
            }
        };
    }

    // Inline edit / copy
    document.querySelectorAll('.wa-preview-tools .wa-info-value.copyable').forEach(el => {
        el.addEventListener('click', () => {
            if (el.querySelector('input')) return;
            const val = el.dataset.copy;
            if (!val) return;
            navigator.clipboard?.writeText(val).then(() => {
                if (toast) toast('Copiado para a área de transferência!', 'ok');
                el.classList.add('copied');
                setTimeout(() => el.classList.remove('copied'), 600);
            }).catch(() => {});
        });
    });

    document.querySelectorAll('.wa-preview-tools .wa-info-value.editable').forEach(el => {
        el.addEventListener('click', () => startEditInfoField(el));
    });

    function startEditInfoField(el) {
        if (el.querySelector('input') || !_activeLead) return;
        const field = el.dataset.field;
        const isMoney = ['renda', 'limite_est'].includes(field);
        const rawValue = _activeLead[field] || '';
        let settled = false;

        const input = document.createElement('input');
        input.type = isMoney ? 'number' : 'text';
        if (isMoney) input.step = '0.01';
        input.className = 'wa-info-edit-input';
        input.value = rawValue;

        el.classList.add('editing');
        el.textContent = '';
        el.appendChild(input);
        input.focus();
        input.select();

        const finish = (save) => {
            if (settled) return;
            settled = true;
            el.classList.remove('editing');
            if (save) commitEdit(el, field, input.value.trim());
            else fillLeadInfoCard(_activeLead);
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); finish(true); }
            else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        });
        input.addEventListener('blur', () => finish(true));
        input.addEventListener('click', (e) => e.stopPropagation());
    }

    async function commitEdit(el, field, value) {
        const lead = _activeLead;
        if (!lead) return;
        const previous = lead[field];
        if ((previous || '') === value) { fillLeadInfoCard(lead); return; }

        lead[field] = value;
        fillLeadInfoCard(lead);

        try {
            const body = {};
            body[field] = value;
            await api(`/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify(body) });
            if (toast) toast('Dado do lead atualizado!');
        } catch (e) {
            lead[field] = previous;
            fillLeadInfoCard(lead);
            if (toast) toast(e.message || 'Erro ao salvar', 'err');
        }
    }

    // ================= CONFIG & QR CODE PANEL =================
    const toggleInput = document.getElementById('bt-toggle');
    const toggleWrap = document.getElementById('bt-hero-toggle-wrap');
    if (toggleInput && toggleWrap && !isAdmin) {
        toggleInput.disabled = true;
        toggleWrap.classList.add('readonly');
        document.getElementById('bt-toggle-desc').textContent = 'Somente o admin pode pausar as conexões da empresa.';
    }

    function fmtNum(n) {
        const s = String(n).replace(/\D/g, '');
        if (s.length < 12) return n;
        return `+${s.slice(0, 2)} (${s.slice(2, 4)}) ${s.slice(4, 9)}-${s.slice(9)}`;
    }

    function stopPolling() {
        for (const [num, id] of _pollers) { clearInterval(id); _pollers.delete(num); }
    }

    function renderConfig(data) {
        // Update top tab bar status badge
        const tabStatus = document.getElementById('bt-tab-connection-status');
        const connectedCount = Object.values(data.bots || {}).filter(b => b.status === 'connected').length;
        if (tabStatus) {
            tabStatus.title = "Clique para abrir o scanner e gerenciador de QR Code";
            tabStatus.onclick = () => {
                const configBtn = document.querySelector('.bt-tab-btn[data-tab="config"]');
                if (configBtn) configBtn.click();
            };
            if (connectedCount > 0) {
                tabStatus.innerHTML = `<span class="bt-badge conn-connected" title="WhatsApp Ativo (${connectedCount} bot(s) conectado(s)).&#10;Clique para gerenciar sessões e QR Codes."><i class="fas fa-circle"></i> ${connectedCount} BOT(S) CONECTADO(S)</span>`;
            } else {
                tabStatus.innerHTML = `<span class="bt-badge conn-offline" title="WhatsApp Offline.&#10;Clique para abrir o scanner e escanear o QR Code."><i class="fas fa-circle"></i> WHATSAPP OFFLINE</span>`;
            }
        }

        const env = document.getElementById('bt-env');
        if (env) {
            if (!data.envEnabled) {
                env.className = 'bt-env off';
                env.innerHTML = '<i class="fas fa-circle"></i> DESLIGADO NO AMBIENTE (.ENV)';
            } else if (!data.runtimeEnabled) {
                env.className = 'bt-env paused';
                env.innerHTML = '<i class="fas fa-circle"></i> PAUSADO TEMPORARIAMENTE';
            } else {
                env.className = 'bt-env on';
                env.innerHTML = '<i class="fas fa-circle"></i> BOTS ATIVOS';
            }
        }

        if (toggleInput) {
            if (document.activeElement !== toggleInput) toggleInput.checked = !!data.runtimeEnabled;
            toggleInput.disabled = !isAdmin || !data.envEnabled;
        }

        if (document.getElementById('bt-total')) document.getElementById('bt-total').textContent = data.numbers.length;
        if (document.getElementById('bt-conectados')) document.getElementById('bt-conectados').textContent = connectedCount;
        if (document.getElementById('bt-limite')) document.getElementById('bt-limite').textContent = data.daily_limit + '/dia';
        if (document.getElementById('bt-cooldown')) document.getElementById('bt-cooldown').textContent = data.cooldown_hours + 'h';

        const grid = document.getElementById('bt-grid');
        if (!grid) return;

        const mine = data.numbers.filter(n => isAdmin ? !n.seller_id : n.seller_id === myId);
        const slotsLimit = data.wa_slots_limit || 2;
        const emptySlots = [];
        for (let i = 1; i <= slotsLimit; i++) {
            if (!mine.some(n => n.slot_index === i)) emptySlots.push(i);
        }

        const slotCards = emptySlots.map(i => `
            <div class="bt-card bt-card-empty">
                <div class="bt-card-head">
                    <div>
                        <span class="bt-num">WhatsApp ${i}</span>
                        <span class="bt-label">slot livre</span>
                    </div>
                    <div class="bt-badges"><span class="bt-badge conn-offline"><i class="fas fa-circle"></i> VAZIO</span></div>
                </div>
                <div class="bt-actions"><button class="bt-action ok" data-act="gerar-slot" data-index="${i}"><i class="fab fa-whatsapp"></i> GERAR QR CODE</button></div>
            </div>`).join('');

        if (!data.numbers.length && !slotCards) {
            grid.innerHTML = '<div class="ps-empty" style="grid-column:1/-1;"><i class="fab fa-whatsapp"></i>Nenhum número cadastrado.</div>';
            return;
        }

        grid.innerHTML = slotCards + data.numbers.map(n => {
            const rawConn = n.connection || 'offline';
            const conn = (rawConn === 'logged_out' || rawConn === 'disconnected') ? 'disconnected' : rawConn;
            const isOnline = conn === 'connected';
            const isConnecting = conn === 'connecting' || !!n.waitingQr;
            const isBanned = conn === 'banned' || n.status === 'banido';
            const connLabel = CONN_LABEL[conn] || CONN_LABEL[rawConn] || 'DESCONECTADO';

            const effLimit = n.daily_limit_override || data.daily_limit;
            const pct = effLimit ? Math.min(100, Math.round((n.messages_sent / effLimit) * 100)) : 0;
            const barCls = n.status === 'banido' ? 'danger' : (n.status === 'resfriado' ? 'warn' : '');
            const cooledInfo = n.status === 'resfriado'
                ? (n.cooled_expired ? 'pronto para reativar' : `reativa ${new Date(n.cooled_until).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`)
                : `${n.messages_sent} / ${effLimit} msgs hoje${n.daily_limit_override ? ' (próprio)' : ''}`;

            const actions = [];
            if (isOnline) {
                actions.push(`<button type="button" class="bt-action warn" data-act="desconectar" data-number="${n.number}" title="Desconectar este WhatsApp"><i class="fas fa-unlink"></i> DESCONECTAR</button>`);
            } else {
                actions.push(`<button type="button" class="bt-action ok" data-act="conectar" data-number="${n.number}" title="Conectar ou reconectar este WhatsApp"><i class="fas fa-plug"></i> ${isBanned ? 'RECONECTAR' : (isConnecting ? 'VER QR' : 'CONECTAR')}</button>`);
            }

            if (n.status !== 'ativo') {
                actions.push(`<button type="button" class="bt-action ok" data-act="reativar" data-id="${n.id}" data-number="${n.number}" title="Reativar chip"><i class="fas fa-rotate-left"></i> REATIVAR</button>`);
            }
            if (n.status !== 'banido') {
                actions.push(`<button type="button" class="bt-action danger" data-act="banir" data-id="${n.id}" title="Marcar como banido"><i class="fas fa-skull"></i> BANIR</button>`);
            }

            // Resetar sessão (limpa autenticação e libera para escanear novo QR)
            actions.push(`<button type="button" class="bt-action warn" data-act="remover" data-number="${n.number}" title="Resetar sessão e liberar slot para novo QR Code"><i class="fas fa-rotate"></i> RESETAR</button>`);
            
            const canManageCampaignUsage = n.seller_id && !isAdmin && Number(n.seller_id) === Number(myId);
            if (canManageCampaignUsage) {
                if (Number(n.campaign_enabled) === 1) {
                    actions.push(`<button type="button" class="bt-action warn" data-act="proteger-campanha" data-id="${n.id}" title="Não usar este WhatsApp em campanhas"><i class="fas fa-shield-halved"></i> SÓ ATENDIMENTO</button>`);
                } else {
                    actions.push(`<button type="button" class="bt-action ok" data-act="liberar-campanha" data-id="${n.id}" title="Disponibilizar este WhatsApp para a primeira mensagem/campanhas"><i class="fas fa-bullhorn"></i> DISPONIBILIZAR</button>`);
                }
            }

            // Excluir chip/número do sistema
            actions.push(`<button type="button" class="bt-action danger" data-act="deletar" data-id="${n.id}" data-number="${n.number}" title="Excluir este número do sistema"><i class="fas fa-trash-can"></i> DELETAR</button>`);

            const limitEditor = isAdmin ? `
                <div class="bt-limit-edit">
                    <label>Limite próprio</label>
                    <input type="number" min="1" class="bt-input" data-limit-id="${n.id}" placeholder="global (${data.daily_limit})" value="${n.daily_limit_override || ''}">
                    <button type="button" class="bt-action ok" data-act="salvar-limite" data-id="${n.id}"><i class="fas fa-check"></i></button>
                    ${n.daily_limit_override ? `<button type="button" class="bt-action warn" data-act="limpar-limite" data-id="${n.id}" title="Voltar ao global"><i class="fas fa-rotate-left"></i></button>` : ''}
                </div>` : '';

            const cleanLabel = String(n.label || '').replace(/\s*\(arquivado\)\s*/gi, '').trim();
            const isSlot = n.slot_index != null;
            const heading = isSlot ? (n.realNumber ? fmtNum(n.realNumber) : (cleanLabel || `WhatsApp ${n.slot_index}`)) : fmtNum(n.realNumber || n.number);
            const subLabel = isSlot ? (n.realNumber ? (cleanLabel || `WhatsApp ${n.slot_index}`) : 'aguardando conexão') : (cleanLabel || 'sem etiqueta');
            const isAutoPuxado = !!n.realNumber;
            const usageMode = n.seller_id
                ? (Number(n.campaign_enabled) === 1 ? 'campaign' : 'attendance')
                : 'institutional';
            const usageBadge = usageMode === 'campaign'
                ? '<span class="bt-badge bt-usage-campaign"><i class="fas fa-bullhorn"></i> CAMPANHAS</span>'
                : usageMode === 'attendance'
                    ? '<span class="bt-badge bt-usage-attendance"><i class="fas fa-headset"></i> SÓ ATENDIMENTO</span>'
                    : '<span class="bt-badge bt-usage-institutional"><i class="fas fa-building"></i> INSTITUCIONAL</span>';
            const usageTitle = usageMode === 'campaign' ? 'Bot de campanha' : usageMode === 'attendance' ? 'WhatsApp de atendimento' : 'Número institucional';
            const usageText = usageMode === 'campaign'
                ? 'Usado para disparar a primeira mensagem e filtrar SIM/NÃO. Não use para atendimento humano.'
                : usageMode === 'attendance'
                    ? 'Número oficial do vendedor para responder interessados e negociar com o cliente.'
                    : 'Número geral da empresa; admin define se será usado em campanhas ou operação.';

            return `
            <div class="bt-card bt-card-${usageMode}" data-number="${n.number}">
                <div class="bt-role-strip">
                    <span><i class="fas ${usageMode === 'campaign' ? 'fa-bullhorn' : usageMode === 'attendance' ? 'fa-headset' : 'fa-building'}"></i> ${usageTitle}</span>
                    <em>${isOnline ? 'online agora' : (isConnecting ? 'aguardando QR' : 'desconectado')}</em>
                </div>
                <div class="bt-card-head">
                    <div>
                        <span class="bt-num">${esc(heading)}</span>
                        <span class="bt-label">${esc(subLabel)}</span>
                        ${n.connection === 'connected' && n.pushName ? `<span class="bt-label" style="display:block;color:var(--ok,#10b981);font-weight:900;"><i class="fas fa-user-check"></i> ${esc(n.pushName)}</span>` : ''}
                        ${isAutoPuxado ? `<span class="bt-label" style="display:inline-flex;align-items:center;gap:4px;color:#2563eb;margin-top:2px;font-size:0.62rem;" title="Número auto-identificado pelo WhatsApp"><i class="fas fa-circle-check"></i> AUTO-IDENTIFICADO</span>` : ''}
                    </div>
                    <div class="bt-badges">
                        ${usageBadge}
                        <span class="bt-badge conn-${conn}"><i class="fas fa-circle"></i> ${connLabel}</span>
                        <span class="bt-badge ban-${n.status}">${BAN_LABEL[n.status] || n.status}</span>
                    </div>
                </div>
                <div class="bt-purpose-box">
                    <i class="fas ${usageMode === 'campaign' ? 'fa-filter-circle-dollar' : usageMode === 'attendance' ? 'fa-comments' : 'fa-diagram-project'}"></i>
                    <span>${usageText}</span>
                </div>
                <div class="bt-progress"><div class="bt-progress-bar ${barCls}" style="width:${pct}%;"></div></div>
                <div class="bt-progress-meta">
                    <span>${cooledInfo}</span>
                    <span>${pct}%</span>
                </div>
                <div class="bt-qr" data-qr-wrap=""></div>
                ${limitEditor}
                <div class="bt-actions">${actions.join('')}</div>
            </div>`;
        }).join('');

        for (const n of data.numbers) {
            if (n.waitingQr && n.connection === 'connecting') startQrPoll(n.number);
            else stopQrPoll(n.number);
        }
    }

    function startQrPoll(number) {
        if (_pollers.has(number)) return;
        pollQr(number);
        const id = setInterval(() => pollQr(number), 2500);
        _pollers.set(number, id);
    }

    function stopQrPoll(number) {
        const id = _pollers.get(number);
        if (id) { clearInterval(id); _pollers.delete(number); }
    }

    async function pollQr(number) {
        try {
            const wrap = document.querySelector(`.bt-card[data-number="${number}"] [data-qr-wrap]`);
            if (!wrap) { stopQrPoll(number); return; }
            const res = await api(`/whatsapp/qr?number=${encodeURIComponent(number)}`);
            if (res.qr) {
                wrap.classList.add('show');
                wrap.innerHTML = `
                    <img src="${res.qr}" alt="QR Code WhatsApp">
                    <span style="font-weight:800; color:var(--ink); font-size:0.75rem;"><i class="fab fa-whatsapp" style="color:#25d366;"></i> Aponte a câmera do seu WhatsApp</span>
                    <small style="color:#64748b; font-size:0.62rem; font-weight:700;">O número e nome serão identificados automaticamente</small>
                `;
            } else {
                wrap.classList.remove('show');
                wrap.innerHTML = '';
                if (res.status !== 'connecting') {
                    stopQrPoll(number);
                    if (res.status === 'connected') {
                        toast('WhatsApp conectado com sucesso! Número cadastrado.', 'ok');
                    }
                    refresh();
                }
            }
        } catch (e) { stopQrPoll(number); }
    }

    async function refresh() {
        try {
            const data = await api('/whatsapp/status');
            stopPolling();
            renderConfig(data);
        } catch (e) {
            const grid = document.getElementById('bt-grid');
            if (grid) grid.innerHTML = `<div class="ps-empty" style="color:var(--bad); grid-column:1/-1;">${esc(e.message)}</div>`;
        }
    }

    const gridEl = document.getElementById('bt-grid');
    if (gridEl) {
        gridEl.addEventListener('click', async e => {
            const btn = e.target.closest('[data-act]');
            if (!btn) return;
            const act = btn.dataset.act;
            btn.disabled = true;
            try {
                if (act === 'gerar-slot') {
                    const res = await api(`/whatsapp/slots/${btn.dataset.index}/connect`, { method: 'POST' });
                    if (res.status === 'queued') toast(res.message, 'info');
                    else toast('Gerando QR... aguarde', 'info');
                } else if (act === 'conectar' || act === 'reativar') {
                    if (act === 'reativar') {
                        await api(`/campaigns/numbers/${btn.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'ativo' }) });
                        toast('Número reativado', 'info');
                    }
                    const res = await api('/whatsapp/connect', { method: 'POST', body: JSON.stringify({ number: btn.dataset.number }) });
                    if (res.status === 'queued') toast(res.message, 'info');
                    else toast('Conectando... aguarde o QR Code', 'info');
                    startQrPoll(btn.dataset.number);
                } else if (act === 'desconectar') {
                    await api('/whatsapp/disconnect', { method: 'POST', body: JSON.stringify({ number: btn.dataset.number }) });
                    toast('Desconectado', 'info');
                } else if (act === 'liberar-campanha') {
                    const ok = await (window.confirmDialog ? window.confirmDialog({
                        title: isAdmin ? 'USAR WHATSAPP DO VENDEDOR EM CAMPANHA?' : 'DISPONIBILIZAR MEU WHATSAPP PARA CAMPANHAS?',
                        eyebrow: 'ATENÇÃO ANTI-BAN',
                        message: 'Esse número passará a participar da primeira mensagem/disparos.',
                        description: isAdmin ? 'Use apenas com autorização do vendedor, pois aumenta o risco de bloqueio.' : 'O admin verá este número como disponível para campanhas. Isso aumenta o risco de bloqueio.',
                        confirmText: isAdmin ? 'Sim, usar em campanha' : 'Sim, disponibilizar',
                        confirmIcon: 'fa-bullhorn',
                        cancelText: 'Cancelar',
                        type: 'warn',
                        icon: 'fa-triangle-exclamation'
                    }) : Promise.resolve(confirm('Disponibilizar este WhatsApp para campanhas?')));
                    if (!ok) { btn.disabled = false; return; }
                    await api(`/whatsapp/numbers/${btn.dataset.id}/campaign-usage`, { method: 'PATCH', body: JSON.stringify({ campaign_enabled: true }) });
                    toast('Número liberado para campanhas', 'info');
                } else if (act === 'proteger-campanha') {
                    await api(`/whatsapp/numbers/${btn.dataset.id}/campaign-usage`, { method: 'PATCH', body: JSON.stringify({ campaign_enabled: false }) });
                    toast('Número protegido: só atendimento', 'ok');
                } else if (act === 'banir') {
                    const ok = await (window.confirmDialog ? window.confirmDialog({
                        title: 'BANIR NÚMERO',
                        eyebrow: 'SEGURANÇA ANTI-BAN',
                        message: 'Banir este número de WhatsApp?',
                        description: 'Ele sai de circulação permanentemente e não participará mais de envios nem atendimentos.',
                        confirmText: 'Sim, banir número',
                        confirmIcon: 'fa-skull',
                        cancelText: 'Cancelar',
                        type: 'danger',
                        icon: 'fa-skull'
                    }) : Promise.resolve(confirm('Banir este número? Ele sai de circulação permanentemente.')));
                    if (!ok) { btn.disabled = false; return; }
                    await api(`/campaigns/numbers/${btn.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'banido' }) });
                    toast('Número banido', 'err');
                } else if (act === 'remover') {
                    const ok = await (window.confirmDialog ? window.confirmDialog({
                        title: 'RESETAR SESSÃO DO WHATSAPP',
                        eyebrow: 'DESCONECTAR',
                        message: 'Resetar sessão deste WhatsApp?',
                        description: 'A sessão salva será removida do sistema e o slot ficará livre para escanear um novo QR Code.',
                        confirmText: 'Sim, resetar sessão',
                        confirmIcon: 'fa-rotate',
                        cancelText: 'Cancelar',
                        type: 'warn',
                        icon: 'fa-rotate'
                    }) : Promise.resolve(confirm('Resetar sessão deste número? A sessão salva será limpa.')));
                    if (!ok) { btn.disabled = false; return; }
                    await api('/whatsapp/disconnect', { method: 'POST', body: JSON.stringify({ number: btn.dataset.number, removeSession: true }) });
                    toast('Sessão resetada com sucesso', 'ok');
                } else if (act === 'deletar') {
                    const ok = await (window.confirmDialog ? window.confirmDialog({
                        title: 'EXCLUIR NÚMERO',
                        eyebrow: 'ANTI-BAN',
                        message: 'Excluir definitivamente este número?',
                        description: 'O cadastro e a sessão do WhatsApp serão removidos do sistema.',
                        confirmText: 'Sim, excluir',
                        confirmIcon: 'fa-trash-can',
                        cancelText: 'Cancelar',
                        type: 'danger',
                        icon: 'fa-trash-can'
                    }) : Promise.resolve(confirm('Excluir este número definitivamente?')));
                    if (!ok) { btn.disabled = false; return; }
                    try {
                        await api('/whatsapp/disconnect', { method: 'POST', body: JSON.stringify({ number: btn.dataset.number, removeSession: true }) });
                    } catch (e) {}
                    await api(`/campaigns/numbers/${btn.dataset.id}`, { method: 'DELETE' });
                    toast('Número excluído com sucesso', 'ok');
                } else if (act === 'salvar-limite') {
                    const input = document.querySelector(`[data-limit-id="${btn.dataset.id}"]`);
                    const value = input ? (input.value.trim() ? Number(input.value) : null) : null;
                    await api(`/whatsapp/numbers/${btn.dataset.id}/limit`, { method: 'PATCH', body: JSON.stringify({ daily_limit_override: value }) });
                    toast(value ? `Limite próprio definido: ${value}/dia` : 'Limite próprio removido', 'info');
                } else if (act === 'limpar-limite') {
                    await api(`/whatsapp/numbers/${btn.dataset.id}/limit`, { method: 'PATCH', body: JSON.stringify({ daily_limit_override: null }) });
                    toast('Voltou a usar o limite global', 'info');
                }
            } catch (err) {
                toast(err.message, 'err');
            } finally {
                btn.disabled = false;
                refresh();
            }
        });
    }

    if (toggleInput) {
        toggleInput.addEventListener('change', async () => {
            const value = toggleInput.checked;
            toggleInput.disabled = true;
            try {
                await api('/whatsapp/toggle', { method: 'POST', body: JSON.stringify({ enabled: value }) });
                toast(value ? 'Bots retomados' : 'Bots pausados temporariamente', value ? 'ok' : 'info');
            } catch (err) {
                toast(err.message, 'err');
                toggleInput.checked = !value;
            } finally {
                toggleInput.disabled = !isAdmin;
                refresh();
            }
        });
    }

    // Handler for manual add number button in config tab
    // 1-Clique: Conectar WhatsApp via QR Code (auto-puxa o número)
    const quickScanBtn = document.getElementById('bt-quick-scan-btn');
    if (quickScanBtn) {
        quickScanBtn.onclick = async () => {
            quickScanBtn.disabled = true;
            const originalHtml = quickScanBtn.innerHTML;
            quickScanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando QR Code...';
            try {
                const res = await api('/whatsapp/auto-connect', { method: 'POST' });
                if (res.status === 'queued') {
                    toast(res.message, 'info');
                } else {
                    toast('QR Code gerado! Aponte a câmera do seu WhatsApp.', 'info');
                    await refresh();
                    if (res.number) {
                        startQrPoll(res.number);
                        const card = document.querySelector(`.bt-card[data-number="${res.number}"]`);
                        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            } catch (e) {
                toast(e.message || 'Erro ao gerar QR Code', 'err');
            } finally {
                quickScanBtn.disabled = false;
                quickScanBtn.innerHTML = originalHtml;
            }
        };
    }

    // Mensagem nova chegando ao vivo: recarrega a conversa aberta e a lista
    _onLiveMessage = (data) => {
        if (_activeLead && data && Number(data.lead_id) === _activeLead.id) {
            loadChatHistory(_activeLead);
        }
        loadLeads();
    };
    window.realtime?.on('lead:message', _onLiveMessage);

    // WhatsApp acabou de conectar e auto-puxar o número: atualiza tela imediatamente
    _onWaConnected = (data) => {
        const phone = data?.realNumber ? fmtNum(data.realNumber) : '';
        toast(`WhatsApp ${phone ? phone + ' ' : ''}conectado e cadastrado!`, 'ok');
        refresh();
    };
    window.realtime?.on('whatsapp:connected', _onWaConnected);

    // ================= CONFIGURAÇÃO DE MENSAGENS DOS BOTS =================
    let _defaultCampaignMsg = '';
    let _defaultAttendanceMsg = '';

    function simulatePreview(text, type = 'camp') {
        const raw = String(text || '');
        if (type === 'camp') {
            return raw
                .replace(/\{primeiro-nome\}/gi, 'Carlos')
                .replace(/\{nome\}/gi, 'Carlos Silva')
                .replace(/\{cpf\}/gi, '123.456.789-00')
                .replace(/\{cidade\}/gi, 'Curitiba - PR')
                .replace(/\{renda\}/gi, 'R$ 4.500,00')
                .replace(/\{limite\}/gi, 'R$ 15.000,00')
                .replace(/\{valor-desejado\}/gi, 'R$ 10.000,00')
                .replace(/\{agencia\}|\{agência\}/gi, '1234')
                .replace(/\{conta\}/gi, '56789-0');
        } else {
            return raw
                .replace(/\{nome\}/gi, 'Carlos')
                .replace(/\{vendedor\}/gi, (window.me?.name || 'Vendedor').split(' ')[0])
                .replace(/\{cidade\}/gi, 'Curitiba - PR');
        }
    }

    function updateCampLiveUI() {
        const txt = document.getElementById('cfgBotCampaignMsg')?.value || '';
        const countEl = document.getElementById('cfgBotCampaignCount');
        const prevEl = document.getElementById('cfgBotCampaignPreview');
        if (countEl) countEl.textContent = `${txt.length} caracteres`;
        if (prevEl) {
            prevEl.textContent = simulatePreview(txt, 'camp') || '(Mensagem vazia)';
        }
    }

    function updateAttLiveUI() {
        const txt = document.getElementById('cfgBotAttendanceMsg')?.value || '';
        const countEl = document.getElementById('cfgBotAttendanceCount');
        const prevEl = document.getElementById('cfgBotAttendancePreview');
        if (countEl) countEl.textContent = `${txt.length} caracteres`;
        if (prevEl) {
            prevEl.textContent = simulatePreview(txt, 'att') || '(Mensagem vazia)';
        }
    }

    async function loadBotMessagesConfig() {
        try {
            const data = await api('/sellers/me/bot-messages');
            _defaultCampaignMsg = data.default_campaign_msg || '';
            _defaultAttendanceMsg = data.default_attendance_msg || '';

            const campInput = document.getElementById('cfgBotCampaignMsg');
            const attInput = document.getElementById('cfgBotAttendanceMsg');

            if (campInput) {
                campInput.value = data.bot_campaign_msg || _defaultCampaignMsg;
                updateCampLiveUI();
            }
            if (attInput) {
                attInput.value = data.bot_attendance_msg || _defaultAttendanceMsg;
                updateAttLiveUI();
            }

            const statusCamp = document.getElementById('cfgBotCampaignStatus');
            if (statusCamp) {
                statusCamp.textContent = data.bot_campaign_msg ? 'Mensagem personalizada ativa' : 'Usando padrão do sistema';
            }
            const statusAtt = document.getElementById('cfgBotAttendanceStatus');
            if (statusAtt) {
                statusAtt.textContent = data.bot_attendance_msg ? 'Mensagem personalizada ativa' : 'Usando padrão do sistema';
            }
        } catch (e) {
            console.error('Erro ao carregar mensagens dos bots:', e);
            toast('Erro ao carregar mensagens dos bots: ' + e.message, 'err');
        }
    }

    // Eventos de digitação
    document.getElementById('cfgBotCampaignMsg')?.addEventListener('input', () => {
        updateCampLiveUI();
        const st = document.getElementById('cfgBotCampaignStatus');
        if (st) st.textContent = 'Alterações não salvas';
    });
    document.getElementById('cfgBotAttendanceMsg')?.addEventListener('input', () => {
        updateAttLiveUI();
        const st = document.getElementById('cfgBotAttendanceStatus');
        if (st) st.textContent = 'Alterações não salvas';
    });

    // Inserção de tags clicáveis
    document.getElementById('botCampTags')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.ps-btn-tag');
        if (!btn) return;
        const tag = btn.dataset.tag;
        const area = document.getElementById('cfgBotCampaignMsg');
        if (area && tag) {
            const start = area.selectionStart || area.value.length;
            const end = area.selectionEnd || area.value.length;
            area.value = area.value.substring(0, start) + tag + area.value.substring(end);
            area.focus();
            area.selectionStart = area.selectionEnd = start + tag.length;
            updateCampLiveUI();
        }
    });

    document.getElementById('botAttTags')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.ps-btn-tag');
        if (!btn) return;
        const tag = btn.dataset.tag;
        const area = document.getElementById('cfgBotAttendanceMsg');
        if (area && tag) {
            const start = area.selectionStart || area.value.length;
            const end = area.selectionEnd || area.value.length;
            area.value = area.value.substring(0, start) + tag + area.value.substring(end);
            area.focus();
            area.selectionStart = area.selectionEnd = start + tag.length;
            updateAttLiveUI();
        }
    });

    // Salvar Bot de Campanha
    document.getElementById('btnSaveBotCampaign')?.addEventListener('click', async () => {
        const txt = document.getElementById('cfgBotCampaignMsg')?.value?.trim();
        const btn = document.getElementById('btnSaveBotCampaign');
        const orig = btn.innerHTML;
        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SALVANDO...';
            await api('/sellers/me/bot-messages', {
                method: 'PATCH',
                body: JSON.stringify({ bot_campaign_msg: txt })
            });
            toast('Mensagem do Bot de Campanha salva com sucesso!', 'ok');
            const st = document.getElementById('cfgBotCampaignStatus');
            if (st) st.textContent = 'Salvo no banco de dados';
        } catch (e) {
            toast('Erro ao salvar mensagem: ' + e.message, 'err');
        } finally {
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    });

    // Restaurar Padrão Bot de Campanha
    document.getElementById('btnResetBotCampaign')?.addEventListener('click', async () => {
        if (!confirm('Deseja restaurar a mensagem padrão do sistema para o Bot de Campanha?')) return;
        const area = document.getElementById('cfgBotCampaignMsg');
        if (area) {
            area.value = _defaultCampaignMsg || 'Olá {primeiro-nome}! Aqui é a Prime Sul. Você pediu uma simulação de crédito. Posso pedir para um vendedor encaminhar a simulação? Responda SIM para continuar.';
            updateCampLiveUI();
        }
        try {
            await api('/sellers/me/bot-messages', {
                method: 'PATCH',
                body: JSON.stringify({ bot_campaign_msg: null })
            });
            toast('Mensagem restaurada para o padrão do sistema!', 'ok');
            const st = document.getElementById('cfgBotCampaignStatus');
            if (st) st.textContent = 'Usando padrão do sistema';
        } catch (e) {
            toast('Erro ao restaurar padrão: ' + e.message, 'err');
        }
    });

    // Salvar Bot de Atendimento
    document.getElementById('btnSaveBotAttendance')?.addEventListener('click', async () => {
        const txt = document.getElementById('cfgBotAttendanceMsg')?.value?.trim();
        const btn = document.getElementById('btnSaveBotAttendance');
        const orig = btn.innerHTML;
        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> SALVANDO...';
            await api('/sellers/me/bot-messages', {
                method: 'PATCH',
                body: JSON.stringify({ bot_attendance_msg: txt })
            });
            toast('Mensagem do Bot de Atendimento salva com sucesso!', 'ok');
            const st = document.getElementById('cfgBotAttendanceStatus');
            if (st) st.textContent = 'Salvo no banco de dados';
        } catch (e) {
            toast('Erro ao salvar mensagem: ' + e.message, 'err');
        } finally {
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    });

    // Restaurar Padrão Bot de Atendimento
    document.getElementById('btnResetBotAttendance')?.addEventListener('click', async () => {
        if (!confirm('Deseja restaurar a mensagem padrão do sistema para o Bot de Atendimento?')) return;
        const area = document.getElementById('cfgBotAttendanceMsg');
        if (area) {
            area.value = _defaultAttendanceMsg || 'Olá {nome}! Sou {vendedor} da equipe Prime Sul. Recebemos sua confirmação e vou continuar sua simulação de crédito por aqui.';
            updateAttLiveUI();
        }
        try {
            await api('/sellers/me/bot-messages', {
                method: 'PATCH',
                body: JSON.stringify({ bot_attendance_msg: null })
            });
            toast('Mensagem restaurada para o padrão do sistema!', 'ok');
            const st = document.getElementById('cfgBotAttendanceStatus');
            if (st) st.textContent = 'Usando padrão do sistema';
        } catch (e) {
            toast('Erro ao restaurar padrão: ' + e.message, 'err');
        }
    });

    // Initial load
    await loadLeads();
    await refresh();
    return {};
}

export async function destroy() {
    for (const [, id] of _pollers) clearInterval(id);
    _pollers.clear();
    if (_onLiveMessage) window.realtime?.off('lead:message', _onLiveMessage);
    if (_onWaConnected) window.realtime?.off('whatsapp:connected', _onWaConnected);
    const modal = document.getElementById('waQuickModal');
    if (modal) modal.remove();
}
