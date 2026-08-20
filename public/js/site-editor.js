/**
 * AI SITE EDITOR — ferramenta TEMPORÁRIA só pro admin editar o front-end mais
 * rápido: seleciona um elemento na página, descreve a mudança, a IA (NVIDIA
 * NIM) devolve o trecho editado, você aplica direto no arquivo em public/.
 *
 * Pra remover depois: apague este arquivo, o <script> que o carrega no
 * admin.html, e a rota /api/ai-editor (server/routes/ai-editor.js + a linha
 * de app.use no server.js).
 */
(function () {
    'use strict';
    if (window.__siteEditorLoaded) return;
    window.__siteEditorLoaded = true;

    let me = null;
    try { me = JSON.parse(localStorage.getItem('prime_sul_user') || 'null'); } catch (e) {}
    if (!me || me.role !== 'admin') return; // ferramenta só pro superadmin

    const API = '/api/ai-editor';
    async function api(path, opts = {}) {
        const res = await fetch(API + path, { ...opts, headers: { 'Content-Type': 'application/json' } });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Erro');
        return data;
    }

    let picking = false;
    let selectedEl = null;
    let currentBefore = '';
    let currentAfter = '';
    let currentFile = '';
    let hoverEl = null;

    // ---------- UI ----------
    const root = document.createElement('div');
    root.id = 'se-root';
    root.innerHTML = `
    <style>
      #se-root, #se-root * { box-sizing: border-box; font-family: 'Outfit', system-ui, sans-serif; }
      #se-fab { position: fixed; bottom: 24px; left: 24px; z-index: 2147483000; width: 52px; height: 52px;
        border-radius: 50%; border: 2.5px solid #181716; background: #8b5cf6; color: #fff; font-size: 20px;
        cursor: pointer; box-shadow: 4px 4px 0 #181716; display: flex; align-items: center; justify-content: center;
        transition: transform .15s ease; }
      #se-fab:hover { transform: translate(-2px,-2px); box-shadow: 6px 6px 0 #181716; }
      #se-panel { position: fixed; bottom: 86px; left: 24px; z-index: 2147483001; width: 380px; max-width: calc(100vw - 32px);
        max-height: 74vh; background: #fff; border: 2.5px solid #181716; border-radius: 16px;
        box-shadow: 6px 6px 0 #181716; display: none; flex-direction: column; overflow: hidden; }
      #se-panel.open { display: flex; }
      #se-head { background: #181716; color: #fff; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; }
      #se-head b { font-size: 12px; letter-spacing: .5px; display: flex; align-items: center; gap: 6px; }
      #se-head b i { color: #a78bfa; }
      #se-close { background: none; border: none; color: #fff; cursor: pointer; font-size: 14px; }
      #se-body { padding: 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; font-size: 12px; }
      #se-body label { font-weight: 800; font-size: 10px; letter-spacing: .5px; color: #181716; text-transform: uppercase; display: block; margin-bottom: 4px; }
      #se-file { width: 100%; padding: 6px 8px; border: 1.5px solid #181716; border-radius: 8px; font-size: 11px; }
      #se-pick { width: 100%; padding: 8px; border: 1.5px solid #181716; border-radius: 8px; background: #fff; font-weight: 800; cursor: pointer; font-size: 11px; }
      #se-pick.on { background: #8b5cf6; color: #fff; }
      #se-snippet { background: #f8f7f5; border: 1.5px dashed #cbd5e1; border-radius: 8px; padding: 6px 8px; font-family: monospace; font-size: 10px; max-height: 80px; overflow: auto; white-space: pre-wrap; word-break: break-all; color: #475569; }
      #se-prompt { width: 100%; min-height: 60px; padding: 8px; border: 1.5px solid #181716; border-radius: 8px; font-size: 12px; resize: vertical; }
      #se-preview { display: none; flex-direction: column; gap: 6px; }
      #se-after { background: #f0fdf4; border: 1.5px solid #16a34a; border-radius: 8px; padding: 6px 8px; font-family: monospace; font-size: 10px; max-height: 140px; overflow: auto; white-space: pre-wrap; word-break: break-all; }
      .se-row { display: flex; gap: 6px; }
      .se-btn { flex: 1; padding: 8px; border: 1.5px solid #181716; border-radius: 8px; background: #fff; font-weight: 800; cursor: pointer; font-size: 11px; }
      .se-btn:hover { background: #f5f5f4; }
      .se-btn.primary { background: #16a34a; color: #fff; }
      .se-btn.danger { background: #ef4444; color: #fff; }
      .se-btn:disabled { opacity: .5; cursor: default; }
      #se-status { font-size: 10px; color: #78716c; min-height: 14px; }
      #se-status.err { color: #dc2626; font-weight: 700; }
      #se-history { display: flex; flex-direction: column; gap: 4px; max-height: 120px; overflow-y: auto; }
      .se-hist-item { border: 1px solid #e7e2da; border-radius: 6px; padding: 4px 6px; font-size: 10px; color: #57534e; }
      .se-hist-item b { color: #181716; }
      .se-highlight { outline: 2px solid #8b5cf6 !important; outline-offset: 1px; }
    </style>
    <button id="se-fab" title="AI Site Editor (temporário)"><i class="fas fa-wand-magic-sparkles"></i></button>
    <div id="se-panel">
      <div id="se-head"><b><i class="fas fa-wand-magic-sparkles"></i> AI SITE EDITOR</b><button id="se-close">✕</button></div>
      <div id="se-body">
        <div>
          <label>Arquivo</label>
          <select id="se-file"><option value="">Carregando...</option></select>
        </div>
        <button id="se-pick" type="button"><i class="fas fa-crosshairs"></i> SELECIONAR ELEMENTO NA PÁGINA</button>
        <div id="se-snippet-wrap" style="display:none;">
          <label>Trecho selecionado</label>
          <div id="se-snippet"></div>
        </div>
        <div id="se-prompt-wrap" style="display:none;">
          <label>O que mudar?</label>
          <textarea id="se-prompt" placeholder="Ex: deixa esse botão vermelho e maior"></textarea>
          <div class="se-row" style="margin-top:6px;">
            <button class="se-btn primary" id="se-go" type="button"><i class="fas fa-bolt"></i> PREVER</button>
          </div>
        </div>
        <div id="se-preview">
          <label>Resultado da IA</label>
          <div id="se-after"></div>
          <div class="se-row">
            <button class="se-btn primary" id="se-apply" type="button"><i class="fas fa-check"></i> APLICAR</button>
            <button class="se-btn" id="se-cancel" type="button">CANCELAR</button>
          </div>
        </div>
        <div id="se-status"></div>
        <div>
          <label>Últimas edições</label>
          <div class="se-row" style="margin-bottom:6px;">
            <button class="se-btn danger" id="se-undo" type="button"><i class="fas fa-rotate-left"></i> DESFAZER ÚLTIMA (arquivo atual)</button>
          </div>
          <div id="se-history"></div>
        </div>
      </div>
    </div>`;
    document.body.appendChild(root);

    const $ = sel => root.querySelector(sel);
    const fab = $('#se-fab');
    const panel = $('#se-panel');
    const fileSel = $('#se-file');
    const pickBtn = $('#se-pick');
    const snippetWrap = $('#se-snippet-wrap');
    const snippetEl = $('#se-snippet');
    const promptWrap = $('#se-prompt-wrap');
    const promptEl = $('#se-prompt');
    const goBtn = $('#se-go');
    const previewEl = $('#se-preview');
    const afterEl = $('#se-after');
    const applyBtn = $('#se-apply');
    const cancelBtn = $('#se-cancel');
    const statusEl = $('#se-status');
    const undoBtn = $('#se-undo');
    const historyEl = $('#se-history');

    function setStatus(msg, isErr) {
        statusEl.textContent = msg || '';
        statusEl.className = isErr ? 'err' : '';
    }

    function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }

    fab.onclick = () => { panel.classList.toggle('open'); if (panel.classList.contains('open')) loadHistory(); };
    $('#se-close').onclick = () => panel.classList.remove('open');

    async function loadFiles() {
        try {
            const files = await api('/files');
            fileSel.innerHTML = files.map(f => `<option value="${f}">${f}</option>`).join('');
        } catch (e) { fileSel.innerHTML = `<option value="">Erro ao carregar arquivos</option>`; }
    }
    loadFiles();

    async function loadHistory() {
        try {
            const hist = await api('/history');
            historyEl.innerHTML = hist.length ? hist.map(h => `
                <div class="se-hist-item"><b>${h.file}</b><br>${h.prompt ? escapeHtml(h.prompt) : '(sem descrição)'}<br><span style="color:#a8a29e;">${new Date(h.at).toLocaleString('pt-BR')}</span></div>
            `).join('') : '<div style="color:#a8a29e;">Nenhuma edição ainda.</div>';
        } catch (e) { historyEl.innerHTML = ''; }
    }

    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

    // ---------- Seleção de elemento na página ----------
    function onMouseOver(e) {
        if (root.contains(e.target)) return;
        if (hoverEl) hoverEl.classList.remove('se-highlight');
        hoverEl = e.target;
        hoverEl.classList.add('se-highlight');
    }
    function onClickPick(e) {
        if (root.contains(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        selectedEl = e.target;
        currentBefore = selectedEl.outerHTML;
        snippetEl.textContent = truncate(currentBefore, 600);
        snippetWrap.style.display = 'block';
        promptWrap.style.display = 'block';
        previewEl.style.display = 'none';
        setStatus('');
        stopPicking();
    }
    function startPicking() {
        if (!fileSel.value) { setStatus('Escolha o arquivo primeiro.', true); return; }
        picking = true;
        pickBtn.classList.add('on');
        pickBtn.textContent = 'CLIQUE NO ELEMENTO...';
        document.addEventListener('mouseover', onMouseOver, true);
        document.addEventListener('click', onClickPick, true);
    }
    function stopPicking() {
        picking = false;
        pickBtn.classList.remove('on');
        pickBtn.innerHTML = '<i class="fas fa-crosshairs"></i> SELECIONAR ELEMENTO NA PÁGINA';
        document.removeEventListener('mouseover', onMouseOver, true);
        document.removeEventListener('click', onClickPick, true);
        if (hoverEl) { hoverEl.classList.remove('se-highlight'); hoverEl = null; }
    }
    pickBtn.onclick = () => picking ? stopPicking() : startPicking();

    goBtn.onclick = async () => {
        const prompt = promptEl.value.trim();
        if (!prompt) { setStatus('Descreva a mudança.', true); return; }
        currentFile = fileSel.value;
        goBtn.disabled = true;
        setStatus('Pensando...');
        try {
            const r = await api('/preview', { method: 'POST', body: JSON.stringify({ file: currentFile, before: currentBefore, prompt }) });
            currentAfter = r.after;
            afterEl.textContent = truncate(currentAfter, 1200);
            previewEl.style.display = 'flex';
            setStatus('Prévia pronta — revise antes de aplicar.');
        } catch (e) { setStatus(e.message, true); }
        goBtn.disabled = false;
    };

    cancelBtn.onclick = () => {
        previewEl.style.display = 'none';
        currentAfter = '';
    };

    applyBtn.onclick = async () => {
        applyBtn.disabled = true;
        setStatus('Aplicando...');
        try {
            await api('/apply', { method: 'POST', body: JSON.stringify({ file: currentFile, before: currentBefore, after: currentAfter, prompt: promptEl.value.trim() }) });
            // reflete a mudança na página aberta agora, se o elemento ainda existir
            try {
                if (selectedEl && selectedEl.isConnected) {
                    const tmp = document.createElement('div');
                    tmp.innerHTML = currentAfter;
                    if (tmp.firstElementChild) selectedEl.replaceWith(tmp.firstElementChild);
                }
            } catch (e) { /* replace visual best-effort; arquivo já foi salvo */ }
            setStatus('Aplicado! (se não refletiu na tela, recarregue a página)');
            previewEl.style.display = 'none';
            snippetWrap.style.display = 'none';
            promptWrap.style.display = 'none';
            promptEl.value = '';
            selectedEl = null;
            loadHistory();
        } catch (e) { setStatus(e.message, true); }
        applyBtn.disabled = false;
    };

    undoBtn.onclick = async () => {
        if (!fileSel.value) { setStatus('Escolha o arquivo pra desfazer.', true); return; }
        undoBtn.disabled = true;
        setStatus('Desfazendo...');
        try {
            await api('/undo', { method: 'POST', body: JSON.stringify({ file: fileSel.value }) });
            setStatus('Desfeito! Recarregue a página pra ver o estado revertido.');
            loadHistory();
        } catch (e) { setStatus(e.message, true); }
        undoBtn.disabled = false;
    };

    document.addEventListener('keydown', e => { if (e.key === 'Escape' && picking) stopPicking(); });
})();
