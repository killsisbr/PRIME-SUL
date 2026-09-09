function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

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
        duration: 500,
        easing: 'easeOutExpo',
        update: () => {
            el.textContent = Math.round(obj.val).toLocaleString('pt-BR');
        }
    });
}

const FIRST_NAMES = ['Maria', 'João', 'Ana', 'Carlos', 'Fernanda', 'Roberto', 'Juliana', 'Lucas', 'Patricia', 'Thiago', 'Vanessa', 'Rodrigo', 'Camila', 'Diego', 'Bruna', 'Marcelo', 'Larissa', 'Gabriel', 'Aline', 'Rafael', 'Renata', 'Felipe', 'Mariana', 'Gustavo', 'Beatriz'];
const LAST_NAMES = ['Silva', 'Santos', 'Oliveira', 'Ferreira', 'Souza', 'Mendes', 'Costa', 'Ramos', 'Fonseca', 'Machado', 'Castro', 'Pinto', 'Nogueira', 'Freitas', 'Barbosa', 'Carvalho', 'Azevedo', 'Teixeira', 'Cardoso', 'Almeida', 'Duarte', 'Moraes'];
const CITIES = ['Porto Alegre', 'Caxias do Sul', 'Canoas', 'Pelotas', 'Novo Hamburgo', 'Santa Maria', 'São Leopoldo', 'Passo Fundo', 'Rio Grande', 'Gravataí', 'Viamão', 'Bento Gonçalves', 'Alvorada', 'Uruguaiana', 'Santa Cruz do Sul'];
const STAGES = ['novo', 'novo', 'novo', 'contato', 'contato', 'confirmado'];
const DAY_NAMES = { 1: 'SEGUNDA-FEIRA', 2: 'TERÇA-FEIRA', 3: 'QUARTA-FEIRA', 4: 'QUINTA-FEIRA', 5: 'SEXTA-FEIRA', 6: 'SÁBADO', 0: 'DOMINGO' };

const FALLBACK_LEADS = Array.from({ length: 50 }, (_, i) => {
    const fn = FIRST_NAMES[i % FIRST_NAMES.length];
    const ln1 = LAST_NAMES[(i * 3) % LAST_NAMES.length];
    const ln2 = LAST_NAMES[(i * 7) % LAST_NAMES.length];
    const city = CITIES[i % CITIES.length];
    const stage = STAGES[i % STAGES.length];
    const phoneNum = String(99100 + i * 137).slice(0, 5) + '-' + String(1000 + i * 43).slice(0, 4);
    return {
        id: 100 + i + 1,
        name: `${fn} ${ln1} ${ln2}`,
        phone: `(51) ${phoneNum}`,
        city: city,
        status: stage
    };
});

