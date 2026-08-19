const COLORS = {
    teal: '#075e54', purple: '#833ab4', blue: '#1e3c72',
    red: '#ff416c', orange: '#fcb045', dark: '#0f2027'
};
const FONTS = {
    '1': 'Georgia, serif',
    '2': 'Helvetica Neue, Arial, sans-serif',
    '3': 'Caveat, cursive',
    '4': 'Comic Sans MS, cursive',
    '5': 'Courier New, monospace'
};
const EMOJIS = ['💸', '🏦', '🚗', '✨', '🔥', '📞', '🎁', '🤑', '✅', '❤️'];
const TEMPLATES = [
    { icon: '🔥', name: 'Oferta do Dia', msg: '🔥 *OFERTA DO DIA*\n\nCrédito com as melhores taxas do mercado!\n\nChame agora e veja quanto você pode pegar. ✅' },
    { icon: '✨', name: 'Novidades', msg: '✨ *NOVIDADES*\n\nNovas condições de pagamento disponíveis.\n\nFale com a gente! 📞' },
    { icon: '🎟️', name: 'Cupom Desconto', msg: '🎟️ *CUPOM DE DESCONTO*\n\nTaxas reduzidas esta semana.\n\nGaranta já a sua simulação! 🚀' },
    { icon: '📞', name: 'Peça sua Simulação', msg: '📞 *PEÇA SUA SIMULAÇÃO*\n\nCrédito aprovado em minutos.\n\nResponda SIM para continuar! 💰' }
];
const TYPE_META = { text: { icon: 'fa-font', label: 'TEXTO' }, image: { icon: 'fa-image', label: 'FOTO' }, link: { icon: 'fa-link', label: 'LINK' } };
const STATUS_META = {
    scheduled: { label: 'AGENDADO', cls: 'sched' },
    sent: { label: 'ENVIADO', cls: 'sent' },
    failed: { label: 'FALHA', cls: 'fail' },
    cancelled: { label: 'CANCELADO', cls: 'cancel' }
};

const _mk = { editing: null, type: 'text', color: 'teal', simulateTimer: null, numbers: [] };

