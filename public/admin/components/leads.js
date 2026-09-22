const STATUS_LABEL = {
    novos: 'NOVO', enviados: 'EM CONTATO', sim: 'CONFIRMADO', nao: 'SEM INTERESSE',
    bloqueado: 'BLOQUEADO', duplicado: 'DUPLICADO',
    novo: 'NOVO', contato: 'EM CONTATO', confirmado: 'CONFIRMADO', concluido: 'CONCLUÍDO'
};

function canonicalStatus(status) {
    return ({ novo: 'novos', contato: 'enviados', confirmado: 'sim', concluido: 'sim' })[status] || status;
}

let _ctpTimer = null;

// A "Ficha do Cliente" (modal completa: edição inline, stepper de estágio, histórico)
// vive dentro do módulo Funil (public/admin/components/funil.js + funil.html), não em
// Leads. Quando já está carregado (ex: usuário veio do Funil) usamos window.openClientModal
// diretamente; caso contrário abrimos o módulo Funil via openToolV2 e chamamos a função que
// ele expõe no retorno do seu init(), garantindo que o HTML/overlay da ficha exista no DOM
// antes de tentar abri-la.
function openClientFicha(leadId) {
    if (typeof window.openClientModal === 'function') {
        window.openClientModal(leadId);
        return;
    }
    if (typeof window.openToolV2 === 'function') {
        window.openToolV2('funil', 'Funil de Vendas', (funilApi) => {
            if (funilApi && typeof funilApi.openClientModal === 'function') {
                funilApi.openClientModal(leadId);
            }
        });
        return;
    }
    console.error('[leads] Não foi possível abrir a Ficha do Cliente: nem openClientModal nem openToolV2 disponíveis.');
}

