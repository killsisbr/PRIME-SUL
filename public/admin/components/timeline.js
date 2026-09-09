const TYPE_META = {
    connect_queued: { icon: 'fa-hourglass-half', color: '#0ea5e9', bg: '#e0f2fe', label: 'Conexão Iniciada' },
    qr:            { icon: 'fa-qrcode', color: '#8b5cf6', bg: '#f3e8ff', label: 'QR Code Gerado' },
    qr_timeout:    { icon: 'fa-hourglass-end', color: '#f59e0b', bg: '#fef3c7', label: 'QR Code Expirou' },
    connected:     { icon: 'fa-plug', color: '#10b981', bg: '#d1fae5', label: 'Bot Conectado' },
    disconnected:  { icon: 'fa-unlink', color: '#f59e0b', bg: '#fef3c7', label: 'Desconectado' },
    send_ok:       { icon: 'fa-paper-plane', color: '#10b981', bg: '#d1fae5', label: 'Mensagem Enviada' },
    send_fail:     { icon: 'fa-circle-xmark', color: '#ef4444', bg: '#fee2e2', label: 'Envio Falhou' },
    paused:        { icon: 'fa-pause', color: '#f59e0b', bg: '#fef3c7', label: 'Disparos Pausados' },
    resume:        { icon: 'fa-play', color: '#10b981', bg: '#d1fae5', label: 'Disparos Retomados' },
    cooldown:      { icon: 'fa-snowflake', color: '#0ea5e9', bg: '#e0f2fe', label: 'Pausa Cooldown' },
    reactivated:   { icon: 'fa-rotate-left', color: '#10b981', bg: '#d1fae5', label: 'Bot Reativado' },
    daily_limit:   { icon: 'fa-gauge-high', color: '#f97316', bg: '#ffedd5', label: 'Limite Diário Atingido' },
    limit_override: { icon: 'fa-sliders', color: '#0ea5e9', bg: '#e0f2fe', label: 'Ajuste de Limite' },
    banned:        { icon: 'fa-skull', color: '#ef4444', bg: '#fee2e2', label: 'Sinal de Risco / Ban' }
};

const TYPE_FALLBACK = { icon: 'fa-circle-info', color: '#78716c', bg: '#f5f5f4', label: 'Evento do Sistema' };

const _tlTimer = { refresh: null, live: null };

function runAnime(params) {
    if (typeof window.anime === 'function') {
        return window.anime(params);
    }
}

function animateCounter(elId, targetVal) {
    const el = document.getElementById(elId);
    if (!el) return;
    const numericTarget = parseFloat(targetVal) || 0;
    const obj = { val: 0 };

    runAnime({
        targets: obj,
        val: numericTarget,
        round: 1,
        duration: 700,
        easing: 'easeOutExpo',
        update: () => {
            el.textContent = Math.round(obj.val).toLocaleString('pt-BR');
        }
    });
}

