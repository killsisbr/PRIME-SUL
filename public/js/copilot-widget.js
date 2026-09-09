// ============================================================================
// PRIME SUL — COPILOT IA FLOATING WIDGET (JS)
// Assistente inteligente com tools em tempo real para Vendedor & Admin
// ============================================================================
(function () {
    if (window.__primeCopilotLoaded) return;
    window.__primeCopilotLoaded = true;

    // Estado local
    let isOpen = false;
    let isBusy = false;
    let userRole = 'vendedor';
    let userName = 'Operador';
    let conversationHistory = [];

    // Helper para obter token de autenticação
    function getToken() {
        return localStorage.getItem('token') || '';
    }

    // Simple markdown renderer
    function renderMarkdown(md) {
        if (!md) return '';
        let escaped = md
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Code blocks ```code```
        escaped = escaped.replace(/```([\s\S]*?)```/g, function (match, code) {
            const cleanCode = code.trim();
            const copyId = 'copy_' + Math.random().toString(36).substring(2, 9);
            window.__copilotSnippets = window.__copilotSnippets || {};
            window.__copilotSnippets[copyId] = cleanCode;
            return `<pre><code>${cleanCode}</code></pre><button class="copilot-card-action-btn" onclick="window.copilotCopySnippet('${copyId}')">📋 Copiar Mensagem</button>`;
        });

        // Inline code `code`
        escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Bold **text**
        escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Italic *text* or _text_
        escaped = escaped.replace(/(\*|_)([^*_]+)\1/g, '<em>$2</em>');

        // Links [text](url)
        escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

        // Newlines to <br> or <p>
        const lines = escaped.split('\n');
        return lines.join('<br>');
    }

    window.copilotCopySnippet = function (snippetId) {
        const text = window.__copilotSnippets?.[snippetId];
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            showToast('Texto copiado com sucesso! 📋');
        }).catch(() => {
            showToast('Erro ao copiar');
        });
    };

    function showToast(msg) {
        const win = document.getElementById('copilot-window');
        if (!win) return;
        const toast = document.createElement('div');
        toast.className = 'copilot-toast';
        toast.textContent = msg;
        win.appendChild(toast);
        setTimeout(() => toast.remove(), 1900);
    }

    // Injeção do HTML do Widget no DOM
    function injectWidgetHtml() {
        const wrapper = document.createElement('div');
        wrapper.id = 'copilot-root';
        wrapper.innerHTML = `
            <!-- Botão Launcher Flutuante -->
            <button id="copilot-launcher" title="Abrir Copilot IA Prime Sul">
                <span class="copilot-launcher-icon">🤖</span>
                <span>Copilot IA</span>
                <span class="copilot-pulse-dot"></span>
            </button>

            <!-- Janela do Chat Flutuante -->
            <div id="copilot-window" class="hidden">
                <!-- Header -->
                <div class="copilot-header">
                    <div class="copilot-brand">
                        <div class="copilot-avatar">🤖</div>
                        <div class="copilot-titles">
                            <div class="copilot-title-row">
                                <span class="copilot-title">Prime Copilot</span>
                                <span id="copilot-role-badge" class="copilot-badge">VENDEDOR</span>
                            </div>
                            <span class="copilot-status-sub">IA Conectada com Tools Ativas</span>
                        </div>
                    </div>
                    <div class="copilot-actions">
                        <button class="copilot-btn-icon" id="copilot-btn-clear" title="Limpar conversa">🧹</button>
                        <button class="copilot-btn-icon" id="copilot-btn-minimize" title="Minimizar">─</button>
                    </div>
                </div>

                <!-- Chips Bar (Ferramentas Rápidas) -->
                <div class="copilot-quickbar">
                    <button class="copilot-chip" data-quick="🔎 Buscar leads recentes">🔎 Buscar Leads</button>
                    <button class="copilot-chip" data-quick="✨ Criar abordagem WhatsApp de crédito">✨ Abordagem</button>
                    <button class="copilot-chip" data-quick="📊 Ver métricas e desempenho do funil">📊 Métricas</button>
                    <button class="copilot-chip" data-quick="🛡️ Status anti-ban e saúde dos bots">🛡️ Anti-Ban</button>
                </div>

                <!-- Corpo de Mensagens -->
                <div class="copilot-body" id="copilot-messages"></div>

                <!-- Rodapé / Input -->
                <div class="copilot-footer">
                    <div class="copilot-input-row">
                        <input type="text" id="copilot-input" class="copilot-input" placeholder="Pergunte ao Copilot ou execute uma tool..." autocomplete="off" />
                        <button id="copilot-btn-send" class="copilot-send-btn" title="Enviar mensagem">➤</button>
                    </div>
                    <div class="copilot-suggestions">
                        <span style="opacity:0.6;">Sugestões:</span>
                        <span class="copilot-sug-item" data-quick="Mover lead #1 para sim">Mover lead para SIM</span>
                        <span class="copilot-sug-item" data-quick="Minhas métricas hoje">Métricas hoje</span>
                        <span class="copilot-sug-item" data-quick="Abordagem FGTS">Copy FGTS</span>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(wrapper);

        // Detectar perfil
        detectUserProfile();
        bindEvents();
        appendWelcomeMessage();
    }

    async function detectUserProfile() {
        try {
            const token = getToken();
            const res = await fetch('/api/copilot/tools', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                if (data?.user) {
                    userName = data.user.name || 'Usuário';
                    userRole = data.user.role || 'seller';
                    const badge = document.getElementById('copilot-role-badge');
                    if (badge) {
                        badge.textContent = userRole === 'admin' ? 'ADMIN' : 'VENDEDOR';
                        if (userRole === 'admin') badge.classList.add('admin');
                    }
                }
            }
        } catch (e) {
            // Silencioso se offline
        }
    }

    function appendWelcomeMessage() {
        const welcome = `👋 Olá! Sou o **Prime Copilot IA**.\nEstou conectado ao CRM em tempo real com **ferramentas ativas**:\n\n• 🔎 **Buscar Leads** e detalhes da ficha\n• 🔄 **Mover Estágios** do funil comercial\n• ✨ **Criar Abordagens** persuasivas WhatsApp\n• 📊 **Métricas do Funil** e conversão em tempo real\n• 🛡️ **Monitorar Anti-Ban** e capacidade de disparos\n\n_Dica: Clique nos botões acima ou digite o que precisa!_`;
        addMessage('bot', welcome);
    }

    function toggleWindow(force) {
        const win = document.getElementById('copilot-window');
        if (!win) return;
        isOpen = typeof force === 'boolean' ? force : !isOpen;
        if (isOpen) {
            win.classList.remove('hidden');
            const input = document.getElementById('copilot-input');
            if (input) setTimeout(() => input.focus(), 150);
        } else {
            win.classList.add('hidden');
        }
    }

    function addMessage(sender, text, toolName) {
        const container = document.getElementById('copilot-messages');
        if (!container) return;

        const msgEl = document.createElement('div');
        msgEl.className = `copilot-msg ${sender}`;

        let toolBadgeHtml = '';
        if (toolName) {
            toolBadgeHtml = `<div class="copilot-tool-badge">⚡ Tool: ${toolName}</div>`;
        }

        const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        msgEl.innerHTML = `
            ${toolBadgeHtml}
            <div class="copilot-bubble">${renderMarkdown(text)}</div>
            <span class="copilot-time">${time}</span>
        `;
        container.appendChild(msgEl);
        container.scrollTop = container.scrollHeight;
    }

    function showTyping() {
        const container = document.getElementById('copilot-messages');
        if (!container) return;
        const typing = document.createElement('div');
        typing.id = 'copilot-typing-indicator';
        typing.className = 'copilot-msg bot';
        typing.innerHTML = `
            <div class="copilot-typing">
                <div class="copilot-typing-dot"></div>
                <div class="copilot-typing-dot"></div>
                <div class="copilot-typing-dot"></div>
            </div>
        `;
        container.appendChild(typing);
        container.scrollTop = container.scrollHeight;
    }

    function removeTyping() {
        const typing = document.getElementById('copilot-typing-indicator');
        if (typing) typing.remove();
    }

    async function sendMessage(text) {
        if (!text || !text.trim() || isBusy) return;
        const clean = text.trim();
        const input = document.getElementById('copilot-input');
        if (input) input.value = '';

        addMessage('user', clean);
        conversationHistory.push({ role: 'user', content: clean });
        isBusy = true;
        showTyping();

        try {
            const token = getToken();
            const res = await fetch('/api/copilot/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    message: clean,
                    conversationHistory: conversationHistory.slice(-6)
                })
            });

            removeTyping();

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                addMessage('bot', `⚠️ Não consegui processar: ${errData.error || 'Erro na comunicação'}`);
                return;
            }

            const data = await res.json();
            const botReply = data.reply || 'Processado com sucesso!';
            addMessage('bot', botReply, data.tool);
            conversationHistory.push({ role: 'assistant', content: botReply });

        } catch (e) {
            removeTyping();
            addMessage('bot', '⚠️ Falha ao conectar ao servidor do Copilot. Verifique se sua sessão está ativa.');
        } finally {
            isBusy = false;
        }
    }

    function bindEvents() {
        const launcher = document.getElementById('copilot-launcher');
        const btnMinimize = document.getElementById('copilot-btn-minimize');
        const btnClear = document.getElementById('copilot-btn-clear');
        const btnSend = document.getElementById('copilot-btn-send');
        const input = document.getElementById('copilot-input');

        if (launcher) launcher.addEventListener('click', () => toggleWindow());
        if (btnMinimize) btnMinimize.addEventListener('click', () => toggleWindow(false));

        if (btnClear) {
            btnClear.addEventListener('click', () => {
                const container = document.getElementById('copilot-messages');
                if (container) container.innerHTML = '';
                conversationHistory = [];
                appendWelcomeMessage();
                showToast('Conversa reiniciada 🧹');
            });
        }

        if (btnSend && input) {
            btnSend.addEventListener('click', () => sendMessage(input.value));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    sendMessage(input.value);
                } else if (e.key === 'Escape') {
                    toggleWindow(false);
                }
            });
        }

        // Delegated clicks para chips e sugestões
        document.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-quick]');
            if (chip) {
                const quickText = chip.getAttribute('data-quick');
                if (quickText) {
                    if (!isOpen) toggleWindow(true);
                    sendMessage(quickText);
                }
            }
        });
    }

    // Inicialização ao carregar o DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectWidgetHtml);
    } else {
        injectWidgetHtml();
    }
})();
