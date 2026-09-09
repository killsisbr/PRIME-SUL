const PURPOSE_LABEL = { screening: 'TRIAGEM', handoff: 'HANDOFF', followup: 'FOLLOW-UP' };

export async function init() {
    const api = window.api;
    const toast = window.toast;
    const esc = window.escapeHtml;

    let _templatesList = [];

    function render(stats) {
        _templatesList = stats || [];
        document.getElementById('tp-total').textContent = _templatesList.length;
        document.getElementById('tp-campaigns').textContent = _templatesList.reduce((sum, t) => sum + (t.campaigns_count || 0), 0);
        document.getElementById('tp-sends').textContent = _templatesList.reduce((sum, t) => sum + (t.sends_count || 0), 0);

        const list = document.getElementById('tp-list');
        if (!_templatesList.length) {
            list.innerHTML = '<div class="ps-empty"><i class="fas fa-file-lines"></i>Nenhum template cadastrado ainda.<br>Clique em "NOVO TEMPLATE" pra criar o primeiro.</div>';
            return;
        }
        list.innerHTML = _templatesList.map(t => `
            <div class="tp-row" data-id="${t.id}" title="Clique para editar este template">
                <div class="tp-row-main">
                    <strong>${esc(t.name)}</strong>
                    <span class="ps-row-sub">${PURPOSE_LABEL[t.purpose] || t.purpose} ${t.seller_id ? '• pessoal' : '• compartilhado'} • criado ${esc((t.created_at || '').slice(0, 10))}</span>
                    ${t.body ? `<p class="tp-row-body-snippet">${esc(t.body)}</p>` : ''}
                </div>
                <div class="tp-metric"><b>${t.campaigns_count || 0}</b><span>CAMPANHAS</span></div>
                <div class="tp-metric"><b>${t.sends_count || 0}</b><span>ENVIADOS</span></div>
                <div class="tp-metric ${t.sends_count ? '' : 'dim'}"><b>${t.response_rate || 0}%</b><span>RESPOSTA</span></div>
                <div class="tp-metric ${t.sends_count ? '' : 'dim'}"><b>${t.conversion_rate || 0}%</b><span>CONVERSÃO</span></div>
                <div class="tp-row-actions">
                    <button type="button" class="ps-icon-btn tp-btn-edit" data-edit="${t.id}" title="Editar template"><i class="fas fa-pen-to-square"></i></button>
                    <button type="button" class="ps-icon-btn danger tp-btn-del" data-del="${t.id}" title="Arquivar template"><i class="fas fa-box-archive"></i></button>
                </div>
            </div>`).join('');
    }

    async function refresh() {
        try {
            render(await api('/templates/stats'));
        } catch (e) {
            document.getElementById('tp-list').innerHTML = `<div class="ps-empty" style="color:var(--bad);">${esc(e.message)}</div>`;
        }
    }

    function openModal(tmpl = null) {
        const overlay = document.getElementById('tpOverlay');
        if (!overlay) return;
        overlay.style.display = 'flex';

        const idEl = document.getElementById('tp-id');
        const titleEl = document.getElementById('tpModalTitle');
        const subEl = document.getElementById('tpModalSub');
        const nameEl = document.getElementById('tp-name');
        const purposeEl = document.getElementById('tp-purpose');
        const bodyEl = document.getElementById('tp-body');
        const sharedEl = document.getElementById('tp-shared');
        const saveBtn = document.getElementById('tp-save');

        if (tmpl && tmpl.id) {
            if (idEl) idEl.value = tmpl.id;
            if (titleEl) titleEl.textContent = 'EDITAR TEMPLATE';
            if (subEl) subEl.textContent = `Editando "${tmpl.name}"`;
            if (nameEl) nameEl.value = tmpl.name || '';
            if (purposeEl) purposeEl.value = tmpl.purpose || 'screening';
            if (bodyEl) bodyEl.value = tmpl.body || '';
            if (sharedEl) sharedEl.checked = !tmpl.seller_id;
            if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-save"></i> SALVAR ALTERAÇÕES';
        } else {
            if (idEl) idEl.value = '';
            if (titleEl) titleEl.textContent = 'NOVO TEMPLATE';
            if (subEl) subEl.textContent = 'Mensagem reutilizável pra usar na criação de campanhas';
            if (nameEl) nameEl.value = '';
            if (purposeEl) purposeEl.value = 'screening';
            if (bodyEl) bodyEl.value = '';
            if (sharedEl) sharedEl.checked = true;
            if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-plus"></i> CRIAR TEMPLATE';
        }

        setTimeout(() => nameEl?.focus(), 50);
    }

    function closeModal() {
        const overlay = document.getElementById('tpOverlay');
        if (overlay) overlay.style.display = 'none';
        const idEl = document.getElementById('tp-id');
        if (idEl) idEl.value = '';
        document.getElementById('tp-name').value = '';
        document.getElementById('tp-body').value = '';
        document.getElementById('tp-purpose').value = 'screening';
        document.getElementById('tp-shared').checked = true;
    }

    document.getElementById('tp-new')?.addEventListener('click', () => openModal(null));
    document.getElementById('tp-close')?.addEventListener('click', closeModal);
    document.getElementById('tpOverlay')?.addEventListener('click', e => { if (e.target.id === 'tpOverlay') closeModal(); });

    // Botão auxiliar para inserir {nome}
    document.getElementById('tp-insert-nome-btn')?.addEventListener('click', () => {
        const textarea = document.getElementById('tp-body');
        if (!textarea) return;
        const start = textarea.selectionStart || textarea.value.length;
        const end = textarea.selectionEnd || textarea.value.length;
        const val = textarea.value;
        textarea.value = val.substring(0, start) + '{nome}' + val.substring(end);
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + 6;
    });

    document.getElementById('tp-save')?.addEventListener('click', async () => {
        const id = document.getElementById('tp-id')?.value;
        const name = document.getElementById('tp-name')?.value.trim();
        const body = document.getElementById('tp-body')?.value.trim();
        const purpose = document.getElementById('tp-purpose')?.value || 'screening';
        const shared = document.getElementById('tp-shared')?.checked ?? true;

        if (!name || !body) { toast('Preencha nome e mensagem', 'err'); return; }
        const btn = document.getElementById('tp-save');
        if (btn) btn.disabled = true;

        try {
            if (id) {
                await api(`/templates/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ name, purpose, body, shared })
                });
                toast('Template atualizado com sucesso!', 'ok');
            } else {
                await api('/templates', {
                    method: 'POST',
                    body: JSON.stringify({ name, purpose, body, shared })
                });
                toast('Template criado com sucesso!', 'ok');
            }
            closeModal();
            await refresh();
        } catch (e) {
            toast(e.message, 'err');
        } finally {
            if (btn) btn.disabled = false;
        }
    });

    // Clique na lista para Editar ou Excluir
    document.getElementById('tp-list')?.addEventListener('click', async e => {
        const delBtn = e.target.closest('[data-del]');
        if (delBtn) {
            e.stopPropagation();
            if (!confirm('Arquivar este template? Ele deixa de aparecer na criação de campanhas (o histórico é mantido).')) return;
            delBtn.disabled = true;
            try {
                await api(`/templates/${delBtn.dataset.del}`, { method: 'DELETE' });
                toast('Template arquivado', 'info');
                await refresh();
            } catch (err) {
                toast(err.message, 'err');
                delBtn.disabled = false;
            }
            return;
        }

        const row = e.target.closest('.tp-row');
        if (row) {
            const id = row.dataset.id;
            const tmpl = _templatesList.find(x => String(x.id) === String(id));
            if (tmpl) {
                openModal(tmpl);
            }
        }
    });

    await refresh();
    return {};
}

export async function destroy() {}
