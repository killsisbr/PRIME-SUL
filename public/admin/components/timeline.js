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
    let _botNumbers = [];
    let _selectedBot = '';

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
            const statusLabel = n.status === 'connected' ? '● ONLINE' : n.status === 'cooldown' ? '❄ PAUSADO' : '○ OFFLINE';
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
                renderFeed();
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
            const qs = new URLSearchParams({ limit: '500' });
            const since = periodSince();
            if (since) qs.set('since', since);

            const [events, st] = await Promise.all([
                api(`/bots/timeline?${qs.toString()}`).catch(() => []),
                api('/whatsapp/status').catch(() => ({ numbers: [] }))
            ]);

            _allEvents = Array.isArray(events) ? events : [];

            // Preenche select de números se necessário
            const selNum = document.getElementById('tl-num');
            if (selNum) {
                const cur = selNum.value;
                selNum.innerHTML = '<option value="">TODOS OS NÚMEROS</option>' +
                    (st.numbers || []).map(n => `<option value="${n.number}">${fmtNum(n.number)}${n.label ? ' — ' + esc(n.label) : ''}</option>`).join('');
                selNum.value = cur;
            }

            renderBotCards(st.numbers || []);
            renderFeed();
            await loadTotals();
        } catch (e) {
            const list = document.getElementById('tl-list');
            if (list) list.innerHTML = `<div class="ps-empty" style="color:var(--bad);">${esc(e.message)}</div>`;
        }
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
        renderFeed();
    };
    document.getElementById('tl-type').onchange = renderFeed;
    document.getElementById('tl-period').onchange = refresh;
    document.getElementById('tl-search-input')?.addEventListener('input', renderFeed);

    document.getElementById('tli-close-btn')?.addEventListener('click', closeInspectorModal);
    document.getElementById('tli-done-btn')?.addEventListener('click', closeInspectorModal);

    // Preenche select de eventos com opções ricas
    const selType = document.getElementById('tl-type');
    if (selType) {
        selType.innerHTML = '<option value="">TODOS OS EVENTOS</option>' +
            Object.entries(TYPE_META).map(([k, m]) => `<option value="${k}">${m.label}</option>`).join('');
    }

    // Tecla ESC fechar inspector
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            const overlay = document.getElementById('tlEventOverlay');
            if (overlay && overlay.style.display === 'flex') closeInspectorModal();
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