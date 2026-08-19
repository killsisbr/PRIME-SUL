/**
 * POPUP FLUTUANTE ARRASTÁVEL DO WHATSAPP (TAMANHO SMARTPHONE EMULADO)
 * + PAINEL ACOPLADO DE FERRAMENTAS (.wa-tools-panel)
 * Persiste posição, lead ativo, estado aberto/minimizado e ferramentas no localStorage (F5 Safe).
 */
(function() {
    const STORAGE_KEY = 'prime_sul_wa_float_state';

    function getSavedState() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        } catch (e) {
            return {};
        }
    }

    function updateSavedState(partial) {
        const current = getSavedState();
        const updated = { ...current, ...partial };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
    }

    function initPopupDOM() {
        if (document.getElementById('waFloatPopup')) return;

        const html = `
        <div class="wa-float-popup" id="waFloatPopup" style="display:none; top:100px; right:40px;">
            <div class="wa-pop-header" id="waPopHeader">
                <div class="wa-pop-header-left">
                    <div class="wa-pop-avatar" id="waPopAvatar">WA</div>
                    <div class="wa-pop-meta">
                        <div class="wa-pop-name" id="waPopName">Cliente</div>
                        <div class="wa-pop-status"><i class="fas fa-circle"></i> WhatsApp Web • Online</div>
                    </div>
                </div>
                <div class="wa-pop-actions">
                    <button type="button" class="wa-pop-btn" id="waPopToolsBtn" title="Ferramentas Auxiliares Acopladas"><i class="fas fa-toolbox"></i></button>
                    <button type="button" class="wa-pop-btn" id="waPopExtBtn" title="Abrir em nova aba WhatsApp"><i class="fas fa-arrow-up-right-from-square"></i></button>
                    <button type="button" class="wa-pop-btn" id="waPopMinBtn" title="Minimizar"><i class="fas fa-minus"></i></button>
                    <button type="button" class="wa-pop-btn" id="waPopCloseBtn" title="Fechar"><i class="fas fa-times"></i></button>
                </div>
            </div>

            <div class="wa-pop-quick-bar">
                <span class="wa-pop-quick-chip" data-quick="Olá {nome}! Tudo bem? Como posso te ajudar na sua simulação hoje?">👋 Saudação</span>
                <span class="wa-pop-quick-chip" data-quick="Estou analisando seu limite de crédito agora. Pode aguardar um minuto?">⏱️ Aguarde</span>
                <span class="wa-pop-quick-chip" data-quick="Seu cadastro foi aprovado com sucesso! Vamos concluir a contratação?">✅ Aprovado</span>
            </div>

            <div class="wa-pop-messages" id="waPopMessages">
                <div class="wa-msg-bubble in">
                    <div>Carregando histórico do cliente...</div>
                </div>
            </div>

            <div class="wa-pop-footer">
                <div class="wa-pop-input-row">
                    <input type="text" class="wa-pop-input" id="waPopInput" placeholder="Digite uma mensagem..." autocomplete="off">
                    <button type="button" class="wa-pop-send-btn" id="waPopSendBtn" title="Enviar Mensagem"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>

            <!-- PAINEL ACOPLADO LATERAL DE FERRAMENTAS -->
            <div class="wa-tools-panel" id="waToolsPanel" style="display:none;">
                <div class="wa-tools-header">
                    <h4><i class="fas fa-toolbox"></i> FERRAMENTAS DO LEAD</h4>
                    <button type="button" class="wa-pop-btn" id="waToolsCloseBtn" title="Fechar Ferramentas"><i class="fas fa-times"></i></button>
                </div>
                <div class="wa-tools-body">
                    <!-- TOOL 0: DADOS DO LEAD (BANCO DE DADOS) -->
                    <div class="wa-tool-card wa-lead-info-card">
                        <div class="wa-tool-title"><span><i class="fas fa-address-card"></i> DADOS DO LEAD</span>
                            <span class="wa-info-score" id="wat-info-score">—</span>
                        </div>
                        <div class="wa-info-badges">
                            <span class="wa-info-badge" id="wat-info-prio">★ Média</span>
                            <span class="wa-info-badge" id="wat-info-origem">SITE</span>
                            <span class="wa-info-badge" id="wat-info-status">NOVO</span>
                        </div>
                        <div class="wa-info-grid">
                            <div class="wa-info-row">
                                <span class="wa-info-label"><i class="fas fa-user"></i> Nome</span>
                                <span class="wa-info-value editable" id="wat-info-name" data-field="name" title="Clique para editar">—</span>
                            </div>
                            <div class="wa-info-row">
                                <span class="wa-info-label"><i class="fas fa-phone"></i> Telefone</span>
                                <span class="wa-info-value copyable" id="wat-info-phone" data-copy="">—</span>
                            </div>
                            <div class="wa-info-row">
                                <span class="wa-info-label"><i class="fas fa-id-card"></i> CPF</span>
                                <span class="wa-info-value copyable editable" id="wat-info-cpf" data-field="cpf" data-copy="" title="Clique para editar">—</span>
                            </div>
                            <div class="wa-info-row">
                                <span class="wa-info-label"><i class="fas fa-location-dot"></i> Cidade</span>
                                <span class="wa-info-value editable" id="wat-info-city" data-field="city" title="Clique para editar">—</span>
                            </div>
                            <div class="wa-info-row">
                                <span class="wa-info-label"><i class="fas fa-sack-dollar"></i> Renda</span>
                                <span class="wa-info-value editable" id="wat-info-renda" data-field="renda" title="Clique para editar">—</span>
                            </div>
                            <div class="wa-info-row">
                                <span class="wa-info-label"><i class="fas fa-coins"></i> Limite Est.</span>
                                <span class="wa-info-value editable" id="wat-info-limite" data-field="limite_est" title="Clique para editar">—</span>
                            </div>
                        </div>
                        <div class="wa-info-tags" id="wat-info-tags"></div>
                        <div class="wa-info-obs" id="wat-info-obs" style="display:none;"></div>
                    </div>

                    <!-- TOOL 1: MOVER ESTÁGIO -->
                    <div class="wa-tool-card">
                        <div class="wa-tool-title"><span><i class="fas fa-right-left"></i> ESTÁGIO NO FUNIL</span></div>
                        <div class="wa-tool-stepper" id="waToolsStepper">
                            <button type="button" class="wa-tool-step-btn" data-stage="novo">NOVO</button>
                            <button type="button" class="wa-tool-step-btn" data-stage="contato">CONTATO</button>
                            <button type="button" class="wa-tool-step-btn" data-stage="confirmado">CONFIRMADO</button>
                            <button type="button" class="wa-tool-step-btn" data-stage="concluido">CONCLUÍDO</button>
                        </div>
                    </div>

                    <!-- TOOL 2: SIMULADOR DE CRÉDITO -->
                    <div class="wa-tool-card">
                        <div class="wa-tool-title"><span><i class="fas fa-calculator"></i> SIMULADOR DE PARCELA</span></div>
                        <input type="number" id="wat-val" class="wa-tool-input" placeholder="Valor do Empréstimo (R$)">
                        <div style="display:flex; gap:6px;">
                            <input type="number" id="wat-prazo" class="wa-tool-input" placeholder="Prazo (meses)" value="84">
                            <button type="button" class="btn-retro" id="wat-calc-btn" style="padding:4px 10px; font-size:.62rem;"><i class="fas fa-equals"></i></button>
                        </div>
                        <div id="wat-sim-res" style="font-size:.72rem; font-weight:800; color:var(--primary, #3b82f6); text-align:center; min-height:18px;"></div>
                    </div>

                    <!-- TOOL 3: ANOTAÇÕES RÁPIDAS -->
                    <div class="wa-tool-card">
                        <div class="wa-tool-title"><span><i class="fas fa-note-sticky"></i> ANOTAÇÃO RÁPIDA</span></div>
                        <textarea id="wat-note" class="wa-tool-input" rows="2" placeholder="Escreva observações do lead..."></textarea>
                        <button type="button" class="btn-retro" id="wat-save-note" style="padding:6px 12px; font-size:.65rem;"><i class="fas fa-floppy-disk"></i> SALVAR NOTA</button>
                    </div>

                    <!-- TOOL 4: RESPOSTA SUGERIDA POR IA -->
                    <div class="wa-tool-card">
                        <div class="wa-tool-title"><span><i class="fas fa-wand-magic-sparkles"></i> IA RESPOSTAS</span></div>
                        <button type="button" class="btn-retro btn-secondary-retro" id="wat-ai-sug" style="padding:6px 12px; font-size:.65rem; justify-content:center;"><i class="fas fa-robot"></i> GERAR SUGESTÃO IA</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="wa-min-badge" id="waMinBadge" style="display:none;">
            <i class="fab fa-whatsapp"></i> <span id="waMinName">Conversa Ativa</span>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', html);
        setupEvents();
    }

    let activeLead = null;

    function setupEvents() {
        const popup = document.getElementById('waFloatPopup');
        const header = document.getElementById('waPopHeader');
        const closeBtn = document.getElementById('waPopCloseBtn');
        const minBtn = document.getElementById('waPopMinBtn');
        const extBtn = document.getElementById('waPopExtBtn');
        const toolsBtn = document.getElementById('waPopToolsBtn');
        const toolsPanel = document.getElementById('waToolsPanel');
        const toolsCloseBtn = document.getElementById('waToolsCloseBtn');
        const minBadge = document.getElementById('waMinBadge');
        const sendBtn = document.getElementById('waPopSendBtn');
        const inputEl = document.getElementById('waPopInput');
        const quickChips = popup.querySelectorAll('.wa-pop-quick-chip');

        // Drag & Drop Mechanics
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.wa-pop-btn')) return;
            isDragging = true;
            popup.classList.add('dragging');
            startX = e.clientX;
            startY = e.clientY;
            const rect = popup.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            popup.style.right = 'auto';
            popup.style.left = `${initialLeft}px`;
            popup.style.top = `${initialTop}px`;
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const newLeft = Math.max(10, Math.min(window.innerWidth - popup.offsetWidth - 10, initialLeft + dx));
            const newTop = Math.max(10, Math.min(window.innerHeight - popup.offsetHeight - 10, initialTop + dy));
            popup.style.left = `${newLeft}px`;
            popup.style.top = `${newTop}px`;

            // Auto-docking: se estiver perto da borda direita, acopla as ferramentas no lado esquerdo do popup
            if (newLeft > window.innerWidth - 720) {
                popup.classList.add('dock-left');
            } else {
                popup.classList.remove('dock-left');
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                popup.classList.remove('dragging');
                const rect = popup.getBoundingClientRect();
                updateSavedState({ posX: rect.left, posY: rect.top });
            }
        });

        // Alternar Painel de Ferramentas Acoplado
        toolsBtn.onclick = () => {
            const willOpen = toolsPanel.style.display === 'none';
            toolsPanel.style.display = willOpen ? 'flex' : 'none';
            updateSavedState({ isToolsOpen: willOpen });

            if (willOpen && window.anime) {
                window.anime({
                    targets: toolsPanel,
                    scale: [0.9, 1],
                    opacity: [0, 1],
                    duration: 300,
                    easing: 'easeOutCubic'
                });
            }
        };

        if (toolsCloseBtn) {
            toolsCloseBtn.onclick = () => {
                toolsPanel.style.display = 'none';
                updateSavedState({ isToolsOpen: false });
            };
        }

        // Copiar telefone/CPF do card de dados do lead
        toolsPanel.querySelectorAll('.wa-info-value.copyable').forEach(el => {
            el.addEventListener('click', () => {
                if (el.querySelector('input')) return; // em edição, não copia
                const val = el.dataset.copy;
                if (!val) return;
                navigator.clipboard?.writeText(val).then(() => {
                    if (window.toast) window.toast('Copiado!');
                    el.classList.add('copied');
                    setTimeout(() => el.classList.remove('copied'), 600);
                }).catch(() => {});
            });
        });

        // Editar dados do lead direto no card (Nome, CPF, Cidade, Renda, Limite Est.)
        toolsPanel.querySelectorAll('.wa-info-value.editable').forEach(el => {
            el.addEventListener('click', () => startEditInfoField(el));
        });

        // Tool 1: Stepper Mover Estágio
        document.querySelectorAll('#waToolsStepper .wa-tool-step-btn').forEach(btn => {
            btn.onclick = async () => {
                if (!activeLead) return;
                const stage = btn.dataset.stage;
                try {
                    if (window.api) {
                        await window.api(`/leads/${activeLead.id}/status`, {
                            method: 'PATCH',
                            body: JSON.stringify({ status: stage })
                        });
                    }
                    if (window.toast) window.toast(`Lead movido para ${stage.toUpperCase()}!`);
                    updateStepperUI(stage);
                } catch (e) {
                    if (window.toast) window.toast(e.message, 'err');
                }
            };
        });

        // Tool 2: Calculadora de Simulação
        const calcBtn = document.getElementById('wat-calc-btn');
        if (calcBtn) {
            calcBtn.onclick = () => {
                const val = parseFloat(document.getElementById('wat-val').value) || 0;
                const meses = parseInt(document.getElementById('wat-prazo').value) || 84;
                if (!val) return;
                const taxa = 0.018; // 1.8% a.m.
                const pmt = (val * taxa * Math.pow(1 + taxa, meses)) / (Math.pow(1 + taxa, meses) - 1);
                document.getElementById('wat-sim-res').textContent = `${meses}x de R$ ${pmt.toFixed(2)}`;
            };
        }

        // Tool 3: Salvar Anotação Rápida
        const saveNoteBtn = document.getElementById('wat-save-note');
        if (saveNoteBtn) {
            saveNoteBtn.onclick = async () => {
                const note = document.getElementById('wat-note').value.trim();
                if (!note || !activeLead) return;
                try {
                    if (window.api) {
                        await window.api(`/leads/${activeLead.id}/notes`, {
                            method: 'POST',
                            body: JSON.stringify({ note: `[Anotação Rápida] ${note}` })
                        });
                    }
                    if (window.toast) window.toast('Anotação salva!');
                    document.getElementById('wat-note').value = '';
                } catch (e) {}
            };
        }

        // Tool 4: Sugestão por IA
        const aiSugBtn = document.getElementById('wat-ai-sug');
        if (aiSugBtn) {
            aiSugBtn.onclick = () => {
                if (!activeLead) return;
                const sug = `Olá ${activeLead.name.split(' ')[0]}! Vi que você se interessou pela nossa simulação. Qual o seu melhor horário para conversarmos?`;
                inputEl.value = sug;
                inputEl.focus();
            };
        }

        // Fechar Popup
        closeBtn.onclick = () => {
            popup.style.display = 'none';
            minBadge.style.display = 'none';
            updateSavedState({ isOpen: false, isMinimized: false });
        };

        // Minimizar Popup
        minBtn.onclick = () => {
            popup.style.display = 'none';
            minBadge.style.display = 'flex';
            if (activeLead) document.getElementById('waMinName').textContent = activeLead.name || 'WhatsApp';
            updateSavedState({ isMinimized: true });
        };

        // Restaurar de Minimizado
        minBadge.onclick = () => {
            minBadge.style.display = 'none';
            popup.style.display = 'flex';
            updateSavedState({ isMinimized: false, isOpen: true });
        };

        // Abrir no WhatsApp Web externo
        extBtn.onclick = () => {
            if (!activeLead) return;
            const cleanPhone = (activeLead.phone || '').replace(/\D/g, '');
            const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
            window.open(`https://wa.me/${fullPhone}?text=Olá%20${encodeURIComponent(activeLead.name)},%20sou%20da%20Prime%20Sul!`, '_blank');
        };

        // Quick template chips
        quickChips.forEach(chip => {
            chip.onclick = () => {
                const tmpl = chip.dataset.quick || '';
                const msg = tmpl.replace('{nome}', activeLead ? activeLead.name.split(' ')[0] : 'cliente');
                inputEl.value = msg;
                inputEl.focus();
            };
        });

        // Enviar mensagem no chat
        async function sendMessage() {
            const msgText = inputEl.value.trim();
            if (!msgText || !activeLead) return;

            const msgBox = document.getElementById('waPopMessages');
            const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            const bubble = document.createElement('div');
            bubble.className = 'wa-msg-bubble out';
            bubble.innerHTML = `
                <div>${escapeHtml(msgText)}</div>
                <div class="wa-msg-meta"><span>${timeStr}</span> <i class="fas fa-check-double" style="color:#34b7f1;"></i></div>`;
            msgBox.appendChild(bubble);
            msgBox.scrollTop = msgBox.scrollHeight;
            inputEl.value = '';

            try {
                if (window.api) {
                    await window.api(`/leads/${activeLead.id}/notes`, {
                        method: 'POST',
                        body: JSON.stringify({ note: `[WhatsApp Web] ${msgText}` })
                    });
                }
                if (window.toast) window.toast('Mensagem enviada com sucesso!');
            } catch (e) {}
        }

        sendBtn.onclick = sendMessage;
        inputEl.onkeydown = (e) => {
            if (e.key === 'Enter') sendMessage();
        };
    }

    function updateStepperUI(currentStage) {
        document.querySelectorAll('#waToolsStepper .wa-tool-step-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.stage === currentStage);
        });
    }

    const WA_STATUS_LABEL = { novo: 'NOVO', contato: 'EM CONTATO', confirmado: 'CONFIRMADO', concluido: 'CONCLUÍDO', bloqueado: 'BLOQUEADO', duplicado: 'DUPLICADO' };
    const WA_PRIO_LABEL = { alta: '★ Alta', media: '★ Média', baixa: '★ Baixa' };

    function formatMoney(v) {
        const n = parseFloat(v);
        if (!v || isNaN(n)) return '—';
        return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function fillLeadInfoCard(lead) {
        const scoreEl = document.getElementById('wat-info-score');
        if (scoreEl) {
            const score = lead.score;
            scoreEl.textContent = score == null ? '—' : score;
            scoreEl.className = 'wa-info-score' + (score >= 70 ? ' hi' : score >= 40 ? ' mid' : score != null ? ' low' : '');
        }

        const prioEl = document.getElementById('wat-info-prio');
        if (prioEl) prioEl.textContent = WA_PRIO_LABEL[lead.prioridade] || '★ Média';

        const origemEl = document.getElementById('wat-info-origem');
        if (origemEl) origemEl.textContent = lead.origem || 'SITE';

        const statusEl = document.getElementById('wat-info-status');
        if (statusEl) statusEl.textContent = WA_STATUS_LABEL[lead.status] || 'NOVO';

        const set = (id, value, copyRaw) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = value || '—';
            if (copyRaw !== undefined) el.dataset.copy = value || '';
        };

        set('wat-info-name', lead.name);
        set('wat-info-phone', lead.phone, lead.phone);
        set('wat-info-cpf', lead.cpf, lead.cpf);
        set('wat-info-city', lead.city);
        set('wat-info-renda', lead.renda ? formatMoney(lead.renda) : null);
        set('wat-info-limite', lead.limite_est ? formatMoney(lead.limite_est) : null);

        const tagsEl = document.getElementById('wat-info-tags');
        if (tagsEl) {
            const tags = (lead.tags || '').split(',').map(t => t.trim()).filter(Boolean);
            tagsEl.innerHTML = tags.map(t => `<span class="wa-info-tag">${escapeHtml(t)}</span>`).join('');
        }

        const obsEl = document.getElementById('wat-info-obs');
        if (obsEl) {
            if (lead.obs) {
                obsEl.style.display = 'block';
                obsEl.innerHTML = `<i class="fas fa-note-sticky"></i> ${escapeHtml(lead.obs)}`;
            } else {
                obsEl.style.display = 'none';
            }
        }
    }

    const WA_MONEY_FIELDS = ['renda', 'limite_est'];

    function startEditInfoField(el) {
        if (el.querySelector('input') || !activeLead) return;

        const field = el.dataset.field;
        const isMoney = WA_MONEY_FIELDS.includes(field);
        const rawValue = activeLead[field] || '';
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
            else fillLeadInfoCard(activeLead);
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); finish(true); }
            else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        });
        input.addEventListener('blur', () => finish(true));
        input.addEventListener('click', (e) => e.stopPropagation());
    }

    async function commitEdit(el, field, value) {
        const lead = activeLead;
        if (!lead) return;
        const previous = lead[field];
        if ((previous || '') === value) { fillLeadInfoCard(lead); return; }

        lead[field] = value;
        fillLeadInfoCard(lead);

        try {
            if (window.api) {
                const body = {};
                body[field] = value;
                await window.api(`/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify(body) });
            }
            if (window.toast) window.toast('Dado do lead atualizado!');
            updateSavedState({ leadData: lead });
        } catch (e) {
            lead[field] = previous;
            fillLeadInfoCard(lead);
            if (window.toast) window.toast(e.message || 'Erro ao salvar', 'err');
        }
    }

    function escapeHtml(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    async function openWaFloatingWidget(lead) {
        initPopupDOM();
        activeLead = lead;
        const popup = document.getElementById('waFloatPopup');
        const minBadge = document.getElementById('waMinBadge');
        const toolsPanel = document.getElementById('waToolsPanel');

        const state = getSavedState();
        if (state.posX != null && state.posY != null) {
            popup.style.right = 'auto';
            popup.style.left = `${Math.min(window.innerWidth - 390, Math.max(10, state.posX))}px`;
            popup.style.top = `${Math.min(window.innerHeight - 570, Math.max(10, state.posY))}px`;
        }

        const initials = (lead.name || ' ').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
        document.getElementById('waPopAvatar').textContent = initials;
        document.getElementById('waPopName').textContent = lead.name || 'Cliente';
        updateStepperUI(lead.status || 'novo');

        if (document.getElementById('wat-val')) {
            document.getElementById('wat-val').value = lead.valor_desejado || lead.limite_est || '';
        }

        fillLeadInfoCard(lead);

        if (state.isToolsOpen) {
            toolsPanel.style.display = 'flex';
        } else {
            toolsPanel.style.display = 'none';
        }

        if (state.isMinimized) {
            popup.style.display = 'none';
            minBadge.style.display = 'flex';
            document.getElementById('waMinName').textContent = lead.name || 'WhatsApp';
        } else {
            minBadge.style.display = 'none';
            popup.style.display = 'flex';
            if (window.anime) {
                window.anime({
                    targets: popup,
                    scale: [0.8, 1],
                    opacity: [0, 1],
                    duration: 350,
                    easing: 'easeOutBack'
                });
            }
        }

        updateSavedState({ isOpen: true, leadId: lead.id, leadData: lead });

        // Carrega histórico do lead
        await loadChatHistory(lead);
    }

    async function loadChatHistory(lead) {
        const msgBox = document.getElementById('waPopMessages');
        if (!msgBox) return;
        msgBox.innerHTML = '<div class="wa-msg-bubble in"><div>Carregando histórico...</div></div>';

        try {
            const api = window.api;
            if (!api) return;

            const [history, sends] = await Promise.all([
                api(`/leads/${lead.id}/history`).catch(() => []),
                api(`/sends?lead_id=${lead.id}`).catch(() => [])
            ]);

            let messages = [];

            messages.push({
                type: 'in',
                text: `Simulação iniciada para ${lead.name} (${lead.phone || 'Tel N/D'}). Cidade: ${lead.city || 'N/D'}.`,
                time: new Date(lead.created_at || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            });

            if (Array.isArray(sends)) {
                sends.forEach(s => {
                    messages.push({
                        type: 'out',
                        text: s.content || s.message || 'Mensagem enviada',
                        time: new Date(s.sent_at || s.created_at || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    });
                });
            }

            if (Array.isArray(history)) {
                history.forEach(h => {
                    if (h.details && h.details.includes('[WhatsApp Web]')) {
                        messages.push({
                            type: 'out',
                            text: h.details.replace('[WhatsApp Web]', '').trim(),
                            time: new Date(h.created_at || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        });
                    } else if (h.action) {
                        messages.push({
                            type: 'in',
                            text: `[Histórico] ${h.action}: ${h.details || ''}`,
                            time: new Date(h.created_at || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        });
                    }
                });
            }

            msgBox.innerHTML = messages.map(m => `
                <div class="wa-msg-bubble ${m.type}">
                    <div>${escapeHtml(m.text)}</div>
                    <div class="wa-msg-meta"><span>${m.time}</span> ${m.type === 'out' ? '<i class="fas fa-check-double" style="color:#34b7f1;"></i>' : ''}</div>
                </div>
            `).join('');

            msgBox.scrollTop = msgBox.scrollHeight;

        } catch (e) {
            msgBox.innerHTML = `<div class="wa-msg-bubble in"><div>Inicie uma nova mensagem com ${escapeHtml(lead.name)}.</div></div>`;
        }
    }

    // Restauração no F5
    async function restoreFromState() {
        const state = getSavedState();
        if (state.isOpen && state.leadData) {
            initPopupDOM();
            await openWaFloatingWidget(state.leadData);
        }
    }

    window.openWaFloatingWidget = openWaFloatingWidget;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', restoreFromState);
    } else {
        restoreFromState();
    }
})();
