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

    function applyFilters() {
        const search = document.getElementById('kbx-search').value.trim().toLowerCase();
        const origem = document.getElementById('kbx-origem').value;
        const prio = document.getElementById('kbx-prio').value;
        return LEADS.filter(l => {
            if (origem && l.origem !== origem) return false;
            if (prio && l.prioridade !== prio) return false;
            if (search && !(l.name + ' ' + l.phone + ' ' + (l.city || '')).toLowerCase().includes(search)) return false;
            return true;
        });
    }

    function cardHtml(l) {
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

    await refresh();
    return {};
}

export async function destroy() {}
