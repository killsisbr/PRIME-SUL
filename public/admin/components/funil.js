const STAGES = [
    { key: 'novo', label: 'NOVO', color: '#3b82f6', dark: false },
    { key: 'contato', label: 'EM CONTATO', color: '#ffbd16', dark: true },
    { key: 'confirmado', label: 'CONFIRMADO', color: '#ff7417', dark: false },
    { key: 'concluido', label: 'CONCLUÍDO', color: '#10b981', dark: false }
];

const TRANSITIONS = [
    { from: 'novo', to: 'contato', key: 'novo_contato' },
    { from: 'contato', to: 'confirmado', key: 'contato_confirmado' },
    { from: 'confirmado', to: 'concluido', key: 'confirmado_concluido' }
];

// larguras geométricas: cada estágio = (1 - 2*taper) do anterior → os trapézios se encaixam
const TAPER = 0.08;
const TAPER_PCT = (TAPER * 100).toFixed(1) + '%';

const nf = n => Number(n || 0).toLocaleString('pt-BR');

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
                    <div class="fl-seg" style="--t:${TAPER_PCT}; background:${color}; color:${txt};">
                        <span class="fl-seg-label">${s.label}</span>
                        <span class="fl-seg-count">${nf(count)}</span>
                        <span class="fl-seg-pct">${pct}% DO FUNIL</span>
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
            seg.addEventListener('click', () => selectStage(seg.dataset.stage));
        });
        document.querySelectorAll('.fl-detail-row').forEach(row => {
            row.addEventListener('click', () => selectStage(row.dataset.stage));
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

    function selectStage(key) {
        activeStage = activeStage === key ? null : key;
        document.querySelectorAll('.fl-seg-wrap, .fl-detail-row').forEach(el => {
            el.classList.toggle('active', el.dataset.stage === activeStage);
        });
    }

    function setText(id, v) {
        const el = document.getElementById(id);
        if (el) el.textContent = v;
    }

    document.getElementById('fl-refresh').onclick = load;
    await load();
    return {};
}

export async function destroy() {}