export async function init() {
    const api = window.api;
    const toast = window.toast;
    let LEADS = [];
    const esc = window.escapeHtml || (s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));

    const initials = n => (n || ' ').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

    function runAnime(params) {
        if (window.anime) return window.anime(params);
    }

    function relTime(utc) {
        if (!utc) return '';
        const d = new Date((utc || '').replace(' ', 'T') + (utc.includes('Z') ? '' : 'Z'));
        if (isNaN(d)) return '';
        const s = (Date.now() - d.getTime()) / 1000;
        if (s < 60) return 'agora';
        const m = s / 60;
        if (m < 60) return Math.floor(m) + 'min atrás';
        const h = m / 60;
        if (h < 24) return Math.floor(h) + 'h atrás';
        const days = h / 24;
        if (days < 7) return Math.floor(days) + 'd atrás';
        return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    function scoreCls(s) { return s == null ? 's-low' : (s >= 70 ? 's-high' : s >= 50 ? 's-mid' : 's-low'); }

    function leadPhoneKey(input) {
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

    function dedupeLeadsByPhone(list) {
        const byPhone = new Map();
        const rank = l => ((l.status === 'bloqueado' || l.status === 'duplicado') ? 0 : 10) + (l.status === 'novos' || l.status === 'novo' ? 2 : 1);
        for (const l of list) {
            const key = leadPhoneKey(l.phone) || String(l.id);
            const prev = byPhone.get(key);
            if (!prev || rank(l) > rank(prev) || (rank(l) === rank(prev) && String(l.updated_at || l.created_at || '') > String(prev.updated_at || prev.created_at || ''))) {
                byPhone.set(key, l);
            }
        }
        return [...byPhone.values()];
    }

    function applyFilters() {
        const search = (document.getElementById('kbx-search')?.value || '').trim().toLowerCase();
        const status = document.getElementById('kbx-status')?.value || '';
        const origem = document.getElementById('kbx-origem')?.value || '';
        const prio = document.getElementById('kbx-prio')?.value || '';
        const tag = (document.getElementById('kbx-tag')?.value || '').trim().toLowerCase();
        const scoreMin = document.getElementById('kbx-score')?.value ? Number(document.getElementById('kbx-score').value) : null;

        const filtered = LEADS.filter(l => {
            if (status && canonicalStatus(l.status) !== canonicalStatus(status)) return false;
            if (origem && l.origem !== origem) return false;
            if (prio && l.prioridade !== prio) return false;
            if (tag && !(l.tags || '').split(',').map(t => t.trim().toLowerCase()).includes(tag)) return false;
            if (scoreMin !== null && (l.score ?? 0) < scoreMin) return false;
            if (search && !(l.name + ' ' + l.phone + ' ' + (l.city || '') + ' ' + (l.cpf || '')).toLowerCase().includes(search)) return false;
            return true;
        });
        return dedupeLeadsByPhone(filtered).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    }

    const AV_COLORS = ['av-blue', 'av-orange', 'av-green', 'av-dark', 'av-yellow'];

    function cardHtml(l) {
        const score = l.score == null ? '—' : l.score;
        const scoreIcon = (l.score ?? 0) >= 70 ? '<i class="fas fa-bolt"></i> ' : '';
        const statusChoices = [
            ['novos', 'NOVO'], ['enviados', 'EM CONTATO'], ['sim', 'CONFIRMADO'], ['nao', 'SEM INTERESSE'], ['bloqueado', 'BLOQUEADO'], ['duplicado', 'DUPLICADO']
        ];
        const curStatus = canonicalStatus(l.status);
        const statusOptions = statusChoices.map(([k, v]) =>
            `<option value="${k}" ${curStatus === k ? 'selected' : ''}>${v}</option>`).join('');

        const prioLabel = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }[l.prioridade] || 'Média';
        const avCls = AV_COLORS[(l.id || 0) % AV_COLORS.length];
        const dateFormatted = new Date((l.created_at || '').replace(' ', 'T')).toLocaleString('pt-BR');

        return `
        <article class="ld-client-card status-${canonicalStatus(l.status) || 'novos'}" data-id="${l.id}">
            <div class="ld-cc-main">
                <span class="ld-cc-av ${avCls}">${esc(initials(l.name))}</span>
                <div class="ld-cc-identity">
                    <div class="ld-cc-top">
                        <strong class="ld-cc-name">${esc(l.name)}</strong>
                        <span class="ld-status-badge status-${canonicalStatus(l.status) || 'novos'}">${STATUS_LABEL[canonicalStatus(l.status)] || 'NOVO'}</span>
                        <span class="ld-prio-badge pri-${l.prioridade || 'media'}">${prioLabel}</span>
                        ${l.origem ? `<span class="ld-origin-tag">${esc(l.origem)}</span>` : ''}
                    </div>
                    <div class="ld-cc-sub">
                        <span><i class="fas fa-phone"></i> ${esc(l.phone)}</span>
                        ${l.cpf ? `<span><i class="fas fa-id-card"></i> ${esc(l.cpf)}</span>` : ''}
                        ${l.city ? `<span><i class="fas fa-location-dot"></i> ${esc(l.city)}</span>` : ''}
                        ${l.limite_est ? `<span class="ld-limite-tag"><i class="fas fa-sack-dollar"></i> R$ ${Number(l.limite_est).toLocaleString('pt-BR')}</span>` : ''}
                        ${l.tags ? l.tags.split(',').filter(Boolean).map(t => `<span class="ld-tag-pill">${esc(t.trim())}</span>`).join('') : ''}
                        <span class="ld-time-tag"><i class="far fa-clock"></i> ${relTime(l.created_at)}</span>
                    </div>
                </div>
            </div>
            <div class="ld-cc-actions">
                <select class="ld-status-select" data-id="${l.id}" onclick="event.stopPropagation()">${statusOptions}</select>
                <button type="button" class="ld-btn-action ld-wa-btn" data-id="${l.id}" title="Chamar no WhatsApp" onclick="event.stopPropagation()">
                    <i class="fab fa-whatsapp"></i> WhatsApp
                </button>
                <button type="button" class="ld-btn-action ld-fiche-btn" data-id="${l.id}" title="Ver Ficha Completa" onclick="event.stopPropagation()">
                    <i class="fas fa-address-card"></i> Ficha
                </button>
            </div>
        </article>`;
    }

    function render() {
        const list = applyFilters();
        const countEl = document.getElementById('kbx-total');
        if (countEl) countEl.textContent = `${list.length} cliente${list.length !== 1 ? 's' : ''}`;

        const board = document.getElementById('kbx-board');
        if (!board) return;

        board.innerHTML = list.length
            ? list.map(cardHtml).join('')
            : '<div class="fl-drawer-empty"><i class="fas fa-inbox"></i> Nenhum cliente encontrado com esses filtros.</div>';

        // Animação de entrada dos cards com Anime.js staggering
        runAnime({
            targets: '.ld-client-card',
            translateY: [15, 0],
            opacity: [0, 1],
            delay: runAnime ? window.anime.stagger(25) : 0,
            duration: 320,
            easing: 'easeOutQuad'
        });

        // Event listeners nos cards para abrir a Ficha do Cliente e WhatsApp
        board.querySelectorAll('.ld-client-card').forEach(card => {
            card.onclick = (e) => {
                const leadId = card.dataset.id;
                openClientFicha(leadId);
            };
        });

        board.querySelectorAll('.ld-wa-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const leadId = btn.dataset.id;
                const lead = LEADS.find(x => String(x.id) === String(leadId));
                if (lead && window.openWaFloatingWidget) {
                    window.openWaFloatingWidget(lead);
                }
            };
        });

        board.querySelectorAll('.ld-fiche-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const leadId = btn.dataset.id;
                openClientFicha(leadId);
            };
        });

        const toolsBtn = document.getElementById('kbx-tools-btn');
        const statusFilter = document.getElementById('kbx-status')?.value;
        if (toolsBtn) {
            toolsBtn.disabled = !statusFilter;
            toolsBtn.title = statusFilter ? `Ferramentas da etapa ${STATUS_LABEL[statusFilter]}` : 'Escolha um status nos filtros para ver as ferramentas da etapa';
        }
    }

    function renderStats() {
        const today = new Date().toISOString().slice(0, 10);
        const totalEl = document.getElementById('lv-stat-total');
        const hojeEl = document.getElementById('lv-stat-hoje');
        const quentesEl = document.getElementById('lv-stat-quentes');

        const totalVal = LEADS.length;
        const hojeVal = LEADS.filter(l => (l.created_at || '').slice(0, 10) === today).length;
        const quentesVal = LEADS.filter(l => (l.score ?? 0) >= 70).length;

        if (totalEl) totalEl.textContent = totalVal;
        if (hojeEl) hojeEl.textContent = hojeVal;
        if (quentesEl) quentesEl.textContent = quentesVal;
    }

    async function refresh() {
        try {
            LEADS = await api('/leads');
            renderStats();
            render();
        } catch (e) {
            const board = document.getElementById('kbx-board');
            if (board) board.innerHTML = `<div class="fl-drawer-empty" style="color:var(--bad);">${esc(e.message)}</div>`;
        }
    }

    // Mudança de status rápida no card
    const boardEl = document.getElementById('kbx-board');
    if (boardEl) {
        boardEl.addEventListener('change', async e => {
            const sel = e.target.closest('.ld-status-select');
            if (!sel) return;
            const id = Number(sel.dataset.id);
            const status = sel.value;
            try {
                await api(`/leads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
                toast(`Movido para ${STATUS_LABEL[status]}`);
                await refresh();
            } catch (err) {
                toast(err.message, 'err');
                await refresh();
            }
        });
    }

    // Listeners de filtros
    document.getElementById('kbx-reload').onclick = refresh;
    document.getElementById('kbx-search')?.addEventListener('input', render);
    document.getElementById('kbx-status')?.addEventListener('change', render);
    document.getElementById('kbx-origem')?.addEventListener('change', render);
    document.getElementById('kbx-prio')?.addEventListener('change', render);
    document.getElementById('kbx-score')?.addEventListener('change', render);
    document.getElementById('kbx-tag')?.addEventListener('input', render);

    // ================= SUBMODAL: NOVO LEAD + IA VISION OCR =================
    const btnNew = document.getElementById('ld-btn-new');
    const btnOcr = document.getElementById('ld-btn-ocr');
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
    // Só abre o popup — o seletor de arquivo abre apenas quando o usuário clicar
    // em "LER DOCUMENTO" ou soltar/colar um arquivo, não automaticamente.
    if (btnOcr) btnOcr.onclick = openNewLeadModal;
    if (addClose) addClose.onclick = closeNewLeadModal;
    if (addCancel) addCancel.onclick = closeNewLeadModal;

    // IA VISION OCR (Simulação de Extração Inteligente de Documento)
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

        // Colar imagem da área de transferência (Ctrl+V) enquanto o modal estiver aberto
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
        document.getElementById('ldOcrFileName').textContent = file.name;
        document.getElementById('ldOcrThumb').style.display = ocrPreviewIsPdf ? 'none' : '';
        document.getElementById('ldOcrThumbPdf').style.display = ocrPreviewIsPdf ? 'grid' : 'none';
        if (!ocrPreviewIsPdf) document.getElementById('ldOcrThumb').src = ocrPreviewUrl;
        document.getElementById('ldOcrPreview').style.display = 'flex';
    }

    function openLightbox() {
        if (ocrPreviewIsPdf) { window.open(ocrPreviewUrl, '_blank'); return; }
        if (!ocrPreviewUrl) return;
        document.getElementById('ldLightboxImg').src = ocrPreviewUrl;
        document.getElementById('ldLightbox').style.display = 'flex';
    }
    function closeLightbox() { document.getElementById('ldLightbox').style.display = 'none'; }

    document.getElementById('ldOcrThumbBtn')?.addEventListener('click', openLightbox);
    document.getElementById('ldOcrChange')?.addEventListener('click', () => {
        resetOcrPreview();
        ocrFileInput?.click();
    });
    document.getElementById('ldLightboxClose')?.addEventListener('click', closeLightbox);
    document.getElementById('ldLightbox')?.addEventListener('click', (e) => {
        if (e.target.id === 'ldLightbox') closeLightbox();
    });

    // Lê um File/Blob como base64 puro (sem o prefixo "data:...;base64,")
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = String(reader.result || '');
                const comma = result.indexOf(',');
                resolve(comma !== -1 ? result.slice(comma + 1) : result);
            };
            reader.onerror = () => reject(reader.error || new Error('Falha ao ler o arquivo'));
            reader.readAsDataURL(file);
        });
    }

    async function processOcrFile(file) {
        showOcrPreview(file); // mostra a miniatura já na hora — não depende do OCR "terminar"
        if (ocrLoading) ocrLoading.style.display = 'flex';
        if (ocrTrigger) ocrTrigger.style.display = 'none';

        // PDF não é suportado pelo modelo de visão usado aqui — avisa e deixa preenchimento manual.
        if (file.type === 'application/pdf') {
            toast('PDF ainda não é lido pela IA Vision — preencha manualmente ou envie uma foto/imagem do documento.', 'err');
            if (ocrLoading) ocrLoading.style.display = 'none';
            return;
        }

        try {
            const base64 = await fileToBase64(file);
            const extracted = await api('/leads/ocr', {
                method: 'POST',
                body: JSON.stringify({ image: base64, mime_type: file.type || 'image/png' })
            });

            // Só preenche os campos que a IA realmente conseguiu ler — nunca inventa
            // (telefone, renda e limite ficam vazios quando não estão legíveis no documento).
            const filled = [];
            const setIfPresent = (id, value) => {
                if (value === null || value === undefined || value === '') return;
                const el = document.getElementById(id);
                if (!el) return;
                el.value = value;
                filled.push('#' + id);
            };
            setIfPresent('add-name', extracted.name);
            setIfPresent('add-phone', extracted.phone);
            setIfPresent('add-cpf', extracted.cpf);
            setIfPresent('add-city', extracted.city);
            setIfPresent('add-agencia', extracted.agencia);
            setIfPresent('add-conta', extracted.conta);
            if (extracted.renda !== null && extracted.renda !== undefined) {
                setIfPresent('add-renda', Number(extracted.renda).toFixed(2));
            }
            // Limite estimado nunca vem da IA (decisão de negócio) — permanece manual.

            // Simulações de crédito lidas da tela (ex: Portal COBAN) — anexadas às
            // Observações como texto, sem sobrescrever o que o usuário já tiver digitado.
            if (Array.isArray(extracted.simulacoes) && extracted.simulacoes.length) {
                const obsEl = document.getElementById('add-obs');
                if (obsEl) {
                    const linhas = extracted.simulacoes.map(s => {
                        const partes = [s.produto, s.modalidade, s.valor, s.data].filter(Boolean);
                        return '- ' + partes.join(' — ');
                    });
                    const bloco = `Últimas simulações (lidas via IA Vision):\n${linhas.join('\n')}`;
                    obsEl.value = obsEl.value.trim() ? `${obsEl.value.trim()}\n\n${bloco}` : bloco;
                    filled.push('#add-obs');
                }
            }

            const confidencePct = Math.round((extracted.confidence || 0) * 100);
            if (filled.length === 0) {
                toast('IA Vision não conseguiu ler dados neste documento — preencha manualmente.', 'err');
            } else if (confidencePct < 50) {
                toast(`IA Vision: leitura de baixa confiança (${confidencePct}%) — revise os campos preenchidos antes de salvar.`, 'err');
            } else {
                toast(`IA Vision: documento lido (confiança ${confidencePct}%) — revise antes de salvar.`);
            }
            if (extracted.notes) toast(extracted.notes);

            if (filled.length) {
                runAnime({
                    targets: filled.join(', '),
                    scale: [1.03, 1],
                    backgroundColor: ['#e2fbea', '#ffffff'],
                    duration: 600,
                    easing: 'easeOutQuad'
                });
            }

        } catch (e) {
            toast(e?.message || 'Erro ao ler documento via IA', 'err');
        } finally {
            if (ocrLoading) ocrLoading.style.display = 'none';
            // Mantém a prévia do documento visível (não volta a mostrar o prompt de
            // soltar arquivo) — "TROCAR" é o jeito de enviar outro documento.
        }
    }

    if (addSave) {
        addSave.onclick = async () => {
            const name = document.getElementById('add-name').value.trim();
            const phone = document.getElementById('add-phone').value.trim();
            if (!name || !phone) return toast('Nome e telefone são obrigatórios', 'err');

            const body = {
                name, phone,
                phone2: document.getElementById('add-phone2')?.value.trim() || null,
                phone3: document.getElementById('add-phone3')?.value.trim() || null,
                cpf: document.getElementById('add-cpf').value.trim(),
                prioridade: document.getElementById('add-prio').value,
                origem: document.getElementById('add-origem').value,
                city: document.getElementById('add-city').value.trim(),
                agencia: document.getElementById('add-agencia')?.value.trim() || null,
                conta: document.getElementById('add-conta')?.value.trim() || null,
                renda: document.getElementById('add-renda').value ? parseFloat(document.getElementById('add-renda').value) : null,
                limite_est: document.getElementById('add-limite').value ? parseFloat(document.getElementById('add-limite').value) : null,
                tags: document.getElementById('add-tags').value.trim(),
                obs: document.getElementById('add-obs').value.trim()
            };

            addSave.disabled = true;
            try {
                await api('/leads', { method: 'POST', body: JSON.stringify(body) });
                toast('Lead cadastrado com sucesso!');
                closeNewLeadModal();
                document.getElementById('ld-add-form')?.reset();
                await refresh();
            } catch (e) {
                toast(e.message, 'err');
            } finally {
                addSave.disabled = false;
            }
        };
    }

    // ================= FERRAMENTAS DE ETAPA (AÇÕES EM MASSA) =================
    const DEFAULT_AUTO_MSG = 'Olá {nome}! Você pediu uma simulação de crédito. Posso pedir para um vendedor encaminhar? Responda SIM para continuar.';
    let toolsStatus = 'novos';
    let toolsConfig = {};
    let ctpJobId = null;
    let ctpRunning = false;

    async function loadNumbers() {
        try {
            const numbers = await api('/campaigns/numbers');
            const select = document.getElementById('ctools-number');
            if (select) {
                select.innerHTML = numbers.filter(n => n.status === 'ativo').map(n => `<option value="${n.id}">${n.number} (${n.messages_sent} enviadas)</option>`).join('')
                    || '<option value="">Nenhum número ativo</option>';
            }
        } catch (e) {}
    }

    async function loadStageConfig() {
        try { toolsConfig = await api('/tools/stage-config'); } catch (e) { toolsConfig = {}; }
    }

    function openColumnTools(status) {
        toolsStatus = status;
        const statusEl = document.getElementById('ctools-status');
        if (statusEl) statusEl.textContent = STATUS_LABEL[status] || status.toUpperCase();

        status = canonicalStatus(status);
        toolsStatus = status;
        const canSend = status === 'novos' || status === 'enviados';
        const sendWrap = document.getElementById('ctools-send-wrap');
        if (sendWrap) sendWrap.style.display = canSend ? '' : 'none';

        document.getElementById('ctools-msg').value = DEFAULT_AUTO_MSG;
        document.getElementById('ctools-limit').value = '';
        document.getElementById('ctools-move-limit').value = '';
        document.getElementById('ctools-recalc-limit').value = '';
        document.getElementById('ctools-to').value = status === 'novos' ? 'enviados' : 'sim';

        loadNumbers();
        document.getElementById('ctoolsOverlay').style.display = 'flex';
    }

    const toolsBtn = document.getElementById('kbx-tools-btn');
    if (toolsBtn) {
        toolsBtn.onclick = () => {
            const status = document.getElementById('kbx-status').value;
            if (!status) return;
            openColumnTools(status);
        };
    }

    function stopPolling() {
        ctpRunning = false;
        clearTimeout(_ctpTimer);
        _ctpTimer = null;
    }

    function runJob(job, title) {
        ctpJobId = job.id;
        document.getElementById('ctp-title').textContent = title;
        document.getElementById('ctoolsOverlay').style.display = 'none';
        document.getElementById('ctp-cancel').style.display = 'inline-flex';
        document.getElementById('ctp-done-btn').style.display = 'none';
        document.getElementById('ctp-log').style.display = 'none';
        document.getElementById('ctp-log').innerHTML = '';
        document.getElementById('ctoolsProgress').style.display = 'flex';
        stopPolling();
        ctpRunning = true;
        pollJob();
    }

    function pollJob() {
        clearTimeout(_ctpTimer);
        if (!ctpRunning) return;
        _ctpTimer = setTimeout(async () => {
            try {
                const job = await api(`/tools/jobs/${ctpJobId}`);
                renderJob(job);
                if (['done', 'failed', 'cancelled'].includes(job.status)) {
                    stopPolling();
                    document.getElementById('ctp-cancel').style.display = 'none';
                    document.getElementById('ctp-done-btn').style.display = 'inline-flex';
                    if (job.status === 'failed') toast(job.error || 'Ação falhou', 'err');
                    refresh();
                } else {
                    pollJob();
                }
            } catch (e) {
                pollJob();
            }
        }, 1500);
    }

    function renderJob(job) {
        const p = job.payload || {};
        const done = p.done || 0;
        const total = p.total || 0;
        const ok = p.ok != null ? p.ok : (p.changed != null ? p.changed : done);
        const fail = p.fail || 0;
        const pct = total ? Math.round(done / total * 100) : (job.status === 'running' ? 5 : 0);

        document.getElementById('ctp-fill').style.width = pct + '%';
        document.getElementById('ctp-pct').textContent = pct + '%';
        document.getElementById('ctp-done').textContent = done;
        document.getElementById('ctp-total').textContent = total;
        document.getElementById('ctp-ok').textContent = ok;
        document.getElementById('ctp-fail').textContent = fail;

        const statusEl = document.getElementById('ctp-status');
        statusEl.className = 'ctp-status ' + (job.status === 'failed' ? 'failed' : job.status === 'done' ? 'done' : job.status === 'cancelled' ? 'cancelled' : '');
        statusEl.innerHTML = job.status === 'running' ? '<i class="fas fa-spinner fa-spin"></i> PROCESSANDO...'
            : job.status === 'waiting' ? '<i class="fas fa-hourglass-half"></i> AGUARDANDO NA FILA...'
            : job.status === 'done' ? `<i class="fas fa-check-circle"></i> CONCLUÍDO — ${ok} ok`
            : job.status === 'failed' ? `<i class="fas fa-xmark-circle"></i> FALHOU: ${job.error || ''}`
            : '<i class="fas fa-ban"></i> CANCELADO';

        const log = document.getElementById('ctp-log');
        if (Array.isArray(p.log) && p.log.length) {
            log.style.display = 'flex';
            log.innerHTML = p.log.slice(-15).map(x =>
                `<div class="ctp-log-item ${x.ok ? 'ok' : 'fail'}"><i class="fas ${x.ok ? 'fa-circle-check' : 'fa-circle-xmark'}"></i><span>${esc(x.label)}</span></div>`
            ).join('');
        } else {
            log.style.display = 'none';
        }
    }

    const ctoolsClose = document.getElementById('ctools-close');
    if (ctoolsClose) ctoolsClose.onclick = () => document.getElementById('ctoolsOverlay').style.display = 'none';
    const ctpClose = document.getElementById('ctp-close');
    if (ctpClose) ctpClose.onclick = () => { stopPolling(); document.getElementById('ctoolsProgress').style.display = 'none'; };
    const ctpDone = document.getElementById('ctp-done-btn');
    if (ctpDone) ctpDone.onclick = () => { stopPolling(); document.getElementById('ctoolsProgress').style.display = 'none'; };

    const ctoolsSend = document.getElementById('ctools-send');
    if (ctoolsSend) {
        ctoolsSend.onclick = async () => {
            const message = document.getElementById('ctools-msg').value.trim();
            if (!message) return toast('Digite a mensagem', 'err');
            const body = { status: toolsStatus, message };
            const lim = document.getElementById('ctools-limit').value;
            if (lim) body.limit = Number(lim);
            const num = document.getElementById('ctools-number').value;
            if (num) body.number_id = Number(num);
            try {
                const r = await api('/tools/send', { method: 'POST', body: JSON.stringify(body) });
                toast(`Campanha criada (${r.campaign.total_target} alvo${r.campaign.total_target !== 1 ? 's' : ''})`);
                if (r.job_id) runJob({ id: r.job_id }, 'DISPARANDO MENSAGEM');
                else refresh();
            } catch (e) { toast(e.message, 'err'); }
        };
    }

    const ctoolsMove = document.getElementById('ctools-move');
    if (ctoolsMove) {
        ctoolsMove.onclick = async () => {
            const to_status = document.getElementById('ctools-to').value;
            if (to_status === toolsStatus) return toast('Escolha um estágio diferente', 'err');
            const body = { status: toolsStatus, to_status };
            const lim = document.getElementById('ctools-move-limit').value;
            if (lim) body.limit = Number(lim);
            if (!confirm(`Mover os leads desta etapa para ${STATUS_LABEL[to_status]}?`)) return;
            try {
                const r = await api('/tools/move', { method: 'POST', body: JSON.stringify(body) });
                runJob(r.job, 'MOVENDO LEADS');
            } catch (e) { toast(e.message, 'err'); }
        };
    }

    const ctoolsRecalc = document.getElementById('ctools-recalc');
    if (ctoolsRecalc) {
        ctoolsRecalc.onclick = async () => {
            const body = { status: toolsStatus };
            const lim = document.getElementById('ctools-recalc-limit').value;
            if (lim) body.limit = Number(lim);
            try {
                const r = await api('/tools/recalc', { method: 'POST', body: JSON.stringify(body) });
                runJob(r.job, 'RECALCULANDO SCORE');
            } catch (e) { toast(e.message, 'err'); }
        };
    }

    await loadStageConfig();
    await refresh();
    return {
        setStatusFilter(status) {
            const sel = document.getElementById('kbx-status');
            if (sel) { sel.value = status || ''; render(); }
        }
    };
}

export async function destroy() {
    clearTimeout(_ctpTimer);
    _ctpTimer = null;
}