export async function init() {
    const api = window.api;
    const toast = window.toast;

    function escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function fmtNum(n) {
        const s = String(n).replace(/\D/g, '');
        if (s.length < 12) return n;
        return `+${s.slice(0, 2)} (${s.slice(2, 4)}) ${s.slice(4, 9)}-${s.slice(9)}`;
    }

    function fmtLocal(utc) {
        if (!utc) return '—';
        return new Date(String(utc).replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    function toUtc(localValue) {
        if (!localValue) return null;
        return new Date(localValue).toISOString().replace('T', ' ').slice(0, 19);
    }

    function toLocalInput(utc) {
        if (!utc) return '';
        const d = new Date(String(utc).replace(' ', 'T') + 'Z');
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function render(posts) {
        const agendados = posts.filter(p => p.status === 'scheduled').length;
        const enviados = posts.filter(p => p.status === 'sent').length;
        const falhas = posts.filter(p => p.status === 'failed').length;
        document.getElementById('mk-agendados').textContent = agendados;
        document.getElementById('mk-enviados').textContent = enviados;
        document.getElementById('mk-falhas').textContent = falhas;

        const list = document.getElementById('mk-list');
        if (!posts.length) {
            list.innerHTML = '<div class="ps-empty"><i class="fas fa-bullhorn"></i>Nenhum status criado ainda.<br>Clique em "NOVO STATUS" para criar o primeiro.</div>';
            return;
        }
        list.innerHTML = posts.map(p => {
            const t = TYPE_META[p.type] || TYPE_META.text;
            const s = STATUS_META[p.status] || STATUS_META.scheduled;
            const canSend = p.status === 'scheduled' || p.status === 'failed';
            return `
            <article class="mk-card" data-id="${p.id}">
                <div class="mk-card-main">
                    <span class="mk-type-badge"><i class="fas ${t.icon}"></i> ${t.label}</span>
                    <div class="mk-card-title">${escapeHtml(p.title)}</div>
                    <div class="mk-card-sub">${escapeHtml((p.message || '').slice(0, 90))}${(p.message || '').length > 90 ? '…' : ''}</div>
                    <div class="mk-card-meta">
                        ${p.recurring ? '<span class="mk-chip recur"><i class="fas fa-rotate"></i> DIÁRIO</span>' : ''}
                        <span>🕐 ${fmtLocal(p.scheduled_at)}</span>
                        ${p.error ? `<span class="mk-chip err">${escapeHtml(p.error)}</span>` : ''}
                    </div>
                </div>
                <div class="mk-card-right">
                    <span class="mk-status ${s.cls}"><i class="fas fa-circle"></i> ${s.label}</span>
                    <div class="mk-card-actions">
                        ${canSend ? `<button type="button" class="mk-act send" data-act="send"><i class="fas fa-paper-plane"></i></button>` : ''}
                        <button type="button" class="mk-act" data-act="edit"><i class="fas fa-pen"></i></button>
                        <button type="button" class="mk-act del" data-act="del"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
            </article>`;
        }).join('');
    }

    async function refresh() {
        try {
            const posts = await api('/marketing/posts');
            _mk.posts = posts;
            render(posts);
            renderWeek(posts);
        } catch (e) {
            document.getElementById('mk-list').innerHTML = `<div class="ps-empty" style="color:var(--bad);">${escapeHtml(e.message)}</div>`;
        }
    }

    // ============ VISÃO SEMANAL ============
    // Segunda a domingo da semana atual — usa scheduled_at (agendado) ou sent_at
    // (já publicado) pra encaixar o post no dia certo.
    const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

    function parseUtc(s) {
        return new Date(String(s).replace(' ', 'T') + 'Z');
    }

    function startOfWeek(d) {
        const day = d.getDay(); // 0=domingo
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((day + 6) % 7));
        monday.setHours(0, 0, 0, 0);
        return monday;
    }

    function renderWeek(posts) {
        const box = document.getElementById('mk-week');
        const monday = startOfWeek(new Date());
        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday); d.setDate(monday.getDate() + i); return d;
        });

        const byDay = days.map(() => []);
        for (const p of posts) {
            const ref = p.sent_at || p.scheduled_at;
            if (!ref) continue;
            const d = parseUtc(ref);
            const idx = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(monday.getFullYear(), monday.getMonth(), monday.getDate())) / 86400000);
            if (idx >= 0 && idx < 7) byDay[idx].push(p);
        }

        const todayKey = new Date().toDateString();
        box.innerHTML = days.map((d, i) => {
            const isToday = d.toDateString() === todayKey;
            const items = byDay[i].sort((a, b) => (a.sent_at || a.scheduled_at).localeCompare(b.sent_at || b.scheduled_at));
            return `
            <div class="mk-week-day ${isToday ? 'today' : ''}">
                <div class="mk-week-head"><span>${WEEKDAYS[d.getDay()]}</span><b>${d.getDate()}</b></div>
                <div class="mk-week-items">
                    ${items.length ? items.map(p => {
                        const s = STATUS_META[p.status] || STATUS_META.scheduled;
                        const t = parseUtc(p.sent_at || p.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        return `<div class="mk-week-item ${s.cls}" data-id="${p.id}" title="${escapeHtml(p.title)}"><span class="mk-week-time">${t}</span>${escapeHtml(p.title)}</div>`;
                    }).join('') : '<div class="mk-week-empty">—</div>'}
                </div>
            </div>`;
        }).join('');
    }

    async function fillNumbers() {
        try {
            const st = await api('/whatsapp/status');
            _mk.numbers = st.numbers || [];
            document.getElementById('mk-number').innerHTML = '<option value="">Auto (menos usado)</option>' +
                _mk.numbers.map(n => `<option value="${n.id}">${fmtNum(n.number)}${n.label ? ' — ' + escapeHtml(n.label) : ''}</option>`).join('');
        } catch (e) { /* sem números */ }
    }

    // ============ POPUP ============
    function openPopup() {
        document.getElementById('mkOverlay').style.display = 'flex';
    }
    function closePopup() {
        document.getElementById('mkOverlay').style.display = 'none';
        _mk.editing = null;
        _mk.simulateTimer && clearTimeout(_mk.simulateTimer);
    }

    function resetForm() {
        _mk.type = 'text';
        _mk.color = 'teal';
        document.getElementById('mk-title-input').value = '';
        document.getElementById('mk-message').value = '';
        document.getElementById('mk-media').value = '';
        document.getElementById('mk-media-file').value = '';
        document.getElementById('mk-upload-name').textContent = 'Nenhuma imagem selecionada';
        document.getElementById('mk-schedule').value = '';
        document.getElementById('mk-recurring').checked = false;
        document.getElementById('mk-font').value = '2';
        document.getElementById('mk-number').value = '';
        document.querySelector('input[name="mk-type"][value="text"]').checked = true;
        setActiveType('text');
        setActiveColor('teal');
        switchTab('conteudo');
        updatePreview();
        document.getElementById('mk-delete').style.display = 'none';
        document.getElementById('mk-title').textContent = 'NOVO STATUS';
        document.getElementById('mk-subtitle').textContent = 'Agende um status promocional para o bot publicar';
    }

    function editPost(p) {
        resetForm();
        _mk.editing = p;
        document.getElementById('mk-title-input').value = p.title || '';
        document.getElementById('mk-message').value = p.message || '';
        document.getElementById('mk-media').value = p.media_url || '';
        document.getElementById('mk-upload-name').textContent = p.media_url ? p.media_url.split('/').pop() : 'Nenhuma imagem selecionada';
        document.getElementById('mk-schedule').value = toLocalInput(p.scheduled_at);
        document.getElementById('mk-recurring').checked = !!p.recurring;
        document.getElementById('mk-font').value = p.font || '2';
        if (p.number_id) document.getElementById('mk-number').value = p.number_id;
        _mk.type = p.type || 'text';
        document.querySelector(`input[name="mk-type"][value="${_mk.type}"]`).checked = true;
        setActiveType(_mk.type);
        _mk.color = p.color || 'teal';
        setActiveColor(_mk.color);
        document.getElementById('mk-delete').style.display = '';
        document.getElementById('mk-title').textContent = 'EDITAR STATUS';
        document.getElementById('mk-subtitle').textContent = p.status === 'sent' ? 'Já enviado — você pode duplicar ajustando o texto' : 'Ajuste e grave o status';
        updatePreview();
        openPopup();
    }

    function newPost() {
        resetForm();
        openPopup();
    }

    function setActiveType(type) {
        _mk.type = type;
        document.querySelectorAll('.mk-type').forEach(el => el.classList.toggle('active', el.querySelector('input').value === type));
        const isImage = type === 'image';
        document.getElementById('mk-upload-row').style.display = isImage ? '' : 'none';
        document.getElementById('mk-media-label').style.display = isImage ? '' : 'none';
        updatePreview();
    }

    function setActiveColor(color) {
        _mk.color = color;
        document.querySelectorAll('.mk-color').forEach(el => el.classList.toggle('active', el.dataset.color === color));
        updatePreview();
    }

    function switchTab(name) {
        document.querySelectorAll('.mk-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
        document.querySelectorAll('.mk-section').forEach(s => { s.style.display = s.id === `mkSec-${name}` ? '' : 'none'; });
    }

    function updateCharCount() {
        const v = document.getElementById('mk-message').value;
        document.getElementById('mk-charcount').textContent = `${v.length} / 2200`;
        if (v.length > 2200) document.getElementById('mk-message').value = v.slice(0, 2200);
        updatePreview();
    }

    function updatePreview() {
        const msg = document.getElementById('mk-message').value;
        const textCenter = document.getElementById('mk-text-center');
        textCenter.textContent = msg || 'Legenda do Status aqui...';
        textCenter.style.fontFamily = FONTS[document.getElementById('mk-font').value] || FONTS['2'];
        textCenter.style.fontSize = msg.length > 120 ? '1rem' : '1.25rem';

        document.getElementById('mk-img').src = document.getElementById('mk-media').value || 'https://images.unsplash.com/photo-1542435503-956c469947f6?w=400';
        document.getElementById('mk-img-caption').textContent = msg;

        document.getElementById('mk-link-text').textContent = msg || 'Acesse e confira a oferta!';

        const bg = COLORS[_mk.color] || COLORS.teal;
        document.getElementById('mk-tpl-text').style.background = `linear-gradient(135deg, ${bg}, #00000055), ${bg}`;
        document.getElementById('mk-tpl-link').style.background = `linear-gradient(135deg, ${bg}, #1a1a1a)`;

        document.getElementById('mk-tpl-text').style.display = _mk.type === 'text' ? 'flex' : 'none';
        document.getElementById('mk-tpl-image').style.display = _mk.type === 'image' ? 'block' : 'none';
        document.getElementById('mk-tpl-link').style.display = _mk.type === 'link' ? 'flex' : 'none';
    }

    function simulate() {
        const fill = document.getElementById('mk-progress-fill');
        const screen = document.getElementById('mk-screen');
        clearTimeout(_mk.simulateTimer);
        fill.style.transition = 'none';
        fill.style.width = '0%';
        void screen.offsetWidth;
        fill.style.transition = 'width 4s linear';
        fill.style.width = '100%';
        screen.classList.remove('mk-pulse');
        void screen.offsetWidth;
        screen.classList.add('mk-pulse');
        _mk.simulateTimer = setTimeout(() => {
            fill.style.transition = 'none';
            fill.style.width = '60%';
            screen.classList.remove('mk-pulse');
        }, 4100);
    }

    function collect() {
        const title = document.getElementById('mk-title-input').value.trim();
        if (!title) throw new Error('Informe o título do agendamento');
        const msg = document.getElementById('mk-message').value;
        if (!msg.trim()) throw new Error('Escreva a mensagem do status');
        const numberId = document.getElementById('mk-number').value;
        return {
            title,
            type: _mk.type,
            message: msg,
            media_url: _mk.type === 'image' ? document.getElementById('mk-media').value.trim() : '',
            color: _mk.color,
            font: document.getElementById('mk-font').value,
            number_id: numberId ? Number(numberId) : null,
            scheduled_at: toUtc(document.getElementById('mk-schedule').value),
            recurring: document.getElementById('mk-recurring').checked ? 1 : 0
        };
    }

    // ============ ELEMENTOS DRAWER/TEMPLATES ============
    document.getElementById('mk-drawer').innerHTML = EMOJIS.map(e => `<span class="mk-emoji" data-e="${e}">${e}</span>`).join('');
    document.getElementById('mk-templates').innerHTML = TEMPLATES.map(t => `<span class="mk-template" data-msg="${escapeHtml(t.msg)}">${t.icon} ${t.name}</span>`).join('');

    // ============ EVENTOS ============
    document.getElementById('mk-new').onclick = newPost;
    document.getElementById('mk-close').onclick = closePopup;
    document.getElementById('mk-cancel').onclick = closePopup;
    document.getElementById('mkOverlay').addEventListener('click', e => { if (e.target.id === 'mkOverlay') closePopup(); });

    document.querySelectorAll('.mk-tab').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
    document.querySelectorAll('input[name="mk-type"]').forEach(r => r.onchange = () => setActiveType(r.value));
    document.querySelectorAll('.mk-color').forEach(c => c.onclick = () => setActiveColor(c.dataset.color));
    document.getElementById('mk-font').onchange = updatePreview;
    document.getElementById('mk-message').oninput = updateCharCount;

    document.getElementById('mk-upload-btn').onclick = () => document.getElementById('mk-media-file').click();
    document.getElementById('mk-media-file').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const nameEl = document.getElementById('mk-upload-name');
        nameEl.textContent = 'Enviando...';
        const fd = new FormData();
        fd.append('file', file);
        try {
            const res = await fetch('/api/marketing/upload', { method: 'POST', body: fd });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Erro ao enviar imagem');
            document.getElementById('mk-media').value = data.url;
            nameEl.textContent = file.name;
            updatePreview();
        } catch (err) {
            nameEl.textContent = 'Nenhuma imagem selecionada';
            document.getElementById('mk-media').value = '';
            toast(err.message, 'err');
        }
    };
    document.getElementById('mk-drawer').addEventListener('click', e => {
        const em = e.target.closest('.mk-emoji');
        if (!em) return;
        const ta = document.getElementById('mk-message');
        ta.value += em.dataset.e;
        updateCharCount();
    });
    document.getElementById('mk-templates').addEventListener('click', e => {
        const t = e.target.closest('.mk-template');
        if (!t) return;
        document.getElementById('mk-message').value = t.dataset.msg;
        updateCharCount();
    });
    document.getElementById('mk-simulate').onclick = simulate;

    document.getElementById('mk-save').onclick = async () => {
        let payload;
        try { payload = collect(); } catch (e) { toast(e.message, 'err'); return; }
        document.getElementById('mk-save').disabled = true;
        try {
            const res = _mk.editing
                ? await api(`/marketing/posts/${_mk.editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
                : await api('/marketing/posts', { method: 'POST', body: JSON.stringify(payload) });
            toast('Status gravado', 'info');
            closePopup();
            refresh();
        } catch (e) {
            toast(e.message, 'err');
        } finally {
            document.getElementById('mk-save').disabled = false;
        }
    };

    document.getElementById('mk-delete').onclick = async () => {
        if (!_mk.editing) return;
        if (!confirm('Excluir este status?')) return;
        try {
            await api(`/marketing/posts/${_mk.editing.id}`, { method: 'DELETE' });
            toast('Status excluído', 'info');
            closePopup();
            refresh();
        } catch (e) {
            toast(e.message, 'err');
        }
    };

    document.getElementById('mk-list').addEventListener('click', async e => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const card = btn.closest('.mk-card');
        const id = Number(card.dataset.id);
        const act = btn.dataset.act;
        try {
            if (act === 'edit') {
                const p = (await api('/marketing/posts')).find(x => x.id === id);
                editPost(p);
            } else if (act === 'send') {
                if (!confirm('Enviar agora para o WhatsApp?')) return;
                btn.disabled = true;
                const res = await api(`/marketing/posts/${id}/send-now`, { method: 'POST' });
                toast(res.sent ? 'Status publicado!' : (res.reason === 'no_number' ? 'Sem bot disponível' : 'Nenhum bot conectado'), res.sent ? 'info' : 'err');
                refresh();
            } else if (act === 'del') {
                if (!confirm('Excluir este status?')) return;
                await api(`/marketing/posts/${id}`, { method: 'DELETE' });
                toast('Status excluído', 'info');
                refresh();
            }
        } catch (err) {
            toast(err.message, 'err');
        } finally {
            btn.disabled = false;
        }
    });

    document.querySelectorAll('.mk-view-btn').forEach(b => b.onclick = () => {
        document.querySelectorAll('.mk-view-btn').forEach(x => x.classList.toggle('active', x === b));
        const isWeek = b.dataset.view === 'semana';
        document.getElementById('mk-week').hidden = !isWeek;
        document.getElementById('mk-list').hidden = isWeek;
    });

    document.getElementById('mk-week').addEventListener('click', e => {
        const item = e.target.closest('.mk-week-item');
        if (!item) return;
        const p = (_mk.posts || []).find(x => x.id === Number(item.dataset.id));
        if (p) editPost(p);
    });

    await fillNumbers();
    await refresh();
    return {};
}

export async function destroy() {
    clearTimeout(_mk.simulateTimer);
    _mk.simulateTimer = null;
}