export async function init() {
    const api = window.api;
    const toast = window.toast;
    let _allEvents = [];
    let _allCampaigns = [];
    let _botNumbers = [];
    let _selectedBot = '';
    let _currentView = 'feed'; // 'feed' | 'agenda'
    let _agendaPeriod = '7d';  // '7d' | '15d' | '30d'
    let _agendaAnchor = new Date();
    let _agendaTypeFilter = '';

    function fmtNum(n) {
        if (!n) return 'Global';
        const s = String(n).replace(/\D/g, '');
        if (s.length < 12) return n;
        return `+${s.slice(0, 2)} (${s.slice(2, 4)}) ${s.slice(4, 9)}-${s.slice(9)}`;
    }

    function esc(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function parseDate(s) {
        if (!s) return new Date();
        return new Date(String(s).replace(' ', 'T') + (String(s).includes('Z') ? '' : 'Z'));
    }

    function startOfWeek(d) {
        const res = new Date(d);
        const day = res.getDay(); // 0 is Sun
        const diff = res.getDate() - day + (day === 0 ? -6 : 1); // Monday
        res.setDate(diff);
        res.setHours(0, 0, 0, 0);
        return res;
    }

    function addDays(d, n) {
        const res = new Date(d);
        res.setDate(res.getDate() + n);
        return res;
    }

    function dayKey(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function dayLabel(key) {
        const d = parseDate(key + 'T00:00:00');
        const today = dayKey(new Date());
        const yesterday = dayKey(new Date(Date.now() - 86400000));
        if (key === today) return 'HOJE';
        if (key === yesterday) return 'ONTEM';
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace(/\./g, '');
    }

    function periodSince() {
        const p = document.getElementById('tl-period')?.value;
        if (p === 'today') return dayKey(new Date()) + ' 00:00:00';
        if (p === '7d') {
            const d = new Date(Date.now() - 6 * 86400000);
            return `${dayKey(d)} 00:00:00`;
        }
        return '';
    }

    // Filter events locally by text search & bot selection
    function getFilteredEvents() {
        const query = (document.getElementById('tl-search-input')?.value || '').trim().toLowerCase();
        const numFilter = _selectedBot || document.getElementById('tl-num')?.value || '';
        const typeFilter = document.getElementById('tl-type')?.value || '';

        return _allEvents.filter(ev => {
            if (numFilter && String(ev.number || '') !== String(numFilter)) return false;
            if (typeFilter && ev.type !== typeFilter) return false;
            if (query) {
                const text = (ev.detail + ' ' + ev.number + ' ' + (ev.label || '') + ' ' + (TYPE_META[ev.type]?.label || '')).toLowerCase();
                if (!text.includes(query)) return false;
            }
            return true;
        });
    }

    function renderFeed() {
        const list = document.getElementById('tl-list');
        const countBadge = document.getElementById('tl-filtered-count');
        if (!list) return;

        const events = getFilteredEvents();
        if (countBadge) countBadge.textContent = `${events.length} evento${events.length !== 1 ? 's' : ''}`;

        if (!events.length) {
            list.innerHTML = `
                <div class="ps-empty" style="padding:40px; text-align:center;">
                    <i class="fas fa-clock-rotate-left" style="font-size:2.4rem; color:var(--text-muted); margin-bottom:10px;"></i>
                    <p style="font-weight:700;">Nenhum evento registrado para estes filtros.</p>
                </div>`;
            return;
        }

        const groups = new Map();
        for (const ev of events) {
            const d = parseDate(ev.created_at);
            const key = dayKey(d);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(ev);
        }

        list.innerHTML = [...groups.entries()].map(([key, items]) => `
            <div class="tl-group">
                <div class="tl-day-header">
                    <span>${dayLabel(key)}</span>
                    <small>${items.length} registro(s)</small>
                </div>
                <div class="tl-items-list">
                    ${items.map((ev, i) => {
                        const meta = TYPE_META[ev.type] || TYPE_FALLBACK;
                        const d = parseDate(ev.created_at);
                        const formattedTime = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                        return `
                        <div class="tl-item" data-ev-id="${ev.id || i}" title="Clique para inspecionar este evento">
                            <div class="tl-item-node" style="background:${meta.color}; border-color:var(--dark);">
                                <i class="fas ${meta.icon}"></i>
                            </div>
                            <div class="tl-item-main">
                                <div class="tl-item-top">
                                    <span class="tl-item-title">${esc(meta.label)}</span>
                                    <span class="tl-item-pill" style="background:${meta.bg}; color:${meta.color}; border-color:${meta.color};">
                                        ${esc(ev.type)}
                                    </span>
                                </div>
                                <div class="tl-item-detail">${esc(ev.detail || 'Sem descrição adicional.')}</div>
                                <div class="tl-item-meta">
                                    <span class="num"><i class="fas fa-robot"></i> ${esc(fmtNum(ev.number))}</span>
                                    ${ev.label ? `<span>• ${esc(ev.label)}</span>` : ''}
                                </div>
                            </div>
                            <div class="tl-item-time">${formattedTime}</div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `).join('');

        // Animação de entrada dos cards da timeline via Anime.js
        runAnime({
            targets: '.tl-item',
            translateY: [18, 0],
            opacity: [0, 1],
            delay: runAnime ? window.anime.stagger(25) : 0,
            duration: 340,
            easing: 'easeOutQuad'
        });

        // Click em um card de evento -> Abre o Event Inspector Subpopup
        list.querySelectorAll('.tl-item').forEach((itemEl, idx) => {
            itemEl.onclick = () => {
                const evId = itemEl.dataset.evId;
                const ev = events.find((x, i) => String(x.id || i) === String(evId)) || events[idx];
                if (ev) openInspectorModal(ev);
            };
        });
    }

    // Renderiza a barra de seleção por Número de Bot
    function renderBotCards(numbers) {
        const strip = document.getElementById('tl-bot-cards-strip');
        if (!strip) return;

        _botNumbers = numbers || [];

        const allActiveCls = _selectedBot === '' ? 'active' : '';

        let html = `
            <div class="tl-bot-card ${allActiveCls}" data-bot-num="">
                <div class="tl-bot-card-top">
                    <span class="tl-bot-av all"><i class="fas fa-layer-group"></i></span>
                    <div>
                        <strong>TODOS OS BOTS</strong>
                        <small>Visão Agregada</small>
                    </div>
                </div>
                <div class="tl-bot-card-stats">
                    <span id="tl-card-all-count">${_allEvents.length} eventos</span>
                </div>
            </div>`;

        _botNumbers.forEach((n, idx) => {
            const numStr = n.number || '';
            const isActive = _selectedBot === numStr ? 'active' : '';
            const botEventsCount = _allEvents.filter(e => String(e.number) === String(numStr)).length;
            const statusLabel = n.status === 'connected' ? 'ONLINE' : n.status === 'cooldown' ? 'PAUSADO' : 'OFFLINE';
            const initials = (n.label || 'B' + (idx + 1)).slice(0, 2).toUpperCase();

            html += `
            <div class="tl-bot-card ${isActive}" data-bot-num="${esc(numStr)}">
                <div class="tl-bot-card-top">
                    <span class="tl-bot-av">${esc(initials)}</span>
                    <div>
                        <strong>${esc(fmtNum(numStr))}</strong>
                        <small>${esc(n.label || 'Bot ' + (idx + 1))} • ${statusLabel}</small>
                    </div>
                </div>
                <div class="tl-bot-card-stats">
                    <span>${botEventsCount} eventos</span>
                </div>
            </div>`;
        });

        strip.innerHTML = html;

        // Click no card de bot -> Seleciona e filtra por esse número!
        strip.querySelectorAll('.tl-bot-card').forEach(card => {
            card.onclick = () => {
                _selectedBot = card.dataset.botNum;
                const sel = document.getElementById('tl-num');
                if (sel) sel.value = _selectedBot;
                renderBotCards(_botNumbers);
                if (_currentView === 'agenda') renderAgenda();
                else renderFeed();
            };
        });
    }

    // Carrega estatísticas globais das métricas
    async function loadTotals() {
        try {
            const t = await api('/bots/totals');
            animateCounter('tl-total', t.total);
            animateCounter('tl-sent', t.sent);
            animateCounter('tl-failed', t.failed);
            animateCounter('tl-cooldowns', t.cooldowns);
            animateCounter('tl-banned', t.banned);
        } catch (e) {}
    }

    async function refresh() {
        try {
            const qs = new URLSearchParams({ limit: '800' });
            const since = periodSince();
            if (since) qs.set('since', since);

            const [events, st, campRes] = await Promise.all([
                api(`/bots/timeline?${qs.toString()}`).catch(() => []),
                api('/whatsapp/status').catch(() => ({ numbers: [] })),
                api('/campaigns').catch(() => ({ campaigns: [] }))
            ]);

            _allEvents = Array.isArray(events) ? events : [];
            _allCampaigns = Array.isArray(campRes?.campaigns) ? campRes.campaigns : [];

            // Preenche select de números se necessário
            const selNum = document.getElementById('tl-num');
            if (selNum) {
                const cur = selNum.value;
                selNum.innerHTML = '<option value="">TODOS OS NÚMEROS</option>' +
                    (st.numbers || []).map(n => `<option value="${n.number}">${fmtNum(n.number)}${n.label ? ' — ' + esc(n.label) : ''}</option>`).join('');
                selNum.value = cur;
            }

            renderBotCards(st.numbers || []);

            if (_currentView === 'agenda') {
                renderAgenda();
            } else {
                renderFeed();
            }

            await loadTotals();
        } catch (e) {
            const list = document.getElementById('tl-list');
            if (list) list.innerHTML = `<div class="ps-empty" style="color:var(--bad);">${esc(e.message)}</div>`;
        }
    }

    // Alterna visualização entre Feed Cronológico e Agenda Preview
    function switchView(view) {
        _currentView = view;
        const btnFeed = document.getElementById('tl-btn-view-feed');
        const btnAgenda = document.getElementById('tl-btn-view-agenda');
        const feedList = document.getElementById('tl-list');
        const filterBar = document.querySelector('.tl-filter-bar');
        const agendaWrapper = document.getElementById('tl-agenda-wrapper');

        if (view === 'agenda') {
            btnAgenda?.classList.add('active');
            btnFeed?.classList.remove('active');
            if (feedList) feedList.style.display = 'none';
            if (filterBar) filterBar.style.display = 'none';
            if (agendaWrapper) agendaWrapper.style.display = 'flex';
            renderAgenda();
        } else {
            btnFeed?.classList.add('active');
            btnAgenda?.classList.remove('active');
            if (feedList) feedList.style.display = 'flex';
            if (filterBar) filterBar.style.display = 'flex';
            if (agendaWrapper) agendaWrapper.style.display = 'none';
            renderFeed();
        }
    }

    function getAgendaDays() {
        const days = [];
        if (_agendaPeriod === '7d') {
            const monday = startOfWeek(_agendaAnchor);
            for (let i = 0; i < 7; i++) {
                days.push(addDays(monday, i));
            }
        } else if (_agendaPeriod === '15d') {
            const start = addDays(_agendaAnchor, -7);
            for (let i = 0; i < 15; i++) {
                days.push(addDays(start, i));
            }
        } else if (_agendaPeriod === '30d') {
            const y = _agendaAnchor.getFullYear();
            const m = _agendaAnchor.getMonth();
            const first = new Date(y, m, 1);
            const last = new Date(y, m + 1, 0);
            for (let d = 1; d <= last.getDate(); d++) {
                days.push(new Date(y, m, d));
            }
        }
        return days;
    }

    function getDayData(d) {
        const key = dayKey(d);
        const dayEvents = _allEvents.filter(ev => {
            const evKey = dayKey(parseDate(ev.created_at));
            if (evKey !== key) return false;
            if (_selectedBot && String(ev.number || '') !== String(_selectedBot)) return false;
            if (_agendaTypeFilter === 'sends' && !['send_ok', 'send_fail'].includes(ev.type)) return false;
            if (_agendaTypeFilter === 'cooldowns' && !['cooldown', 'daily_limit', 'banned'].includes(ev.type)) return false;
            if (_agendaTypeFilter === 'campaigns' && !['campaign', 'resume', 'paused'].includes(ev.type)) return false;
            return true;
        });

        const dayCamps = _allCampaigns.filter(c => {
            const cDate = c.scheduled_at ? parseDate(c.scheduled_at) : parseDate(c.created_at);
            return dayKey(cDate) === key;
        });

        const sent = dayEvents.filter(e => e.type === 'send_ok').length;
        const failed = dayEvents.filter(e => e.type === 'send_fail').length;
        const cooldowns = dayEvents.filter(e => ['cooldown', 'daily_limit'].includes(e.type)).length;
        const total = sent + failed + dayCamps.length;

        return {
            date: d,
            key,
            events: dayEvents,
            campaigns: dayCamps,
            sent,
            failed,
            cooldowns,
            total
        };
    }

    function renderAgenda() {
        const container = document.getElementById('tl-agenda-grid-container');
        if (!container) return;

        const days = getAgendaDays();

        // Atualiza label da faixa de datas
        const rangeLabel = document.getElementById('tl-ag-range-label');
        if (rangeLabel && days.length) {
            const d1 = days[0];
            const d2 = days[days.length - 1];
            if (_agendaPeriod === '30d') {
                rangeLabel.textContent = d1.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
            } else {
                const f1 = d1.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase().replace('.', '');
                const f2 = d2.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace('.', '');
                rangeLabel.textContent = `${f1} — ${f2}`;
            }
        }

        const daysData = days.map(d => getDayData(d));

        // Atualiza KPIs da Agenda
        let totalSends = 0;
        let totalSentOk = 0;
        let totalFailed = 0;
        let maxTotal = -1;
        let peakDayStr = '--';

        daysData.forEach(dd => {
            totalSends += dd.sent + dd.failed;
            totalSentOk += dd.sent;
            totalFailed += dd.failed;
            if (dd.total > maxTotal && dd.total > 0) {
                maxTotal = dd.total;
                peakDayStr = dd.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase().replace('.', '') + ` (${dd.total} envios)`;
            }
        });

        const avg = daysData.length ? Math.round(totalSends / daysData.length) : 0;
        const rate = (totalSentOk + totalFailed) > 0 ? Math.round((totalSentOk / (totalSentOk + totalFailed)) * 100) : 100;

        animateCounter('tl-ag-kpi-total', totalSends);
        const avgEl = document.getElementById('tl-ag-kpi-avg');
        if (avgEl) avgEl.textContent = `${avg}/dia`;
        const peakEl = document.getElementById('tl-ag-kpi-peak');
        if (peakEl) peakEl.textContent = peakDayStr;
        const rateEl = document.getElementById('tl-ag-kpi-rate');
        if (rateEl) rateEl.textContent = `${rate}%`;

        // Renderiza grade
        const gridClass = _agendaPeriod === '7d' ? 'tl-ag-grid-7d' : (_agendaPeriod === '15d' ? 'tl-ag-grid-15d' : 'tl-ag-grid-30d');
        const todayKey = dayKey(new Date());

        let gridHtml = '';
        if (_agendaPeriod === '30d') {
            const weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
            gridHtml += '<div class="tl-ag-cal-header-row">' +
                weekdays.map(w => `<div class="tl-ag-cal-head-cell">${w}</div>`).join('') +
                '</div>';
        }

        gridHtml += daysData.map((dd, dayIdx) => {
            const isToday = dd.key === todayKey;
            const dayName = dd.date.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase().replace('.', '');
            const dayNum = dd.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase().replace('.', '');

            const items = [];
            dd.campaigns.forEach(c => {
                items.push({
                    type: 'campaign',
                    time: c.scheduled_at ? c.scheduled_at.slice(11, 16) : 'Agendada',
                    title: c.name || 'Campanha',
                    sub: `${c.total_target || 0} leads`,
                    badge: c.status || 'draft',
                    cls: 'campaign',
                    raw: c
                });
            });

            dd.events.forEach(ev => {
                const meta = TYPE_META[ev.type] || TYPE_FALLBACK;
                const d = parseDate(ev.created_at);
                const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const cls = ev.type === 'send_ok' ? 'success' : (ev.type === 'send_fail' ? 'fail' : (['cooldown', 'daily_limit'].includes(ev.type) ? 'cooldown' : ''));
                items.push({
                    type: ev.type,
                    time: time,
                    title: meta.label,
                    sub: fmtNum(ev.number),
                    badge: ev.type,
                    cls: cls,
                    raw: ev
                });
            });

            const maxVisible = _agendaPeriod === '7d' ? 4 : (_agendaPeriod === '15d' ? 3 : 2);
            const visibleItems = items.slice(0, maxVisible);
            const remaining = items.length - maxVisible;

            let itemsHtml = '';
            if (visibleItems.length) {
                itemsHtml = visibleItems.map((it, itIdx) => `
                    <div class="tl-ag-event-card ${it.cls}" data-day-idx="${dayIdx}" data-it-idx="${itIdx}" title="Clique para detalhes">
                        <div class="tl-ag-card-top">
                            <span class="tl-ag-card-time"><i class="far fa-clock"></i> ${esc(it.time)}</span>
                            <span class="tl-ag-card-badge">${esc(it.badge)}</span>
                        </div>
                        <div class="tl-ag-card-title">${esc(it.title)}</div>
                        <div class="tl-ag-card-bot">${esc(it.sub)}</div>
                    </div>
                `).join('');

                if (remaining > 0) {
                    itemsHtml += `<button type="button" class="tl-ag-more-btn" data-day-idx="${dayIdx}">+ ${remaining} mais (Ver todos)</button>`;
                }
            } else {
                itemsHtml = `<div class="tl-ag-empty-day" data-day-idx="${dayIdx}"><i class="fas fa-calendar-check"></i> Sem disparos</div>`;
            }

            return `
                <div class="tl-ag-day-col ${isToday ? 'is-today' : ''}" data-day-idx="${dayIdx}">
                    <div class="tl-ag-day-header" data-day-idx="${dayIdx}">
                        <div class="tl-ag-day-title">
                            <span class="tl-ag-day-name">${dayName}</span>
                            <span class="tl-ag-day-num">${dayNum}</span>
                        </div>
                        ${isToday ? '<span class="tl-ag-today-badge">HOJE</span>' : ''}
                    </div>
                    <div class="tl-ag-day-vol-strip">
                        <span>VOLUME:</span>
                        <span class="tl-ag-vol-pill" style="color:${dd.sent > 0 ? '#10b981' : 'var(--dark)'};">${dd.total} envios</span>
                    </div>
                    <div class="tl-ag-events-list">
                        ${itemsHtml}
                    </div>
                </div>
            `;
        }).join('');

        container.className = `tl-agenda-grid-container ${gridClass}`;
        container.innerHTML = gridHtml;

        // Animação de entrada dos blocos
        runAnime({
            targets: '.tl-ag-day-col',
            translateY: [12, 0],
            opacity: [0, 1],
            delay: runAnime ? window.anime.stagger(20) : 0,
            duration: 300,
            easing: 'easeOutQuad'
        });

        // Click no card de evento -> abre Inspector Modal
        container.querySelectorAll('.tl-ag-event-card').forEach(card => {
            card.onclick = (e) => {
                e.stopPropagation();
                const dayIdx = Number(card.dataset.dayIdx);
                const itIdx = Number(card.dataset.itIdx);
                const dd = daysData[dayIdx];
                if (!dd) return;
                const allItems = [...dd.campaigns.map(c => ({ type: 'campaign', raw: c })), ...dd.events.map(ev => ({ type: ev.type, raw: ev }))];
                const item = allItems[itIdx];
                if (item && item.raw) {
                    if (item.type === 'campaign') {
                        openInspectorModal({
                            type: 'campaign',
                            detail: `Campanha: ${item.raw.name}. Status: ${item.raw.status}. Meta: ${item.raw.total_target} leads. Enviados: ${item.raw.sent || 0}.`,
                            number: item.raw.number_id,
                            label: 'Campanha Agendada',
                            created_at: item.raw.scheduled_at || item.raw.created_at
                        });
                    } else {
                        openInspectorModal(item.raw);
                    }
                }
            };
        });

        // Click no cabeçalho do dia, botão mais ou dia vazio -> abre Day Drawer
        container.querySelectorAll('.tl-ag-day-header, .tl-ag-more-btn, .tl-ag-empty-day').forEach(el => {
            el.onclick = () => {
                const dayIdx = Number(el.dataset.dayIdx);
                const dd = daysData[dayIdx];
                if (dd) openDayDrawer(dd);
            };
        });
    }

    function openDayDrawer(dd) {
        const overlay = document.getElementById('tlDayOverlay');
        const shell = document.getElementById('tl-day-drawer-shell');
        if (!overlay || !shell) return;

        const dateFormatted = dd.date.toLocaleDateString('pt-BR', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
        }).toUpperCase();

        document.getElementById('tld-title').textContent = dateFormatted;
        document.getElementById('tld-subtitle').textContent = `${dd.total} disparos e eventos registrados neste dia`;

        document.getElementById('tld-sent-count').textContent = dd.sent;
        document.getElementById('tld-fail-count').textContent = dd.failed;
        document.getElementById('tld-cool-count').textContent = dd.cooldowns;
        document.getElementById('tld-camp-count').textContent = dd.campaigns.length;

        const morning = [];
        const afternoon = [];
        const night = [];

        dd.events.forEach(ev => {
            const d = parseDate(ev.created_at);
            const h = d.getHours();
            if (h >= 6 && h < 12) morning.push(ev);
            else if (h >= 12 && h < 18) afternoon.push(ev);
            else night.push(ev);
        });

        function renderShiftEvents(list, targetId, countId) {
            const container = document.getElementById(targetId);
            const countEl = document.getElementById(countId);
            if (countEl) countEl.textContent = list.length;
            if (!container) return;

            if (!list.length) {
                container.innerHTML = '<div style="font-size:0.7rem; color:var(--text-muted); padding:10px 0; text-align:center;">Nenhum disparo neste turno</div>';
                return;
            }

            container.innerHTML = list.map((ev, i) => {
                const meta = TYPE_META[ev.type] || TYPE_FALLBACK;
                const d = parseDate(ev.created_at);
                const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                return `
                    <div class="tl-ag-event-card ${ev.type === 'send_ok' ? 'success' : (ev.type === 'send_fail' ? 'fail' : '')}" style="cursor:pointer;" data-ev-shift="${i}">
                        <div class="tl-ag-card-top">
                            <span class="tl-ag-card-time"><i class="far fa-clock"></i> ${time}</span>
                            <span class="tl-ag-card-badge">${esc(ev.type)}</span>
                        </div>
                        <div class="tl-ag-card-title">${esc(meta.label)}</div>
                        <div class="tl-ag-card-bot">${esc(ev.detail || fmtNum(ev.number))}</div>
                    </div>
                `;
            }).join('');

            container.querySelectorAll('.tl-ag-event-card').forEach((card, idx) => {
                card.onclick = () => {
                    openInspectorModal(list[idx]);
                };
            });
        }

        renderShiftEvents(morning, 'tld-shift-m-list', 'tld-shift-m-count');
        renderShiftEvents(afternoon, 'tld-shift-a-list', 'tld-shift-a-count');
        renderShiftEvents(night, 'tld-shift-n-list', 'tld-shift-n-count');

        overlay.style.display = 'flex';
        runAnime({
            targets: shell,
            scale: [0.88, 1],
            opacity: [0, 1],
            duration: 300,
            easing: 'easeOutBack'
        });
    }

    function closeDayDrawer() {
        const overlay = document.getElementById('tlDayOverlay');
        const shell = document.getElementById('tl-day-drawer-shell');
        if (!overlay) return;

        runAnime({
            targets: shell,
            scale: [1, 0.9],
            opacity: [1, 0],
            duration: 200,
            easing: 'easeInCubic',
            complete: () => {
                overlay.style.display = 'none';
            }
        });
    }

    // SUBMODAL: Event Inspector (Merged Subpopup)
    function openInspectorModal(ev) {
        const overlay = document.getElementById('tlEventOverlay');
        const shell = document.getElementById('tl-inspector-shell');
        if (!overlay || !shell) return;

        const meta = TYPE_META[ev.type] || TYPE_FALLBACK;
        const d = parseDate(ev.created_at);

        document.getElementById('tli-type-title').textContent = meta.label;
        document.getElementById('tli-timestamp-subtitle').textContent = `Registrado em ${d.toLocaleString('pt-BR')}`;
        document.getElementById('tli-bot-number').textContent = fmtNum(ev.number);
        document.getElementById('tli-event-type').textContent = ev.type || 'INFO';
        document.getElementById('tli-bot-label').textContent = ev.label || 'Sessão Ativa';
        document.getElementById('tli-exact-time').textContent = d.toLocaleTimeString('pt-BR');
        document.getElementById('tli-detail-text').textContent = ev.detail || 'Sem informações adicionais.';
        document.getElementById('tli-raw-json').textContent = JSON.stringify(ev, null, 2);

        overlay.style.display = 'flex';
        runAnime({
            targets: shell,
            scale: [0.88, 1],
            opacity: [0, 1],
            duration: 320,
            easing: 'easeOutBack'
        });
    }

    function closeInspectorModal() {
        const overlay = document.getElementById('tlEventOverlay');
        const shell = document.getElementById('tl-inspector-shell');
        if (!overlay) return;

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

    // Event listeners de controles
    document.getElementById('tl-refresh').onclick = refresh;
    document.getElementById('tl-num').onchange = (e) => {
        _selectedBot = e.target.value;
        renderBotCards(_botNumbers);
        if (_currentView === 'agenda') renderAgenda();
        else renderFeed();
    };
    document.getElementById('tl-type').onchange = () => {
        if (_currentView === 'agenda') renderAgenda();
        else renderFeed();
    };
    document.getElementById('tl-period').onchange = refresh;
    document.getElementById('tl-search-input')?.addEventListener('input', () => {
        if (_currentView === 'agenda') renderAgenda();
        else renderFeed();
    });

    // View Switcher (Feed vs Agenda Preview)
    document.getElementById('tl-btn-view-feed')?.addEventListener('click', () => switchView('feed'));
    document.getElementById('tl-btn-view-agenda')?.addEventListener('click', () => switchView('agenda'));

    // Seletores de Período da Agenda (7d, 15d, 30d)
    document.querySelectorAll('.tl-ag-period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tl-ag-period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _agendaPeriod = btn.dataset.agPeriod || '7d';
            renderAgenda();
        });
    });

    // Navegação temporal da Agenda
    document.getElementById('tl-ag-prev')?.addEventListener('click', () => {
        if (_agendaPeriod === '7d') _agendaAnchor = addDays(_agendaAnchor, -7);
        else if (_agendaPeriod === '15d') _agendaAnchor = addDays(_agendaAnchor, -15);
        else _agendaAnchor = new Date(_agendaAnchor.getFullYear(), _agendaAnchor.getMonth() - 1, 1);
        renderAgenda();
    });

    document.getElementById('tl-ag-next')?.addEventListener('click', () => {
        if (_agendaPeriod === '7d') _agendaAnchor = addDays(_agendaAnchor, 7);
        else if (_agendaPeriod === '15d') _agendaAnchor = addDays(_agendaAnchor, 15);
        else _agendaAnchor = new Date(_agendaAnchor.getFullYear(), _agendaAnchor.getMonth() + 1, 1);
        renderAgenda();
    });

    document.getElementById('tl-ag-today')?.addEventListener('click', () => {
        _agendaAnchor = new Date();
        renderAgenda();
    });

    // Filtro de tipo na Agenda
    document.getElementById('tl-ag-type-filter')?.addEventListener('change', (e) => {
        _agendaTypeFilter = e.target.value;
        renderAgenda();
    });

    // Submodais (Inspector & Day Drawer)
    document.getElementById('tli-close-btn')?.addEventListener('click', closeInspectorModal);
    document.getElementById('tli-done-btn')?.addEventListener('click', closeInspectorModal);
    document.getElementById('tld-close-btn')?.addEventListener('click', closeDayDrawer);
    document.getElementById('tld-done-btn')?.addEventListener('click', closeDayDrawer);

    // Preenche select de eventos com opções ricas
    const selType = document.getElementById('tl-type');
    if (selType) {
        selType.innerHTML = '<option value="">TODOS OS EVENTOS</option>' +
            Object.entries(TYPE_META).map(([k, m]) => `<option value="${k}">${m.label}</option>`).join('');
    }

    // Tecla ESC fecha modais abertos
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            const overlay = document.getElementById('tlEventOverlay');
            if (overlay && overlay.style.display === 'flex') closeInspectorModal();
            const dayOverlay = document.getElementById('tlDayOverlay');
            if (dayOverlay && dayOverlay.style.display === 'flex') closeDayDrawer();
        }
    });

    await refresh();

    // Intervals de atualização em tempo real
    _tlTimer.refresh = setInterval(refresh, 6000);
    _tlTimer.live = setInterval(() => {
        const el = document.getElementById('tl-live');
        if (el) el.classList.toggle('dim');
    }, 1000);

    return {};
}

export async function destroy() {
    clearInterval(_tlTimer.refresh);
    clearInterval(_tlTimer.live);
    _tlTimer.refresh = null;
    _tlTimer.live = null;
}