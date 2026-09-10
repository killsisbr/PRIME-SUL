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

    // Modal de Confirmação visual moderno (substitui window.confirm nativo)
    PSModal.confirm = function (opts) {
        if (typeof opts === 'string') {
            opts = { message: opts };
        }
        opts = opts || {};
        return new Promise(resolve => {
            let handled = false;
            const type = opts.type || 'danger'; // 'danger' | 'warn' | 'info' | 'ok'
            const iconMap = {
                danger: 'fa-triangle-exclamation',
                warn: 'fa-triangle-exclamation',
                info: 'fa-circle-info',
                ok: 'fa-circle-check',
                ban: 'fa-skull',
                trash: 'fa-trash-can'
            };
            const icon = opts.icon || iconMap[type] || 'fa-circle-question';
            const confirmBtnClass = (type === 'danger' || type === 'ban' || type === 'trash') ? 'psm-btn-danger' : (type === 'ok' ? 'psm-btn-success' : '');

            const m = PSModal({
                title: opts.title || (type === 'danger' ? 'CONFIRMAR AÇÃO' : 'CONFIRMAÇÃO'),
                eyebrow: opts.eyebrow || (type === 'danger' ? 'ATENÇÃO' : 'CONFIRME'),
                subtitle: opts.subtitle || '',
                width: opts.width || '480px',
                onClose: () => {
                    if (!handled) { handled = true; resolve(false); }
                },
                body: (bodyEl) => {
                    bodyEl.className = 'psm-body psm-confirm-body';
                    bodyEl.innerHTML = `
                        <div class="psm-confirm-wrap">
                            <div class="psm-confirm-icon ${type}">
                                <i class="fas ${icon}"></i>
                            </div>
                            <div class="psm-confirm-text">
                                <h4>${esc(opts.message || 'Deseja realmente continuar?')}</h4>
                                ${opts.description ? `<p>${esc(opts.description)}</p>` : ''}
                            </div>
                        </div>
                    `;
                },
                footer: (footEl) => {
                    footEl.className = 'psm-footer psm-confirm-footer';
                    const cancelBtn = document.createElement('button');
                    cancelBtn.type = 'button';
                    cancelBtn.className = 'psm-btn psm-btn-ghost';
                    cancelBtn.textContent = opts.cancelText || 'Cancelar';
                    cancelBtn.onclick = () => {
                        if (!handled) { handled = true; resolve(false); }
                        m.close();
                    };

                    const okBtn = document.createElement('button');
                    okBtn.type = 'button';
                    okBtn.className = `psm-btn ${confirmBtnClass}`;
                    okBtn.innerHTML = (opts.confirmIcon ? `<i class="fas ${opts.confirmIcon}"></i> ` : '') + esc(opts.confirmText || (type === 'danger' ? 'Sim, confirmar' : 'Confirmar'));
                    okBtn.onclick = () => {
                        if (!handled) { handled = true; resolve(true); }
                        m.close();
                    };

                    footEl.appendChild(cancelBtn);
                    footEl.appendChild(okBtn);
                    setTimeout(() => {
                        if (opts.focusConfirm) okBtn.focus();
                        else cancelBtn.focus();
                    }, 50);
                }
            });
            m.open();
        });
    };

    // ESC: fecha só o modal do topo e interrompe a propagação,
    // para o admin.html não fechar o painel inteiro junto.
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape' || stack.length === 0) return;
        e.stopPropagation();
        stack[stack.length - 1].close();
    }, true);

    window.PSModal = PSModal;
    window.confirmModal = PSModal.confirm;
    window.confirmDialog = PSModal.confirm;
})();
