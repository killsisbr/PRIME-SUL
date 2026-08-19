/* ============ PRIME SUL — Vitrine JS ============ */
(function () {
    'use strict';

    const state = {
        products: [],
        active: null,
        productsMap: {
            emprestimo: { min: 1000, max: 500000, step: 1000 },
            consignado: { min: 500, max: 500000, step: 1000 },
            consorcio: { min: 20000, max: 500000, step: 5000 }
        }
    };

    const $ = (id) => document.getElementById(id);

    function fmtMoney(v) {
        return 'R$ ' + Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    }

    function escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // ---------- Toast ----------
    function toast(msg, type) {
        let wrap = $('vitrineToastWrap');
        const el = document.createElement('div');
        el.className = 'vitrine-toast' + (type === 'err' ? ' err' : '');
        const i = document.createElement('i');
        i.className = type === 'err' ? 'fas fa-triangle-exclamation' : 'fas fa-circle-check';
        const span = document.createElement('span');
        span.textContent = msg;
        el.append(i, span);
        wrap.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .2s'; setTimeout(() => el.remove(), 220); }, 3400);
    }
    window.vitrineToast = toast;

    // ---------- Carregar produtos ----------
    async function loadProducts() {
        try {
            const res = await fetch('/api/public/products');
            state.products = await res.json();
            renderCards();
            renderNav();
            renderBenefits();
        } catch (e) {
            console.error('[vitrine] falha ao carregar produtos:', e);
        }
    }

    function renderNav() {
        const nav = $('vitrineLinks');
        nav.innerHTML = state.products.map(p =>
            `<a href="javascript:void(0)" onclick="Vitrine.open('${p.id}')"><i class="fas ${p.icone}"></i> ${p.name}</a>`
        ).join('');
    }

    function renderCards() {
        const cards = $('vitrineCards');
        cards.innerHTML = state.products.map((p, i) => `
            <div class="vitrine-card" onclick="Vitrine.open('${p.id}')" tabindex="0" role="button" aria-label="${p.name}">
                <div class="vitrine-card-num">${String(i + 1).padStart(2, '0')}</div>
                <div class="vitrine-card-icon" style="background:${p.cor};"><i class="fas ${p.icone}"></i></div>
                <div class="vitrine-card-body">
                    <div class="vitrine-card-name">${p.name}</div>
                    <div class="vitrine-card-tagline">${p.tagline}</div>
                    <div class="vitrine-card-desc">${p.desc}</div>
                </div>
                <div class="vitrine-card-cta">ACESSAR <i class="fas fa-arrow-right"></i></div>
            </div>`).join('');
    }

    function renderBenefits() {
        // renderização dinâmica por produto ao abrir o popup
    }

    // ---------- Popup principal ----------
    function open(id) {
        const p = state.products.find(x => x.id === id) || state.products[0];
        if (!p) return;
        state.active = p;

        const range = state.productsMap[p.id] || state.productsMap.emprestimo;

        $('popupInfoIcon').style.background = p.cor;
        $('popupInfoIcon').innerHTML = `<i class="fas ${p.icone}"></i>`;
        $('popupInfoTagline').textContent = p.tagline;
        $('popupInfoTitle').textContent = p.name;
        $('popupInfoDesc').textContent = p.desc;
        $('popupInfoBenefits').innerHTML = (p.beneficios || []).map(b => `<li><i class="fas fa-check"></i> ${b}</li>`).join('');

        const slider = $('valorSlider');
        slider.min = range.min;
        slider.max = range.max;
        slider.step = range.step;
        slider.value = Math.round((range.min + range.max) / 2 / range.step) * range.step;
        $('sliderValue').textContent = fmtMoney(slider.value);

        $('fProduct').value = p.id;
        $('fValor').value = slider.value;

        // número do produto no badge do popup
        const idx = state.products.findIndex(x => x.id === p.id);
        const badge = $('popupInfoNum');
        if (badge) badge.textContent = String(idx + 1).padStart(2, '0');

        $('leadOverlay').classList.add('open');
        document.body.style.overflow = 'hidden';
        setTimeout(() => $('fNome').focus(), 180);
    }

    function close() {
        const ov = $('leadOverlay');
        ov.classList.add('leaving');
        setTimeout(() => {
            ov.classList.remove('open', 'leaving');
            document.body.style.overflow = '';
            const form = $('leadForm');
            form.reset();
            form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
        }, 180);
    }

    // ---------- Slider ----------
    function bindSlider() {
        const slider = $('valorSlider');
        slider.addEventListener('input', () => {
            $('sliderValue').textContent = fmtMoney(slider.value);
            $('fValor').value = slider.value;
        });
    }

    // ---------- Máscara de telefone ----------
    function bindPhoneMask() {
        const phone = $('fPhone');
        phone.addEventListener('input', () => {
            let v = phone.value.replace(/\D/g, '').slice(0, 11);
            if (v.length > 2) v = '(' + v.slice(0, 2) + ') ' + v.slice(2);
            if (v.length > 9) v = v.slice(0, 9) + '-' + v.slice(9);
            phone.value = v;
        });
    }

    // ---------- Título interativo por usuário (home) ----------
    function bindHeroTitle() {
        const input = $('heroName');
        const hello = $('heroHello');
        const title = $('heroTitle');
        if (!input) return;

        const base = 'O crédito certo,<br><span>sem burocracia.</span>';
        const personalized = (name) => `O crédito que você precisa,<br><span>${name}.</span>`;

        input.addEventListener('input', () => {
            const name = input.value.trim();
            if (name.length >= 2) {
                hello.textContent = name.toUpperCase();
                title.innerHTML = personalized(escapeHtml(name));
            } else {
                hello.textContent = 'VISITANTE';
                title.innerHTML = base;
            }
        });
        // Enter foca no CTA de simulação
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.querySelector('.vitrine-hero .vitrine-btn-primary')?.focus();
            }
        });
    }

    // ---------- Envio ----------
    async function submit(e) {
        e.preventDefault();
        const form = e.target;
        const name = $('fNome').value.trim();
        const phone = $('fPhone').value.replace(/\D/g, '');
        const city = $('fCity').value.trim();
        const consent = $('fConsent').checked;
        const product = state.active ? state.active.id : $('fProduct').value;

        let ok = true;
        [[$('fNome'), name && name.length >= 2], [$('fPhone'), phone.length >= 10 && phone.length <= 13], [$('fCity'), city && city.length >= 2]].forEach(([el, valid]) => {
            el.classList.toggle('invalid', !valid);
            if (!valid) ok = false;
        });

        if (!ok) {
            toast('Preencha os campos destacados corretamente.', 'err');
            return;
        }
        if (!consent) {
            toast('Confirme que aceita ser contatado(a).', 'err');
            return;
        }

        const btn = $('submitBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

        try {
            const res = await fetch('/api/public/lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name, phone, city, product_id: product,
                    valor: $('fValor').value,
                    website: '' // honeypot vazio
                })
            });
            const data = await res.json().catch(() => ({}));

            if (res.status === 201 || res.status === 200) {
                close();
                openSuccess();
            } else if (res.status === 409) {
                toast(data.error || 'Este telefone já está em atendimento.', 'err');
            } else if (res.status === 429) {
                toast('Muitas solicitações seguidas. Aguarde alguns minutos.', 'err');
            } else {
                toast(data.error || 'Não foi possível enviar. Tente novamente.', 'err');
            }
        } catch (err) {
            toast('Erro de conexão. Verifique sua internet e tente de novo.', 'err');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar minha solicitação';
        }
    }

    // ---------- Sub-popup sucesso ----------
    function openSuccess() {
        $('successOverlay').classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function closeSuccess() {
        const ov = $('successOverlay');
        ov.classList.add('leaving');
        setTimeout(() => {
            ov.classList.remove('open', 'leaving');
            document.body.style.overflow = '';
        }, 180);
    }

    // ---------- Esc / cliques ----------
    function bindGlobal() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if ($('successOverlay').classList.contains('open')) closeSuccess();
                else if ($('leadOverlay').classList.contains('open')) close();
            }
        });
        document.querySelectorAll('.vitrine-overlay').forEach(ov => {
            ov.addEventListener('mousedown', (e) => {
                if (e.target === ov) {
                    if (ov.id === 'successOverlay') closeSuccess();
                    else close();
                }
            });
        });
    }

    // ---------- WhatsApp ----------
    function bindWhatsapp() {
        const wa = $('vitrineWhatsapp');
        // número configurável: usa o bot principal do .env se exposto, senão placeholder
        wa.addEventListener('click', (e) => {
            e.preventDefault();
            const phone = window.VITRINE_WA || '5541991798537';
            const msg = encodeURIComponent('Olá! Vim pelo site da Prime Sul e quero saber mais sobre crédito.');
            window.open(`https://wa.me/${phone}?text=${msg}`, '_blank', 'noopener');
        });
    }

    // ---------- Init ----------
    function init() {
        bindSlider();
        bindPhoneMask();
        bindHeroTitle();
        bindGlobal();
        bindWhatsapp();
        document.getElementById('leadForm').addEventListener('submit', submit);
        loadProducts();
    }

    // expõe API pública para os onclick inline
    window.Vitrine = {
        open,
        close,
        closeSuccess
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();