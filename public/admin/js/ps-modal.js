/**
 * PRIME SUL — Sistema Modal Centralizado (psm-*)
 * Um único componente de popup para todos os módulos do admin.
 * Suporta stack (vários overlays abertos, o de cima fecha primeiro),
 * fechamento por ESC, clique no backdrop e botão X.
 *
 * Uso:
 *   const m = PSModal({
 *     title: 'NOVO LEAD',
 *     eyebrow: 'CADASTRO',
 *     subtitle: 'Preencha os dados',          // opcional
 *     width: '720px',                          // opcional; default min(720px, 96vw)
 *     body: (el) => {...} ou '<div>...</div>', // HTML ou callback que recebe o body
 *     footer: (el) => [...],                   // opcional, mesma regra
 *     onClose: () => {...}                     // opcional
 *   });
 *   m.open();
 *   m.close();
 *
 * Todos os modais são Neo-Brutalista claro (CSS: /admin/css/ps-modal.css).
 */
(function () {
    'use strict';
    const stack = [];    // pilha de modais abertos (o último é o de cima)
    let zBase = 13100;   // base de z-index; cada camada sobe +10

    const esc = s => String(s ?? '').replace(/[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function fill(target, content) {
        if (content == null) return;
        if (typeof content === 'string') { target.innerHTML = content; return; }
        if (content instanceof HTMLElement) { target.appendChild(content); return; }
        if (typeof content === 'function') { content(target); }
    }

    function PSModal(opts) {
        opts = opts || {};
        const overlay = document.createElement('div');
        overlay.className = 'psm-overlay';
        overlay.style.zIndex = zBase + stack.length * 10;
        overlay.innerHTML = `
            <div class="psm-modal"${opts.width ? ` style="width:${esc(opts.width === 'full' ? 'min(1180px, 96vw)' : opts.width)};"` : ''} role="dialog" aria-modal="true">
                <div class="psm-header">
                    <div class="psm-header-text">
                        ${opts.eyebrow ? `<span class="psm-eyebrow">${esc(opts.eyebrow)}</span>` : ''}
                        <h3>${esc(opts.title || 'MODAL')}</h3>
                        ${opts.subtitle ? `<p>${esc(opts.subtitle)}</p>` : ''}
                    </div>
                    <button type="button" class="psm-btn-close" aria-label="Fechar"><i class="fas fa-times"></i></button>
                </div>
                <div class="psm-body"></div>
                <div class="psm-footer" style="display:none;"></div>
            </div>`;

        const modal   = overlay.querySelector('.psm-modal');
        const body    = overlay.querySelector('.psm-body');
        const footer  = overlay.querySelector('.psm-footer');
        fill(body, opts.body);
        if (opts.footer != null) { footer.style.display = ''; fill(footer, opts.footer); }

        let opened = false;
        const api = {
            overlay, modal, body, footer,
            open() {
                if (opened) return; opened = true;
                document.body.appendChild(overlay);
                overlay.classList.add('active');
                if (!stack.includes(api)) stack.push(api);
            },
            close() {
                if (!opened) return; opened = false;
                overlay.classList.remove('active');
                overlay.remove();
                const i = stack.indexOf(api);
                if (i >= 0) stack.splice(i, 1);
                if (typeof opts.onClose === 'function') opts.onClose();
            },
            isOpen: () => opened
        };

        overlay.querySelector('.psm-btn-close').addEventListener('click', () => api.close());
        overlay.addEventListener('mousedown', e => { if (e.target === overlay) api.close(); });
        return api;
    }

    // ESC: fecha só o modal do topo e interrompe a propagação,
    // para o admin.html não fechar o painel inteiro junto.
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape' || stack.length === 0) return;
        e.stopPropagation();
        stack[stack.length - 1].close();
    }, true);

    window.PSModal = PSModal;
})();
