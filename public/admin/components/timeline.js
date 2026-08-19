const TYPE_META = {
    connect_queued: { icon: 'fa-hourglass-half', color: 'var(--info)', label: 'Conexão iniciada' },
    qr:            { icon: 'fa-qrcode', color: 'var(--violet)', label: 'QR gerado' },
    qr_timeout:    { icon: 'fa-hourglass-end', color: 'var(--warning)', label: 'QR expirou sem scan' },
    connected:     { icon: 'fa-plug', color: 'var(--ok)', label: 'Bot conectado' },
    disconnected:  { icon: 'fa-unlink', color: 'var(--warning)', label: 'Desconectado' },
    send_ok:       { icon: 'fa-paper-plane', color: 'var(--ok)', label: 'Mensagem enviada' },
    send_fail:     { icon: 'fa-circle-xmark', color: 'var(--bad)', label: 'Envio falhou' },
    paused:        { icon: 'fa-pause', color: 'var(--warning)', label: 'Campanha pausada' },
    resume:        { icon: 'fa-play', color: 'var(--ok)', label: 'Campanha retomada' },
    cooldown:      { icon: 'fa-snowflake', color: 'var(--info)', label: 'Cooldown' },
    reactivated:   { icon: 'fa-rotate-left', color: 'var(--ok)', label: 'Reativado' },
    daily_limit:   { icon: 'fa-gauge-high', color: 'var(--warning)', label: 'Limite diário' },
    limit_override: { icon: 'fa-sliders', color: 'var(--info)', label: 'Limite do número ajustado' },
    banned:        { icon: 'fa-skull', color: 'var(--bad)', label: 'Banido' }
};
const TYPE_FALLBACK = { icon: 'fa-circle-info', color: 'var(--text-muted)', label: 'Evento' };

const _tlTimer = { refresh: null, live: null };

export async function init() {
    const api = window.api;

    function fmtNum(n) {
        const s = String(n).replace(/\D/g, '');
        if (s.length < 12) return n;
        return `+${s.slice(0, 2)} (${s.slice(2, 4)}) ${s.slice(4, 9)}-${s.slice(9)}`;
    }

    function parseDate(s) {
        if (!s) return new Date();
        return new Date(String(s).replace(' ', 'T') + 'Z');
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

    function render(events) {
        const list = document.getElementById('tl-list');
        if (!events.length) {
            list.innerHTML = '<div class="ps-empty"><i class="fas fa-clock-rotate-left"></i>Nenhum evento registrado ainda.<br>Os bots ainda não dispararam mensagens neste ambiente.</div>';
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
                <div class="tl-day"><span>${dayLabel(key)}</span><i>${items.length} evento(s)</i></div>
                <div class="tl-column">
                    ${items.map(ev => {
                        const meta = TYPE_META[ev.type] || TYPE_FALLBACK;
                        const d = parseDate(ev.created_at);
                        return `
                        <div class="tl-item">
                            <div class="tl-node" style="background:${meta.color};"><i class="fas ${meta.icon}"></i></div>
                            <div class="tl-main">
                                <div class="tl-title">${meta.label}</div>
                                <div class="tl-detail">${escapeHtml(ev.detail || '')}</div>
                                <div class="tl-meta"><span class="tl-num">${escapeHtml(fmtNum(ev.number))}</span>${ev.label ? `<span>${escapeHtml(ev.label)}</span>` : ''}</div>
                            </div>
                            <div class="tl-time">${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `).join('');
    }

    function escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function periodSince() {
        const p = document.getElementById('tl-period').value;
        if (p === 'today') return dayKey(new Date()) + ' 00:00:00';
        if (p === '7d') {
            const d = new Date(Date.now() - 6 * 86400000);
            return `${dayKey(d)} 00:00:00`;
        }
        return '';
    }

    async function loadTotals() {
        try {
            const t = await api('/bots/totals');
            document.getElementById('tl-total').textContent = t.total;
            document.getElementById('tl-sent').textContent = t.sent;
            document.getElementById('tl-failed').textContent = t.failed;
            document.getElementById('tl-cooldowns').textContent = t.cooldowns;
            document.getElementById('tl-banned').textContent = t.banned;
        } catch (e) { /* não bloqueia a timeline */ }
    }

    async function refresh() {
        try {
            const qs = new URLSearchParams({ limit: '400' });
            const num = document.getElementById('tl-num').value;
            if (num) qs.set('number', num);
            const type = document.getElementById('tl-type').value;
            if (type) qs.set('type', type);
            const since = periodSince();
            if (since) qs.set('since', since);
            const events = await api(`/bots/timeline?${qs.toString()}`);
            render(events);
            await loadTotals();
        } catch (e) {
            document.getElementById('tl-list').innerHTML = `<div class="ps-empty" style="color:var(--bad);">${escapeHtml(e.message)}</div>`;
        }
    }

    // Preenche selects de número e tipo a partir do status (números cadastrados)
    async function fillNumbers() {
        try {
            const st = await api('/whatsapp/status');
            const sel = document.getElementById('tl-num');
            const current = sel.value;
            sel.innerHTML = '<option value="">TODOS OS NÚMEROS</option>' +
                st.numbers.map(n => `<option value="${n.number}">${fmtNum(n.number)}${n.label ? ' — ' + escapeHtml(n.label) : ''}</option>`).join('');
            sel.value = current;
        } catch (e) { /* sem números cadastrados */ }
    }

    document.getElementById('tl-refresh').onclick = refresh;
    document.getElementById('tl-num').onchange = refresh;
    document.getElementById('tl-type').onchange = refresh;
    document.getElementById('tl-period').onchange = refresh;

    document.getElementById('tl-type').innerHTML = '<option value="">TODOS OS EVENTOS</option>' +
        Object.entries(TYPE_META).map(([k, m]) => `<option value="${k}">${m.label}</option>`).join('');

    await fillNumbers();
    await refresh();
    _tlTimer.refresh = setInterval(refresh, 8000);
    _tlTimer.live = setInterval(() => {
        const el = document.getElementById('tl-live');
        el.classList.toggle('dim');
    }, 1000);

    return {};
}

export async function destroy() {
    clearInterval(_tlTimer.refresh);
    clearInterval(_tlTimer.live);
    _tlTimer.refresh = null;
    _tlTimer.live = null;
}