export async function init() {
    const api = window.api;
    const toast = window.toast;

    let templates = [];
    let selectedTmplId = 'new';
    let allCampaigns = [];
    let allLeads = [];
    let deselectedLeadIds = new Set();
    let alreadyScheduledLeadIds = new Set();
    let selectedQuantity = 10;
    let selectedDay = new Date().getDay(); // 0-6 (0=DOM, 1=SEG...)
    let _dispViewMode = 'track'; // 'track' | 'agenda'
    let _dispAgendaPeriod = '7d'; // '7d' | '15d' | '30d'
    let _dispAgendaAnchor = new Date();

    function startOfWeek(d) {
        const res = new Date(d);
        const day = res.getDay();
        const diff = res.getDate() - day + (day === 0 ? -6 : 1);
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

    function esc(s) { return escapeHtml(s); }
    function initials(n) { return (n || ' ').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase(); }

    function getCampDay(c) {
        if (!c || !c.scheduled_at) return new Date().getDay();
        const d = new Date(c.scheduled_at.replace(' ', 'T'));
        return isNaN(d.getTime()) ? new Date().getDay() : d.getDay();
    }

    function getFilteredCampaigns() {
        return allCampaigns.filter(c => getCampDay(c) === selectedDay);
    }

    function timeToPct(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        const mins = (h || 0) * 60 + (m || 0);
        const startCom = 8 * 60; // 480 min (08:00)
        const endCom = 18 * 60;  // 1080 min (18:00)
        return Math.min(100, Math.max(0, ((mins - startCom) / (endCom - startCom)) * 100));
    }

    function pctToTime(pct) {
        const startCom = 8 * 60;
        const totalMins = startCom + Math.round((pct / 100) * 600);
        const h = Math.min(18, Math.max(8, Math.floor(totalMins / 60)));
        const m = Math.min(59, Math.max(0, totalMins % 60));
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    function extractCampaignTargetCount(c) {
        if (!c) return 10;
        const match = (c.name || '').match(/\((\d+)\s*leads/i);
        if (match && match[1]) {
            return Number(match[1]);
        }
        if (c.filters) {
            try {
                const f = typeof c.filters === 'string' ? JSON.parse(c.filters) : c.filters;
                if (f && f.limit) return Number(f.limit);
            } catch (e) {}
        }
        return c.total_target || 10;
    }

    function updateNowPin() {
        const pin = document.getElementById('dpNowPin');
        if (!pin) return;
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const pct = timeToPct(timeStr);
        pin.style.left = `${pct}%`;
        pin.style.display = (now.getHours() >= 8 && now.getHours() <= 18 && selectedDay === now.getDay()) ? 'flex' : 'none';
    }

    function updateDaySelectionUI() {
        document.querySelectorAll('.dp-day-btn').forEach(btn => {
            const bDay = Number(btn.dataset.day);
            btn.classList.toggle('active', bDay === selectedDay);
        });

        const labelEl = document.getElementById('dp-24h-sub');
        if (labelEl) {
            labelEl.innerHTML = `<i class="fas fa-eye"></i> VISUALIZANDO AGENDAMENTOS DE: <b>${DAY_NAMES[selectedDay] || 'HOJE'}</b>`;
        }

        updateNowPin();
        if (_dispViewMode === 'agenda') {
            renderDispAgenda();
        } else {
            renderScheduledTimelineBlocks();
        }
        renderCategoryCards();
    }

    async function loadData() {
        try {
            const data = await api('/campaigns').catch(() => ({ campaigns: [] }));
            allCampaigns = data.campaigns || [];
            
            const total = allCampaigns.length;
            const sent = allCampaigns.reduce((a, c) => a + (c.total_sent || 0), 0);
            const fail = allCampaigns.reduce((a, c) => a + (c.falhou || 0), 0);

            animateCounter('dp-metric-total', total);
            animateCounter('dp-metric-sent', sent);
            animateCounter('dp-metric-fail', fail);

            const metaPct = Math.min(100, Math.round((sent / 100) * 100));
            const fill = document.getElementById('dp-meta-fill');
            const pctEl = document.getElementById('dp-meta-pct');
            if (fill) fill.style.width = `${metaPct}%`;
            if (pctEl) pctEl.textContent = `${metaPct}%`;

            updateDaySelectionUI();
        } catch (e) {}
    }

    // Desenha os blocos da régua 08:00 - 18:00 com filtro do dia selecionado
    function renderScheduledTimelineBlocks() {
        const container = document.getElementById('dpScheduledBlocksContainer');
        if (!container) return;

        const activeCampaigns = getFilteredCampaigns();

        if (!activeCampaigns.length) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = activeCampaigns.map(c => {
            let startStr = '10:00';
            if (c.scheduled_at) {
                const d = new Date(c.scheduled_at.replace(' ', 'T'));
                if (!isNaN(d.getTime())) {
                    startStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                }
            }

            const targetCount = extractCampaignTargetCount(c);
            const cadenceSec = 30; // 30s por lead de cadência padrão
            const durationMin = Math.max(1, Math.ceil((targetCount * cadenceSec) / 60));

            const [startH, startM] = startStr.split(':').map(Number);
            const startTotalMin = startH * 60 + startM;
            const endTotalMin = startTotalMin + durationMin;
            const endH = String(Math.floor(endTotalMin / 60)).padStart(2, '0');
            const endM = String(endTotalMin % 60).padStart(2, '0');
            const endStr = `${endH}:${endM}`;

            const startPct = timeToPct(startStr);
            const durationPct = Math.max(0.8, (durationMin / 600) * 100);

            return `
            <div class="dp-sched-block-bar" style="left:${startPct}%; width:${durationPct}%;" data-id="${c.id}" title="${esc(c.name)} (${startStr} às ${endStr})">
                <span class="dp-block-mini-label"><i class="fas fa-bolt"></i> ${targetCount}</span>
                <div class="dp-sched-block-pill">
                    <b><i class="fas fa-rocket"></i> ${esc(c.name)}</b>
                    <small>${startStr} às ${endStr} • <i class="fas fa-users"></i> ${targetCount} leads</small>
                </div>
            </div>`;
        }).join('');

        container.querySelectorAll('.dp-sched-block-bar').forEach(block => {
            block.onclick = (e) => {
                e.stopPropagation();
                const id = block.dataset.id;
                const c = allCampaigns.find(x => String(x.id) === String(id));
                if (c) {
                    openScheduleModal('10:00', 'novo', c);
                }
            };
        });
    }

    function switchDispView(mode) {
        _dispViewMode = mode;
        const btnTrack = document.getElementById('dpBtnModeTrack');
        const btnAgenda = document.getElementById('dpBtnModeAgenda');
        const trackContainer = document.getElementById('dp24hBarContainer');
        const agendaContainer = document.getElementById('dpAgendaViewContainer');

        if (mode === 'agenda') {
            btnAgenda?.classList.add('active');
            btnTrack?.classList.remove('active');
            if (trackContainer) trackContainer.style.display = 'none';
            if (agendaContainer) agendaContainer.style.display = 'flex';
            renderDispAgenda();
        } else {
            btnTrack?.classList.add('active');
            btnAgenda?.classList.remove('active');
            if (trackContainer) trackContainer.style.display = 'flex';
            if (agendaContainer) agendaContainer.style.display = 'none';
            updateDaySelectionUI();
        }
    }

    function getDispAgendaDays() {
        const days = [];
        if (_dispAgendaPeriod === '7d') {
            const monday = startOfWeek(_dispAgendaAnchor);
            for (let i = 0; i < 7; i++) {
                days.push(addDays(monday, i));
            }
        } else if (_dispAgendaPeriod === '15d') {
            const start = addDays(_dispAgendaAnchor, -7);
            for (let i = 0; i < 15; i++) {
                days.push(addDays(start, i));
            }
        } else if (_dispAgendaPeriod === '30d') {
            const y = _dispAgendaAnchor.getFullYear();
            const m = _dispAgendaAnchor.getMonth();
            const last = new Date(y, m + 1, 0);
            for (let d = 1; d <= last.getDate(); d++) {
                days.push(new Date(y, m, d));
            }
        }
        return days;
    }

    function renderDispAgenda() {
        const container = document.getElementById('dpAgendaGrid');
        if (!container) return;

        const days = getDispAgendaDays();

        // Atualiza texto da faixa de datas
        const rangeText = document.getElementById('dpAgRangeText');
        if (rangeText && days.length) {
            const d1 = days[0];
            const d2 = days[days.length - 1];
            if (_dispAgendaPeriod === '30d') {
                rangeText.textContent = d1.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
            } else {
                const f1 = d1.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase().replace('.', '');
                const f2 = d2.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace('.', '');
                rangeText.textContent = `${f1} — ${f2}`;
            }
        }

        const todayKey = dayKey(new Date());
        const gridClass = _dispAgendaPeriod === '7d' ? 'grid-7d' : (_dispAgendaPeriod === '15d' ? 'grid-15d' : 'grid-30d');

        container.className = `dp-agenda-grid ${gridClass}`;

        container.innerHTML = days.map(d => {
            const k = dayKey(d);
            const isToday = k === todayKey;
            const dayOfWeek = d.getDay();
            const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' }).toUpperCase().replace('.', '');
            const dayNum = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase().replace('.', '');

            const dayCamps = allCampaigns.filter(c => {
                if (c.scheduled_at) {
                    const cDate = new Date(c.scheduled_at.replace(' ', 'T'));
                    if (dayKey(cDate) === k) return true;
                }
                return getCampDay(c) === dayOfWeek;
            });

            const maxVisible = _dispAgendaPeriod === '7d' ? 4 : 2;
            const visible = dayCamps.slice(0, maxVisible);
            const remaining = dayCamps.length - maxVisible;

            let campsHtml = '';
            if (visible.length) {
                campsHtml = visible.map(c => {
                    let timeStr = '10:00';
                    if (c.scheduled_at) {
                        const cd = new Date(c.scheduled_at.replace(' ', 'T'));
                        if (!isNaN(cd.getTime())) {
                            timeStr = `${String(cd.getHours()).padStart(2, '0')}:${String(cd.getMinutes()).padStart(2, '0')}`;
                        }
                    }
                    const total = extractCampaignTargetCount(c);
                    const sent = c.total_sent || 0;
                    const status = c.status || 'draft';
                    return `
                        <div class="dp-ag-camp-card ${status}" data-camp-id="${c.id}" title="Clique para detalhes">
                            <div class="dp-ag-camp-time">
                                <span><i class="far fa-clock"></i> ${timeStr}</span>
                                <span>${sent}/${total}</span>
                            </div>
                            <div class="dp-ag-camp-title">${esc(c.name || 'Campanha')}</div>
                            <div class="dp-ag-camp-sub">${esc(status.toUpperCase())}</div>
                        </div>
                    `;
                }).join('');

                if (remaining > 0) {
                    campsHtml += `<div style="font-size:0.6rem; color:var(--holo-muted, #94a3b8); text-align:center; padding:3px 0;">+ ${remaining} disparos</div>`;
                }
            } else {
                campsHtml = `<div class="dp-ag-empty-day"><i class="far fa-calendar-check"></i> Sem disparos</div>`;
            }

            return `
                <div class="dp-ag-day-col ${isToday ? 'is-today' : ''}" data-day-key="${k}" data-weekday="${dayOfWeek}">
                    <div class="dp-ag-day-header">
                        <div>
                            <span class="dp-ag-day-name">${dayName}</span>
                            <span class="dp-ag-day-num">${dayNum}</span>
                        </div>
                        ${isToday ? '<span class="dp-ag-today-badge">HOJE</span>' : ''}
                    </div>
                    <div class="dp-ag-camps-list">
                        ${campsHtml}
                    </div>
                    <button type="button" class="dp-ag-btn-schedule-day" data-weekday="${dayOfWeek}" data-day-key="${k}">
                        <i class="fas fa-plus"></i> Agendar
                    </button>
                </div>
            `;
        }).join('');

        // Clicks nos botões de agendar dentro dos dias da agenda
        container.querySelectorAll('.dp-ag-btn-schedule-day').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const weekday = Number(btn.dataset.weekday);
                selectedDay = weekday;
                updateDaySelectionUI();
                openScheduleModal('10:00', 'novo');
            };
        });

        // Click no card de campanha da agenda
        container.querySelectorAll('.dp-ag-camp-card').forEach(card => {
            card.onclick = (e) => {
                e.stopPropagation();
                const campId = card.dataset.campId;
                const c = allCampaigns.find(x => String(x.id) === String(campId));
                if (c) {
                    openScheduleModal('10:00', 'novo', c);
                }
            };
        });

        // Click na coluna do dia para focar aquele dia
        container.querySelectorAll('.dp-ag-day-col').forEach(col => {
            col.onclick = () => {
                const weekday = Number(col.dataset.weekday);
                selectedDay = weekday;
                updateDaySelectionUI();
            };
        });
    }

    // Renderiza a lista única de disparos do dia selecionado
    function renderCategoryCards() {
        const targetEl = document.getElementById('dpSingleDispatchesList');
        const countBadge = document.getElementById('dpDispatchesCountBadge');

        const activeCampaigns = getFilteredCampaigns();

        if (countBadge) {
            countBadge.textContent = `${activeCampaigns.length} AGENDADO${activeCampaigns.length === 1 ? '' : 'S'}`;
        }

        if (!targetEl) return;

        if (!activeCampaigns.length) {
            targetEl.innerHTML = `
                <div class="dp-cat-empty" style="padding:16px 0;">
                    <i class="far fa-calendar-alt" style="font-size:1.8rem;"></i>
                    <span style="font-size:.76rem;">NENHUM DISPARO AGENDADO PARA ${DAY_NAMES[selectedDay] || 'ESTE DIA'}</span>
                    <button type="button" class="dp-saas-btn prim dp-btn-schedule-trigger" data-stage="novo" style="margin-top:6px;">
                        <i class="fas fa-plus"></i> + AGENDAR NOVO DISPARO
                    </button>
                </div>`;
        } else {
            targetEl.innerHTML = activeCampaigns.map(c => {
                let timeStr = '10:00';
                if (c.scheduled_at) {
                    const d = new Date(c.scheduled_at.replace(' ', 'T'));
                    if (!isNaN(d.getTime())) {
                        timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                    }
                }

                const total = extractCampaignTargetCount(c);
                const sent = c.total_sent || 0;
                const sentPct = Math.min(100, Math.round((sent / total) * 100));

                const cadenceSec = 30; // 30s por lead
                const durationMin = Math.max(1, Math.ceil((total * cadenceSec) / 60));

                const [startH, startM] = timeStr.split(':').map(Number);
                const startTotalMin = (startH || 0) * 60 + (startM || 0);
                const endTotalMin = startTotalMin + durationMin;
                const endH = String(Math.floor(endTotalMin / 60)).padStart(2, '0');
                const endM = String(endTotalMin % 60).padStart(2, '0');
                const endStr = `${endH}:${endM}`;

                const status = c.status || 'draft';
                let statusBadge = `<span class="dp-camp-status-badge draft"><i class="fas fa-clock"></i> AGENDADO</span>`;
                if (status === 'running') statusBadge = `<span class="dp-camp-status-badge running"><i class="fas fa-spinner fa-spin"></i> EM ANDAMENTO</span>`;
                else if (status === 'paused') statusBadge = `<span class="dp-camp-status-badge paused"><i class="fas fa-pause"></i> PAUSADO</span>`;
                else if (status === 'done') statusBadge = `<span class="dp-camp-status-badge done"><i class="fas fa-circle-check"></i> CONCLUÍDO</span>`;
                else if (status === 'cancelled') statusBadge = `<span class="dp-camp-status-badge cancelled"><i class="fas fa-ban"></i> CANCELADO</span>`;

                return `
                <div class="dp-cat-camp-item" data-id="${c.id}" style="margin-bottom:10px; cursor:pointer;" title="Clique em qualquer lugar para abrir a ficha de disparo (${timeStr} às ${endStr})">
                    <div class="dp-camp-item-head" style="align-items:center;">
                        <strong class="dp-camp-card-title" data-id="${c.id}"><i class="fas fa-rocket"></i> ${esc(c.name)}</strong>
                        ${statusBadge}
                        <span class="dp-camp-time-tag" style="margin-left:auto;"><i class="far fa-clock"></i> ${timeStr} às ${endStr}</span>
                    </div>
                    <div class="dp-camp-item-progress" style="margin-top:6px;">
                        <div class="dp-camp-mini-bar"><div class="dp-camp-mini-fill" style="width:${sentPct}%"></div></div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                            <small>${sent} / ${total} enviados • <i class="fas fa-stopwatch"></i> ~${durationMin} min</small>
                            <div class="dp-camp-ctrl-group" data-id="${c.id}">
                                ${status !== 'running' && status !== 'done' ? `<button type="button" class="dp-ctrl-btn play" data-act="start" title="Iniciar / Retomar envio"><i class="fas fa-play"></i> INICIAR</button>` : ''}
                                ${status === 'running' ? `<button type="button" class="dp-ctrl-btn pause" data-act="pause" title="Pausar disparo"><i class="fas fa-pause"></i> PAUSAR</button>` : ''}
                                ${status === 'running' || status === 'paused' ? `<button type="button" class="dp-ctrl-btn stop" data-act="cancel" title="Cancelar disparo"><i class="fas fa-stop"></i> PARAR</button>` : ''}
                                <button type="button" class="dp-ctrl-btn reset" data-act="reset" title="Reiniciar do zero"><i class="fas fa-rotate-right"></i> REINICIAR</button>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('') + `
            <div style="display:flex; justify-content:center; margin-top:10px;">
                <button type="button" class="dp-saas-btn prim dp-btn-schedule-trigger" data-stage="novo">
                    <i class="fas fa-plus"></i> + AGENDAR NOVO DISPARO
                </button>
            </div>`;
        }

        targetEl.querySelectorAll('.dp-cat-camp-item').forEach(card => {
            card.onclick = (e) => {
                if (e.target.closest('.dp-ctrl-btn')) return;
                const id = card.dataset.id;
                const c = allCampaigns.find(x => String(x.id) === String(id));
                if (c) openScheduleModal('10:00', 'novo', c);
            };
        });

        targetEl.querySelectorAll('.dp-ctrl-btn').forEach(btn => {
            btn.onclick = async (e) => {
                e.stopPropagation();
                const group = btn.closest('.dp-camp-ctrl-group');
                const campaignId = group?.dataset.id;
                const action = btn.dataset.act;
                if (!campaignId || !action) return;

                btn.disabled = true;
                try {
                    if (action === 'start') {
                        await api(`/campaigns/${campaignId}/start`, { method: 'POST' });
                        toast('Disparo iniciado em segundo plano!', 'ok');
                    } else if (action === 'pause') {
                        await api(`/campaigns/${campaignId}/pause`, { method: 'POST' });
                        toast('Disparo pausado', 'ok');
                    } else if (action === 'cancel') {
                        if (!confirm('Deseja realmente cancelar este disparo?')) return;
                        await api(`/campaigns/${campaignId}/cancel`, { method: 'POST' });
                        toast('Disparo cancelado', 'ok');
                    } else if (action === 'reset') {
                        if (!confirm('Deseja zerar e reiniciar este disparo do início?')) return;
                        await api(`/campaigns/${campaignId}/reset`, { method: 'POST' });
                        toast('Disparo reiniciado com sucesso!', 'ok');
                    }
                    await loadData();
                } catch (err) {
                    toast(err.message || 'Erro ao executar ação', 'err');
                } finally {
                    btn.disabled = false;
                }
            };
        });

        targetEl.querySelectorAll('.dp-btn-schedule-trigger').forEach(btn => {
            btn.onclick = () => {
                openScheduleModal('10:00', 'novo');
            };
        });
    }

    // ================= MODAL DE AGENDAMENTO COM SELEÇÃO E EDICÃO DE DISPAROS =================
    function getSelectedStages() {
        const stages = [];
        document.querySelectorAll('.dp-stage-cb:checked').forEach(cb => stages.push(cb.value));
        return stages.length ? stages : ['novo'];
    }

    async function loadLeadsForSchedule() {
        const container = document.getElementById('dpSchedTargetGrid');
        if (container) container.innerHTML = '<div class="dp-loading"><i class="fas fa-spinner fa-spin"></i> Carregando alvos...</div>';

        try {
            const stages = getSelectedStages();
            
            // Busca IDs de todos os leads que JÁ estão agendados em disparos ativos
            const schedRes = await api('/sends/scheduled-lead-ids').catch(() => ({ scheduled_lead_ids: [] }));
            alreadyScheduledLeadIds = new Set(schedRes.scheduled_lead_ids || []);

            const res = await api('/leads?limit=300').catch(() => []);
            let leads = Array.isArray(res) ? res : (res.leads || []);

            if (!leads.length) leads = FALLBACK_LEADS;

            allLeads = leads.filter(l => stages.includes(l.status || 'novo'));
            if (!allLeads.length) {
                allLeads = FALLBACK_LEADS.filter(l => stages.includes(l.status || 'novo'));
            }
            if (!allLeads.length) allLeads = FALLBACK_LEADS;

            renderSchedTargetLeads();
        } catch (e) {
            allLeads = FALLBACK_LEADS;
            renderSchedTargetLeads();
        }
    }

    function renderSchedTargetLeads() {
        const container = document.getElementById('dpSchedTargetGrid');
        const countVal = document.getElementById('dpSchedCountVal');
        const durationBadge = document.getElementById('dpSchedDurationBadge');

        if (!container) return;

        const currentCampaignId = document.getElementById('dpSchedCampaignId')?.value;

        // Filtra os candidatos ignorando leads que JÁ foram agendados em outros disparos
        const candidatePool = allLeads.filter(l => {
            if (deselectedLeadIds.has(l.id)) return false;
            if (!currentCampaignId && alreadyScheduledLeadIds.has(l.id)) return false;
            return true;
        });

        const activeTargets = candidatePool.slice(0, selectedQuantity);

        if (countVal) countVal.textContent = activeTargets.length;

        const cadenceSec = Number(document.getElementById('dpSchedCadence')?.value || 30);
        const totalDurationMin = Math.max(1, Math.ceil((activeTargets.length * cadenceSec) / 60));

        if (durationBadge) {
            durationBadge.innerHTML = `<i class="fas fa-stopwatch"></i> DURAÇÃO ESTIMADA: ~${totalDurationMin} MIN`;
        }

        checkTimeCollision(totalDurationMin);

        if (activeTargets.length) {
            const first = activeTargets[0];
            const nameEl = document.getElementById('dpLivePreviewContactName');
            if (nameEl) nameEl.textContent = first.name || 'Maria Silva';
        }
        updateLivePreview();
        updateSubmitBtnText();

        if (!activeTargets.length) {
            container.innerHTML = '<div class="dp-loading"><i class="fas fa-triangle-exclamation"></i> Nenhum lead disponível! Todos os leads desta etapa já foram agendados em outros disparos.</div>';
            return;
        }

        container.innerHTML = activeTargets.map((l, index) => `
            <div class="dp-lead-row-card" data-id="${l.id}">
                <div class="dp-lead-left">
                    <span class="dp-lead-av-circle">${esc(initials(l.name))}</span>
                    <div class="dp-lead-row-meta">
                        <strong>${index + 1}. ${esc(l.name)}</strong>
                        <small>${esc(l.phone)}${l.city ? ' • ' + esc(l.city) : ''}</small>
                    </div>
                </div>
                <span class="dp-lead-stage-pill">${esc((l.status || 'NOVO').toUpperCase())}</span>
                <div class="dp-lead-actions-group">
                    <button type="button" class="dp-lead-act-btn sub" data-action="sub" data-id="${l.id}" title="Substituir por outro lead da fila">
                        <i class="fas fa-rotate"></i>
                    </button>
                    <button type="button" class="dp-lead-act-btn del" data-action="del" data-id="${l.id}" title="Remover lead do disparo">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>`).join('');

        container.querySelectorAll('.dp-lead-act-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const leadId = Number(btn.dataset.id);
                const action = btn.dataset.action;

                if (action === 'del') {
                    deselectedLeadIds.add(leadId);
                    toast('Lead removido do disparo', 'ok');
                    renderSchedTargetLeads();
                } else if (action === 'sub') {
                    deselectedLeadIds.add(leadId);
                    toast('Lead substituído pelo próximo da fila', 'ok');
                    renderSchedTargetLeads();
                }
            };
        });
    }

    function checkTimeCollision(durationMin) {
        const campaignId = document.getElementById('dpSchedCampaignId')?.value;
        const timeInput = document.getElementById('dpSchedTime')?.value || '10:00';
        const [h, m] = timeInput.split(':').map(Number);
        const startMin = (h || 0) * 60 + (m || 0);
        const endMin = startMin + durationMin;

        let hasCollision = false;
        let collidingName = '';

        for (const c of getFilteredCampaigns()) {
            if (campaignId && String(c.id) === String(campaignId)) continue;
            if (!c.scheduled_at) continue;
            const d = new Date(c.scheduled_at.replace(' ', 'T'));
            if (isNaN(d.getTime())) continue;
            const cStartMin = d.getHours() * 60 + d.getMinutes();
            const targetCount = extractCampaignTargetCount(c);
            const cDurationMin = Math.ceil((targetCount * 30) / 60);
            const cEndMin = cStartMin + cDurationMin;

            if (startMin < cEndMin && endMin > cStartMin) {
                hasCollision = true;
                collidingName = c.name;
                break;
            }
        }

        const alertBox = document.getElementById('dpCollisionAlert');
        const alertText = document.getElementById('dpCollisionText');
        const submitBtn = document.getElementById('dpSchedSubmitBtn');

        if (hasCollision && alertBox && alertText && submitBtn) {
            alertBox.style.display = 'flex';
            alertText.textContent = `Já existe o disparo "${collidingName}" agendado nesse horário. Escolha outro intervalo para evitar banimento!`;
            submitBtn.disabled = true;
        } else if (alertBox && submitBtn) {
            alertBox.style.display = 'none';
            submitBtn.disabled = false;
        }
    }

    async function openScheduleModal(initialTimeStr = '10:00', targetStage = 'novo', campaignToEdit = null) {
        const modal = document.getElementById('dpScheduleModal');
        if (!modal) return;

        const idInput = document.getElementById('dpSchedCampaignId');
        const timeInput = document.getElementById('dpSchedTime');
        const titleEl = document.getElementById('dpSchedModalTitle');
        const msgArea = document.getElementById('dpSchedMessage');
        const delBtn = document.getElementById('dpSchedDeleteBtn');
        const rangeInput = document.getElementById('dpSchedRange');

        deselectedLeadIds.clear();

        if (campaignToEdit) {
            if (idInput) idInput.value = campaignToEdit.id;
            if (titleEl) titleEl.textContent = `EDITAR DISPARO: "${campaignToEdit.name.toUpperCase()}"`;
            
            let timeStr = initialTimeStr;
            if (campaignToEdit.scheduled_at) {
                const d = new Date(campaignToEdit.scheduled_at.replace(' ', 'T'));
                if (!isNaN(d.getTime())) {
                    timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                }
            }
            if (timeInput) timeInput.value = timeStr;
            if (msgArea) msgArea.value = campaignToEdit.message || '';
            
            selectedQuantity = extractCampaignTargetCount(campaignToEdit);
            if (rangeInput) rangeInput.value = selectedQuantity;

            document.querySelectorAll('.dp-preset-btn').forEach(b => {
                b.classList.toggle('active', Number(b.dataset.val) === selectedQuantity);
            });

            if (delBtn) delBtn.style.display = 'inline-flex';
            setDispatchMode('schedule');
        } else {
            if (idInput) idInput.value = '';
            if (titleEl) titleEl.textContent = 'DISPARAR MENSAGENS NO WHATSAPP';
            if (timeInput) timeInput.value = initialTimeStr;
            if (msgArea) msgArea.value = 'Olá {nome}! Vi que solicitou uma simulação de crédito. Posso te enviar as propostas agora?';
            
            selectedQuantity = 10;
            if (rangeInput) rangeInput.value = 10;

            document.querySelectorAll('.dp-preset-btn').forEach(b => {
                b.classList.toggle('active', Number(b.dataset.val) === 10);
            });

            if (delBtn) delBtn.style.display = 'none';
            setDispatchMode('now');
        }

        document.querySelectorAll('.dp-stage-cb').forEach(cb => {
            const isSelected = cb.value === targetStage;
            cb.checked = isSelected;
            cb.closest('.dp-stage-pill')?.classList.toggle('active', isSelected);
        });

        const tmplSelect = document.getElementById('dpSchedTemplateSelect');
        if (tmplSelect) {
            tmplSelect.innerHTML = '<option value="">Escolher Modelo Comercial Pronto...</option>' +
                templates.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
        }

        modal.style.display = 'flex';
        await loadLeadsForSchedule();
        updateLivePreview();
        updateSubmitBtnText();
    }

    function closeScheduleModal() {
        const modal = document.getElementById('dpScheduleModal');
        if (modal) modal.style.display = 'none';
    }

    document.getElementById('dpSchedDeleteBtn')?.addEventListener('click', async () => {
        const campaignId = document.getElementById('dpSchedCampaignId')?.value;
        if (!campaignId) return;
        if (!confirm('Deseja excluir este disparo agendado permanentemente?')) return;

        try {
            await api(`/campaigns/${campaignId}`, { method: 'DELETE' });
            toast('Disparo excluído com sucesso!', 'ok');
            closeScheduleModal();
            await loadData();
        } catch (e) {
            toast(e.message || 'Erro ao excluir disparo', 'err');
        }
    });

    // ================= SUBPOPUP: GERENCIADOR DE TEMPLATES =================
    async function loadTemplates() {
        try {
            const res = await api('/templates').catch(() => []);
            templates = Array.isArray(res) ? res : [];
            renderTmplStrip();
        } catch (e) {}
    }

    function renderTmplStrip() {
        const strip = document.getElementById('dpTmplListStrip');
        if (!strip) return;

        let html = `
            <button type="button" class="dp-tmpl-chip-btn ${selectedTmplId === 'new' ? 'active' : ''}" data-tmpl-id="new">
                <i class="fas fa-plus"></i> + Criar Novo
            </button>`;

        templates.forEach(t => {
            const isActive = String(t.id) === String(selectedTmplId) ? 'active' : '';
            html += `
            <button type="button" class="dp-tmpl-chip-btn ${isActive}" data-tmpl-id="${t.id}">
                ${esc(t.name)}
            </button>`;
        });

        strip.innerHTML = html;

        strip.querySelectorAll('.dp-tmpl-chip-btn').forEach(btn => {
            btn.onclick = () => {
                selectedTmplId = btn.dataset.tmplId;
                renderTmplStrip();
                populateTmplForm();
            };
        });
    }

    function populateTmplForm() {
        const idInput = document.getElementById('dpTmplId');
        const nameInput = document.getElementById('dpTmplName');
        const bodyInput = document.getElementById('dpTmplBody');
        const delBtn = document.getElementById('dpTmplDeleteBtn');
        const titleEl = document.getElementById('dpTmplModalTitle');

        if (selectedTmplId === 'new') {
            if (idInput) idInput.value = '';
            if (nameInput) nameInput.value = '';
            if (bodyInput) bodyInput.value = 'Olá {nome}! Vi que solicitou uma simulação de crédito. Posso te enviar a proposta agora?';
            if (delBtn) delBtn.style.display = 'none';
            if (titleEl) titleEl.textContent = 'CRIAR NOVO TEMPLATE DO WHATSAPP';
        } else {
            const t = templates.find(x => String(x.id) === String(selectedTmplId));
            if (t) {
                if (idInput) idInput.value = t.id;
                if (nameInput) nameInput.value = t.name || '';
                if (bodyInput) bodyInput.value = t.body || t.text || '';
                if (delBtn) delBtn.style.display = 'inline-flex';
                if (titleEl) titleEl.textContent = `EDITAR TEMPLATE: ${t.name}`;
            }
        }
        updateTmplPreview();
    }

    function updateTmplPreview() {
        const body = (document.getElementById('dpTmplBody')?.value || '').trim();
        const prevTextEl = document.getElementById('dp-tmpl-preview-text');
        if (!prevTextEl) return;

        if (body) {
            prevTextEl.textContent = body.replace(/\{nome\}/g, 'Maria');
        } else {
            prevTextEl.textContent = 'Olá Maria! Vi que solicitou uma simulação de crédito. Posso te enviar a proposta agora?';
        }
    }

    async function openTemplateManagerModal(forceNew = false) {
        const modal = document.getElementById('dpTemplateModal');
        if (!modal) return;
        
        await loadTemplates();

        if (forceNew || !templates.length) {
            selectedTmplId = 'new';
        } else {
            selectedTmplId = templates[0].id;
        }

        modal.style.display = 'flex';
        renderTmplStrip();
        populateTmplForm();
    }

    function closeTemplateManagerModal() {
        const modal = document.getElementById('dpTemplateModal');
        if (modal) modal.style.display = 'none';
    }

    // ================= LISTENERS E EVENTOS DA RÉGUA INTERATIVA =================
    const track = document.getElementById('dp24hTrack');
    const hoverPin = document.getElementById('dpHoverTimePin');
    const hoverBadge = document.getElementById('dpHoverTimeBadge');

    if (track && hoverPin && hoverBadge) {
        track.addEventListener('mousemove', (e) => {
            const rect = track.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = Math.min(100, Math.max(0, (clickX / rect.width) * 100));
            const hoverTime = pctToTime(pct);

            hoverPin.style.left = `${pct}%`;
            hoverPin.style.display = 'flex';
            hoverBadge.textContent = `${hoverTime} • Agendar`;
        });

        track.addEventListener('mouseleave', () => {
            hoverPin.style.display = 'none';
        });

        track.addEventListener('click', (e) => {
            if (e.target.closest('.dp-sched-block-bar')) return;
            const rect = track.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = Math.min(100, Math.max(0, (clickX / rect.width) * 100));
            const clickTime = pctToTime(pct);

            toast(`Horário selecionado: ${clickTime}. Abrindo agendador...`, 'ok');
            openScheduleModal(clickTime, 'novo', null);
        });
    }

    // Listeners dos botões de dia da semana (SEG, TER, QUA, QUI, SEX, SÁB, DOM)
    document.querySelectorAll('.dp-day-btn').forEach(btn => {
        btn.onclick = () => {
            selectedDay = Number(btn.dataset.day);
            updateDaySelectionUI();
        };
    });

    // Slider Hero de Quantidade
    const schedRange = document.getElementById('dpSchedRange');
    if (schedRange) {
        schedRange.oninput = (e) => {
            selectedQuantity = Number(e.target.value);
            document.querySelectorAll('.dp-preset-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.val) === selectedQuantity));
            renderSchedTargetLeads();
        };
    }

    // Botões de Preset (5, 10, 25, 50, 100)
    document.querySelectorAll('.dp-preset-btn').forEach(btn => {
        btn.onclick = () => {
            selectedQuantity = Number(btn.dataset.val);
            if (schedRange) schedRange.value = selectedQuantity;
            document.querySelectorAll('.dp-preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderSchedTargetLeads();
        };
    });

    // Chips de Filtro por Etapa
    document.querySelectorAll('.dp-stage-cb').forEach(cb => {
        cb.onchange = () => {
            cb.parentElement.classList.toggle('active', cb.checked);
            deselectedLeadIds.clear();
            loadLeadsForSchedule();
        };
    });

    document.querySelectorAll('.dp-chip-stage, .dp-stage-chip-neon').forEach(chip => {
        chip.onclick = (e) => {
            const cb = chip.querySelector('input');
            if (cb && e.target !== cb) {
                cb.checked = !cb.checked;
                chip.classList.toggle('active', cb.checked);
                deselectedLeadIds.clear();
                loadLeadsForSchedule();
            }
        };
    });

    // ================= ENRIQUECIMENTO MODAL DE DISPARO =================
    let _dispatchMode = 'now'; // 'now' | 'schedule'

    function setDispatchMode(mode) {
        _dispatchMode = mode;
        const btnModeNow = document.getElementById('dpBtnModeNow');
        const btnModeSched = document.getElementById('dpBtnModeSchedule');
        const timeBox = document.getElementById('dpScheduleTimeBox');

        if (btnModeNow) btnModeNow.classList.toggle('active', mode === 'now');
        if (btnModeSched) btnModeSched.classList.toggle('active', mode === 'schedule');
        if (timeBox) timeBox.style.display = (mode === 'schedule') ? 'block' : 'none';
        updateSubmitBtnText();
    }

    function updateSubmitBtnText() {
        const submitBtn = document.getElementById('dpSchedSubmitBtn');
        const campaignId = document.getElementById('dpSchedCampaignId')?.value;
        if (!submitBtn) return;
        if (campaignId) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> SALVAR ALTERAÇÕES';
            return;
        }
        if (_dispatchMode === 'now') {
            submitBtn.innerHTML = `<i class="fas fa-bolt"></i> DISPARAR ${selectedQuantity} MENSAGENS AGORA`;
        } else {
            submitBtn.innerHTML = `<i class="fas fa-calendar-check"></i> CONFIRMAR AGENDAMENTO (${selectedQuantity} LEADS)`;
        }
    }

    function updateLivePreview() {
        const msgArea = document.getElementById('dpSchedMessage');
        const previewEl = document.getElementById('dpLivePreviewMessage');
        const charCountEl = document.getElementById('dpCharCount');
        const contactNameEl = document.getElementById('dpLivePreviewContactName');
        const msgTimeEl = document.getElementById('dpLiveMsgTime');

        const raw = (msgArea?.value || '').trim() || 'Olá {nome}! Vi que você solicitou uma simulação de crédito. Posso te enviar as propostas agora?';
        
        if (charCountEl) {
            charCountEl.textContent = `${(msgArea?.value || '').length} carac.`;
        }

        const firstLead = (typeof allLeads !== 'undefined' && allLeads.length) ? allLeads[0] : null;
        const firstName = firstLead?.name ? firstLead.name.split(' ')[0] : 'Maria';
        const fullName = firstLead?.name || 'Maria Silva';
        const city = firstLead?.city || 'Porto Alegre';
        const renda = firstLead?.renda ? `R$ ${Number(firstLead.renda).toLocaleString('pt-BR')}` : 'R$ 3.500';

        if (contactNameEl) {
            contactNameEl.textContent = fullName;
        }

        let rendered = raw
            .replace(/\{nome\}/gi, firstName)
            .replace(/\{cidade\}/gi, city)
            .replace(/\{renda\}/gi, renda);

        if (previewEl) {
            previewEl.innerHTML = esc(rendered).replace(/\n/g, '<br>');
        }

        if (msgTimeEl) {
            const d = new Date();
            msgTimeEl.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
    }

    window.insertTmplVar = function(v) {
        const msgArea = document.getElementById('dpSchedMessage');
        if (!msgArea) return;
        const start = msgArea.selectionStart || msgArea.value.length;
        const end = msgArea.selectionEnd || msgArea.value.length;
        const text = msgArea.value;
        msgArea.value = text.substring(0, start) + v + text.substring(end);
        msgArea.selectionStart = msgArea.selectionEnd = start + v.length;
        msgArea.focus();
        updateLivePreview();
    };

    document.getElementById('dpBtnModeNow')?.addEventListener('click', () => setDispatchMode('now'));
    document.getElementById('dpBtnModeSchedule')?.addEventListener('click', () => setDispatchMode('schedule'));

    document.querySelectorAll('.dp-hour-chip').forEach(btn => {
        btn.onclick = () => {
            const t = document.getElementById('dpSchedTime');
            if (t) {
                t.value = btn.dataset.h;
                renderSchedTargetLeads();
            }
        };
    });

    document.querySelectorAll('.dp-tag-btn').forEach(btn => {
        btn.onclick = () => window.insertTmplVar(btn.dataset.tag);
    });

    document.getElementById('dpQueueToggleBtn')?.addEventListener('click', () => {
        const g = document.getElementById('dpSchedTargetGrid');
        const arr = document.getElementById('dpQueueArrow');
        if (!g) return;
        const isHidden = g.style.display === 'none';
        g.style.display = isHidden ? 'flex' : 'none';
        if (arr) arr.innerHTML = isHidden ? '<i class="fas fa-chevron-up"></i>' : '<i class="fas fa-chevron-down"></i>';
    });

    document.getElementById('dpSchedMessage')?.addEventListener('input', updateLivePreview);

    // Mudança no horário ou cadência -> Recalcula colisão
    document.getElementById('dpSchedTime')?.addEventListener('change', () => renderSchedTargetLeads());
    document.getElementById('dpSchedCadence')?.addEventListener('change', () => renderSchedTargetLeads());

    // Mudança de template no agendamento
    document.getElementById('dpSchedTemplateSelect')?.addEventListener('change', (e) => {
        const tmplId = e.target.value;
        const t = templates.find(x => String(x.id) === String(tmplId));
        const msgArea = document.getElementById('dpSchedMessage');
        if (t && msgArea) {
            msgArea.value = t.body || t.text || '';
            updateLivePreview();
        }
    });

    // Submissão do agendamento (Criação ou Edição)
    document.getElementById('dpSchedForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('dpSchedSubmitBtn');
        const campaignId = document.getElementById('dpSchedCampaignId')?.value;
        const timeVal = document.getElementById('dpSchedTime')?.value || '10:00';
        const msgVal = (document.getElementById('dpSchedMessage')?.value || '').trim();

        const candidatePool = allLeads.filter(l => {
            if (deselectedLeadIds.has(l.id)) return false;
            if (!campaignId && alreadyScheduledLeadIds.has(l.id)) return false;
            return true;
        });

        const activeTargets = candidatePool.slice(0, selectedQuantity);

        if (!msgVal) return toast('Preencha a mensagem do disparo', 'err');
        if (!activeTargets.length) return toast('Selecione ao menos 1 lead para o disparo', 'err');

        if (submitBtn) submitBtn.disabled = true;

        try {
            if (campaignId) {
                await api(`/campaigns/${campaignId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        name: `Disparo Comercial (${activeTargets.length} leads - ${timeVal})`,
                        message: msgVal
                    })
                });
                toast('Disparo atualizado com sucesso!', 'ok');
            } else {
                if (_dispatchMode === 'now') {
                    // Disparo imediato: cria e dispara imediatamente na fila
                    const body = {
                        name: `Disparo Imediato (${activeTargets.length} leads)`,
                        message: msgVal,
                        lead_ids: activeTargets.map(l => l.id),
                        filters: { status: getSelectedStages(), limit: selectedQuantity },
                        scheduled_at: null
                    };

                    const fresh = await api('/campaigns', {
                        method: 'POST',
                        body: JSON.stringify(body)
                    });

                    // Inicia imediatamente
                    await api(`/campaigns/${fresh.id}/start`, { method: 'POST' }).catch(() => {});
                    toast(`🚀 Disparo de ${activeTargets.length} leads iniciado agora com sucesso!`, 'ok');
                } else {
                    // Disparo agendado para horário futuro
                    const now = new Date();
                    const currentDay = now.getDay();
                    let distance = selectedDay - currentDay;
                    if (distance < 0) distance += 7;
                    
                    const targetDate = new Date();
                    targetDate.setDate(now.getDate() + distance);
                    
                    const dateStr = targetDate.toISOString().slice(0, 10);
                    const schedAt = `${dateStr} ${timeVal}:00`;

                    const body = {
                        name: `Disparo Agendado (${activeTargets.length} leads - ${timeVal})`,
                        message: msgVal,
                        lead_ids: activeTargets.map(l => l.id),
                        filters: { status: getSelectedStages(), limit: selectedQuantity },
                        scheduled_at: schedAt
                    };

                    await api('/campaigns', {
                        method: 'POST',
                        body: JSON.stringify(body)
                    });
                    toast(`🕒 Disparo de ${activeTargets.length} leads agendado para ${timeVal} com sucesso!`, 'ok');
                }
            }

            closeScheduleModal();
            await loadData();
        } catch (err) {
            toast(err.message || 'Erro ao salvar disparo', 'err');
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });

    // Submodal listeners
    document.getElementById('dp-btn-manage-templates')?.addEventListener('click', () => openTemplateManagerModal(false));
    document.getElementById('dp-btn-new-dispatch')?.addEventListener('click', () => openScheduleModal('10:00', 'novo', null));
    document.getElementById('dp-btn-close-tmpl-modal')?.addEventListener('click', closeTemplateManagerModal);
    document.getElementById('dp-btn-close-sched-modal')?.addEventListener('click', closeScheduleModal);
    document.getElementById('dpSchedCancelBtn')?.addEventListener('click', closeScheduleModal);

    document.getElementById('dpTmplBody')?.addEventListener('input', updateTmplPreview);

    // Template submit & delete
    document.getElementById('dpTmplForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = document.getElementById('dpTmplSaveBtn');
        const id = document.getElementById('dpTmplId')?.value;
        const name = document.getElementById('dpTmplName')?.value.trim();
        const body = document.getElementById('dpTmplBody')?.value.trim();

        if (!name || !body) return toast('Preencha nome e mensagem', 'err');
        if (saveBtn) saveBtn.disabled = true;

        try {
            if (id) {
                await api(`/templates/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ name, purpose: 'screening', body })
                });
                toast('Template atualizado com sucesso!', 'ok');
            } else {
                const newTmpl = await api('/templates', {
                    method: 'POST',
                    body: JSON.stringify({ name, purpose: 'screening', body })
                });
                toast('Template criado com sucesso!', 'ok');
                if (newTmpl && newTmpl.id) selectedTmplId = newTmpl.id;
            }

            await loadTemplates();
            populateTmplForm();
        } catch (err) {
            toast(err.message || 'Erro ao salvar template', 'err');
        } finally {
            if (saveBtn) saveBtn.disabled = false;
        }
    });

    document.getElementById('dpTmplDeleteBtn')?.addEventListener('click', async () => {
        const id = document.getElementById('dpTmplId')?.value;
        if (!id) return;
        if (!confirm('Excluir este template permanentemente?')) return;

        try {
            await api(`/templates/${id}`, { method: 'DELETE' });
            toast('Template excluído!', 'ok');
            selectedTmplId = 'new';
            await loadTemplates();
            populateTmplForm();
        } catch (e) { toast(e.message, 'err'); }
    });

    // Controles do Alternador de Visão (Régua Diária vs Agenda Preview)
    document.getElementById('dpBtnModeTrack')?.addEventListener('click', () => switchDispView('track'));
    document.getElementById('dpBtnModeAgenda')?.addEventListener('click', () => switchDispView('agenda'));

    // Botões de Período da Agenda Preview (7d, 15d, 30d)
    document.querySelectorAll('.dp-ag-period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.dp-ag-period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            _dispAgendaPeriod = btn.dataset.period || '7d';
            renderDispAgenda();
        });
    });

    // Controles de Navegação da Agenda Preview
    document.getElementById('dpAgPrev')?.addEventListener('click', () => {
        if (_dispAgendaPeriod === '7d') _dispAgendaAnchor = addDays(_dispAgendaAnchor, -7);
        else if (_dispAgendaPeriod === '15d') _dispAgendaAnchor = addDays(_dispAgendaAnchor, -15);
        else _dispAgendaAnchor = new Date(_dispAgendaAnchor.getFullYear(), _dispAgendaAnchor.getMonth() - 1, 1);
        renderDispAgenda();
    });

    document.getElementById('dpAgNext')?.addEventListener('click', () => {
        if (_dispAgendaPeriod === '7d') _dispAgendaAnchor = addDays(_dispAgendaAnchor, 7);
        else if (_dispAgendaPeriod === '15d') _dispAgendaAnchor = addDays(_dispAgendaAnchor, 15);
        else _dispAgendaAnchor = new Date(_dispAgendaAnchor.getFullYear(), _dispAgendaAnchor.getMonth() + 1, 1);
        renderDispAgenda();
    });

    document.getElementById('dpAgToday')?.addEventListener('click', () => {
        _dispAgendaAnchor = new Date();
        renderDispAgenda();
    });

    if (window.realtime) {
        window.realtime.on('campaign:created', () => loadData());
        window.realtime.on('campaign:updated', () => loadData());
        window.realtime.on('campaign:deleted', () => loadData());
        window.realtime.on('campaign:progress', (data) => {
            const c = allCampaigns.find(x => String(x.id) === String(data.campaign_id));
            if (c) {
                c.total_sent = data.sent;
                renderCategoryCards();
                renderScheduledTimelineBlocks();
            } else {
                loadData();
            }
        });
    }

    // Inicialização
    updateNowPin();
    await loadData();
    await loadTemplates();

    return {};
}

export async function destroy() {
    window.insertTmplVar = undefined;
}
