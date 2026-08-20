const CONN_LABEL = { connected: 'CONECTADO', connecting: 'CONECTANDO', offline: 'OFFLINE', banned: 'BANIDO' };
const BAN_LABEL = { ativo: 'ATIVO', resfriado: 'RESFRIADO', banido: 'BANIDO' };
const WA_STATUS_LABEL = { novo: 'NOVO', contato: 'EM CONTATO', confirmado: 'CONFIRMADO', concluido: 'CONCLUÍDO', bloqueado: 'BLOQUEADO', duplicado: 'DUPLICADO' };
const WA_PRIO_LABEL = { alta: '★ Alta', media: '★ Média', baixa: '★ Baixa' };

const _pollers = new Map();
let _leads = [];
let _activeLead = null;

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
        });
    });

    // ================= WHATSAPP PREVIEW: LEADS LIST =================
    const leadListEl = document.getElementById('waLeadList');
    const searchInput = document.getElementById('waLeadSearch');

    async function loadLeads() {
        if (!leadListEl) return;
        try {
            const res = await api('/leads?limit=50').catch(() => []);
            _leads = Array.isArray(res) ? res : (res.leads || []);
            renderLeadList(_leads);
            if (_leads.length > 0 && !_activeLead) {
                selectLead(_leads[0]);
            }
        } catch (e) {
            leadListEl.innerHTML = `<div class="ps-empty" style="padding:20px; color:var(--bad);">Erro ao carregar leads</div>`;
        }
    }

    function renderLeadList(list) {
        if (!leadListEl) return;
        if (!list.length) {
            leadListEl.innerHTML = `<div class="ps-empty" style="padding:20px;">Nenhum lead encontrado</div>`;
            return;
        }
        leadListEl.innerHTML = list.map(l => {
            const initials = (l.name || 'L').split(' ').map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
            const isActive = _activeLead && _activeLead.id === l.id;
            const statusStr = WA_STATUS_LABEL[l.status] || 'NOVO';
            return `
                <div class="wa-lead-item ${isActive ? 'active' : ''}" data-lead-id="${l.id}">
                    <div class="wa-lead-avatar">${esc(initials)}</div>
                    <div class="wa-lead-info">
                        <div class="wa-lead-name">
                            <span>${esc(l.name || 'Sem nome')}</span>
                            <small style="font-size:.62rem; color:var(--primary); font-weight:900;">${esc(statusStr)}</small>
                        </div>
                        <div class="wa-lead-meta">
                            <span>${esc(l.phone || 'Sem telefone')}</span>
                            <span>${esc(l.city || '')}</span>
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
        searchInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase().trim();
            const filtered = _leads.filter(l =>
                (l.name || '').toLowerCase().includes(q) ||
                (l.phone || '').includes(q) ||
                (l.city || '').toLowerCase().includes(q)
            );
            renderLeadList(filtered);
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

        // Tools updates
        fillLeadInfoCard(lead);
        updateStepperUI(lead.status || 'novo');

        loadChatHistory(lead);
    }

    async function loadChatHistory(lead) {
        const msgBox = document.getElementById('waChatMessages');
        if (!msgBox) return;
        msgBox.innerHTML = '<div class="wa-msg-bubble in"><div>Carregando histórico do lead...</div></div>';

        try {
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
                    <div>${esc(m.text)}</div>
                    <div class="wa-msg-meta"><span>${m.time}</span> ${m.type === 'out' ? '<i class="fas fa-check-double" style="color:#34b7f1;"></i>' : ''}</div>
                </div>
            `).join('');

            msgBox.scrollTop = msgBox.scrollHeight;

        } catch (e) {
            msgBox.innerHTML = `<div class="wa-msg-bubble in"><div>Inicie uma nova mensagem com ${esc(lead.name)}.</div></div>`;
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
        bubble.innerHTML = `
            <div>${esc(msgText)}</div>
            <div class="wa-msg-meta"><span>${timeStr}</span> <i class="fas fa-check-double" style="color:#34b7f1;"></i></div>`;
        msgBox.appendChild(bubble);
        msgBox.scrollTop = msgBox.scrollHeight;
        chatInput.value = '';

        try {
            await api(`/leads/${_activeLead.id}/notes`, {
                method: 'POST',
                body: JSON.stringify({ note: `[WhatsApp Web] ${msgText}` })
            });
            if (toast) toast('Mensagem registrada no histórico!', 'ok');
        } catch (e) {}
    }

    if (sendBtn) sendBtn.onclick = sendMessage;
    if (chatInput) {
        chatInput.onkeydown = (e) => {
            if (e.key === 'Enter') sendMessage();
        };
    }

    // ================= QUICK CHIPS SYSTEM (LOCALSTORAGE + DRAG & DROP + PRIORIDADE) =================
    const STORAGE_CHIPS_KEY = 'prime_sul_quick_chips';
    const DEFAULT_QUICK_CHIPS = [
        { title: '👋 Saudação', text: 'Olá {nome}! Tudo bem? Como posso te ajudar na sua simulação hoje?' },
        { title: '⏱️ Aguarde', text: 'Estou analisando seu limite de crédito agora. Pode aguardar um minuto?' },
        { title: '✅ Aprovado', text: 'Seu cadastro foi aprovado com sucesso! Vamos concluir a contratação?' },
        { title: '📄 Documentos', text: 'Olá {nome}, para dar andamento preciso que envie foto do seu RG/CPF e comprovante de residência.' },
        { title: '🏦 Dados Bancários', text: 'Por favor, me informe sua chave PIX ou conta bancária para depósito do valor aprovado.' }
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
        if (modal.parentElement !== document.body) {
            document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
        modal.style.zIndex = '999999';
        resetQuickForm();
        renderQuickManageList();

        if (editIdx !== null && editIdx >= 0) {
            const chips = getQuickChips();
            const item = chips[editIdx];
            if (item && inputTitle && inputText && editIndexEl && formTitleEl) {
                inputTitle.value = item.title;
                inputText.value = item.text;
                editIndexEl.value = editIdx;
                formTitleEl.innerHTML = '<i class="fas fa-pen" style="color:var(--primary);"></i> EDITAR TEMPLATE';
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
        if (modal) modal.style.display = 'none';
    };
    if (closeQuickModalBtn) closeQuickModalBtn.onclick = closeQuickModal;
    if (doneQuickModalBtn) doneQuickModalBtn.onclick = closeQuickModal;

    function resetQuickForm() {
        if (inputTitle) inputTitle.value = '';
        if (inputText) inputText.value = '';
        if (editIndexEl) editIndexEl.value = '-1';
        if (formTitleEl) formTitleEl.innerHTML = '<i class="fas fa-plus-circle" style="color:var(--ok);"></i> ADICIONAR NOVO TEMPLATE';
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
            const badgeLabel = i === 0 ? '★ 1º Prioridade' : i === 1 ? '★ 2º Prioridade' : i === 2 ? '★ 3º Prioridade' : `Item ${i + 1}`;
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
            btn.onclick = (e) => {
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
                    if (confirm(`Excluir o template "${chips[idx].title}"?`)) {
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

    // Toggle tools button
    const toggleToolsBtn = document.getElementById('waToggleToolsBtn');
    const previewToolsPanel = document.getElementById('waPreviewTools');
    if (toggleToolsBtn && previewToolsPanel) {
        toggleToolsBtn.onclick = () => {
            const isHidden = getComputedStyle(previewToolsPanel).display === 'none';
            previewToolsPanel.style.display = isHidden ? 'flex' : 'none';
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
        if (prioEl) prioEl.textContent = WA_PRIO_LABEL[lead.prioridade] || '★ Média';

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
    }

    function updateStepperUI(currentStage) {
        document.querySelectorAll('#wapt-stepper .wa-tool-step-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.stage === currentStage);
        });
    }

    // Tool 1: Stepper
    document.querySelectorAll('#wapt-stepper .wa-tool-step-btn').forEach(btn => {
        btn.onclick = async () => {
            if (!_activeLead) return;
            const stage = btn.dataset.stage;
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
            const conn = n.connection;
            const effLimit = n.daily_limit_override || data.daily_limit;
            const pct = effLimit ? Math.min(100, Math.round((n.messages_sent / effLimit) * 100)) : 0;
            const barCls = n.status === 'banido' ? 'danger' : (n.status === 'resfriado' ? 'warn' : '');
            const cooledInfo = n.status === 'resfriado'
                ? (n.cooled_expired ? 'pronto para reativar' : `reativa ${new Date(n.cooled_until).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`)
                : `${n.messages_sent} / ${effLimit} msgs hoje${n.daily_limit_override ? ' (próprio)' : ''}`;

            const actions = [];
            if (conn === 'offline') actions.push(`<button class="bt-action ok" data-act="conectar" data-number="${n.number}"><i class="fas fa-plug"></i> CONECTAR</button>`);
            if (conn === 'connected' || conn === 'connecting') actions.push(`<button class="bt-action warn" data-act="desconectar" data-number="${n.number}"><i class="fas fa-unlink"></i> DESCONECTAR</button>`);
            if (n.status !== 'ativo') actions.push(`<button class="bt-action ok" data-act="reativar" data-id="${n.id}" data-number="${n.number}"><i class="fas fa-rotate-left"></i> REATIVAR</button>`);
            if (n.status !== 'banido') actions.push(`<button class="bt-action danger" data-act="banir" data-id="${n.id}"><i class="fas fa-skull"></i> BANIR</button>`);
            if (conn === 'offline') actions.push(`<button class="bt-action danger" data-act="remover" data-number="${n.number}"><i class="fas fa-trash"></i> REMOVER SESSÃO</button>`);

            const limitEditor = isAdmin ? `
                <div class="bt-limit-edit">
                    <label>Limite próprio</label>
                    <input type="number" min="1" class="bt-input" data-limit-id="${n.id}" placeholder="global (${data.daily_limit})" value="${n.daily_limit_override || ''}">
                    <button type="button" class="bt-action ok" data-act="salvar-limite" data-id="${n.id}"><i class="fas fa-check"></i></button>
                    ${n.daily_limit_override ? `<button type="button" class="bt-action warn" data-act="limpar-limite" data-id="${n.id}" title="Voltar ao global"><i class="fas fa-rotate-left"></i></button>` : ''}
                </div>` : '';

            const isSlot = n.slot_index != null;
            const heading = isSlot ? (n.realNumber ? fmtNum(n.realNumber) : (n.label || `WhatsApp ${n.slot_index}`)) : fmtNum(n.number);
            const subLabel = isSlot ? (n.realNumber ? (n.label || `WhatsApp ${n.slot_index}`) : 'aguardando conexão') : (n.label || 'sem etiqueta');

            return `
            <div class="bt-card" data-number="${n.number}">
                <div class="bt-card-head">
                    <div>
                        <span class="bt-num">${esc(heading)}</span>
                        <span class="bt-label">${esc(subLabel)}</span>
                        ${n.connection === 'connected' && n.realNumber && n.pushName ? `<span class="bt-label" style="display:block;color:var(--ok,#10b981);">${esc(n.pushName)}</span>` : ''}
                    </div>
                    <div class="bt-badges">
                        <span class="bt-badge conn-${conn}"><i class="fas fa-circle"></i> ${CONN_LABEL[conn]}</span>
                        <span class="bt-badge ban-${n.status}">${BAN_LABEL[n.status]}</span>
                    </div>
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
                wrap.innerHTML = `<img src="${res.qr}" alt="QR"><span><i class="fab fa-whatsapp"></i> Escaneie com o WhatsApp</span>`;
            } else {
                wrap.classList.remove('show');
                wrap.innerHTML = '';
                if (res.status !== 'connecting') { stopQrPoll(number); refresh(); }
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
                    else toast('Conectando... aguarde o QR', 'info');
                } else if (act === 'desconectar') {
                    await api('/whatsapp/disconnect', { method: 'POST', body: JSON.stringify({ number: btn.dataset.number }) });
                    toast('Desconectado', 'info');
                } else if (act === 'banir') {
                    if (!confirm('Banir este número? Ele sai de circulação permanentemente.')) { btn.disabled = false; return; }
                    await api(`/campaigns/numbers/${btn.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'banido' }) });
                    toast('Número banido', 'err');
                } else if (act === 'remover') {
                    if (!confirm('Remover sessão deste número? O WhatsApp será deslogado.')) { btn.disabled = false; return; }
                    await api('/whatsapp/disconnect', { method: 'POST', body: JSON.stringify({ number: btn.dataset.number, removeSession: true }) });
                    toast('Sessão removida', 'info');
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

    // Initial load
    await loadLeads();
    await refresh();
    return {};
}

export async function destroy() {
    for (const [, id] of _pollers) clearInterval(id);
    _pollers.clear();
    const modal = document.getElementById('waQuickModal');
    if (modal) modal.remove();
}
