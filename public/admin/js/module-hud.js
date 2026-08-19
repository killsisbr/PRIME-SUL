(function () {
    const MODULE_HUD = {
        timeline: { icon:'fa-clock-rotate-left', accent:'#0ea5e9', eyebrow:'OBSERVABILIDADE', headline:'TUDO QUE O BOT\nFEZ, EM ORDEM.', desc:'Acompanhe conexões, envios, pausas e incidentes com foco no que aconteceu agora.', metrics:[['VISÃO','AO VIVO'],['EVENTOS','TODOS'],['ORDEM','CRONOLÓGICA']], cards:[['fa-timeline','ABRIR TIMELINE','Ver a sequência completa de eventos e alarmes.','workspace'],['fa-magnifying-glass','FILTROS','Localizar um evento específico pela busca.','#tl-num'],['fa-triangle-exclamation','SINAIS DE RISCO','Checar cooldowns, falhas e banimentos.','#tl-type']] },
        marketing: { icon:'fa-bullhorn', accent:'#f59e0b', eyebrow:'PRESENÇA DIGITAL', headline:'TRANSFORME STATUS\nEM OPORTUNIDADE.', desc:'Crie publicações e programe o calendário sem abrir abas repetidas.', metrics:[['CANAL','STATUS'],['PREVIEW','AO VIVO'],['AGENDA','ATIVA']], cards:[['fa-plus','NOVO STATUS','Criar uma publicação com prévia pronta.','#mk-new'],['fa-calendar-days','CALENDÁRIO','Ver agendamentos e datas futuras.','workspace'],['fa-mobile-screen','PRÉVIA','Revisar a postagem antes de publicar.','#mk-new']] },
        numeros: { icon:'fa-shield-halved', accent:'#df4632', eyebrow:'PROTEÇÃO ANTI-BAN', headline:'NÚMEROS PRONTOS,\nRISCO SOB CONTROLE.', desc:'Controle triagem, limites diários e números sensíveis em um só lugar.', metrics:[['FUNÇÃO','TRIAGEM'],['ROTAÇÃO','ATIVA'],['PROTEÇÃO','COOLDOWN']], cards:[['fa-plus','NOVO NÚMERO','Cadastrar um número descartável para triagem.','#numNumber'],['fa-temperature-low','COOLDOWN','Ver quem está resfriando e por quanto tempo.','workspace'],['fa-ban','BLOQUEIOS','Isolar rapidamente números comprometidos.','workspace']] },
    };

    const esc = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    window.buildModuleHud = function (container, moduleName, title) {
        const meta = MODULE_HUD[moduleName];
        if (!meta || container.querySelector('.module-hud-shell')) return;
        const workspace = document.createElement('div');
        workspace.className = 'module-hud-workspace';
        const workspacePanel = document.createElement('div');
        workspacePanel.className = 'module-hud-workspace-panel';
        while (container.firstChild) workspacePanel.appendChild(container.firstChild);
        workspace.appendChild(workspacePanel);

        const shell = document.createElement('section');
        shell.className = 'module-hud-shell';
        shell.style.setProperty('--module-accent', meta.accent);
        shell.innerHTML = `<header class="module-hud-header"><div class="module-hud-brand"><span><i class="fas ${meta.icon}"></i></span><div><small>${meta.eyebrow}</small><h1>${esc(title)}</h1><p>${meta.desc}</p></div></div><b><i class="fas fa-circle"></i> CENTRAL ATIVA</b></header><div class="module-hud-console"><aside class="module-hud-stage"><div class="module-hud-stage-top"><span>${meta.eyebrow}</span><i class="fas ${meta.icon}"></i></div><div class="module-hud-copy"><small>COMECE POR AQUI</small><h2>${meta.headline.replace('\n','<br>')}</h2><p>${meta.desc}</p></div><button type="button" class="module-hud-primary" data-hud-action="workspace"><i class="fas fa-arrow-right"></i> ABRIR PAINEL COMPLETO</button><div class="module-hud-metrics">${meta.metrics.map(([label,value])=>`<div><b data-source="${value}">${esc(value)}</b><span>${label}</span></div>`).join('')}</div></aside><div class="module-hud-launchpad">${meta.cards.map((card,i)=>`<button type="button" class="module-hud-card tone-${i+1}" data-hud-action="${esc(card[3])}"><em>0${i+1}</em><span><i class="fas ${card[0]}"></i></span><small>RECURSO</small><strong>${card[1]}</strong><p>${card[2]}</p><b>ACESSAR <i class="fas fa-arrow-right"></i></b></button>`).join('')}<div class="module-hud-tip"><i class="fas fa-lightbulb"></i> Revise o status e as configurações antes de iniciar ações em lote.</div></div></div>`;
        container.append(shell, workspace);

        shell.querySelectorAll('[data-source]').forEach(el => {
            const source = workspacePanel.querySelector('#' + CSS.escape(el.dataset.source));
            if (source) el.textContent = source.textContent.trim() || '0';
        });
        const openWorkspace = selector => {
            workspace.classList.add('active');
            if (selector && selector !== 'workspace') setTimeout(() => {
                const target = workspacePanel.querySelector(selector);
                if (target) { target.scrollIntoView({behavior:'smooth',block:'center'}); target.click?.(); target.focus?.(); }
            }, 80);
        };
        shell.addEventListener('click', event => {
            const button = event.target.closest('[data-hud-action]');
            if (button) openWorkspace(button.dataset.hudAction);
        });
        const back = document.createElement('button');
        back.type = 'button'; back.className = 'module-hud-back'; back.innerHTML = '<i class="fas fa-arrow-left"></i> VOLTAR À CENTRAL';
        back.onclick = () => workspace.classList.remove('active');
        workspacePanel.appendChild(back);
        workspace.addEventListener('click', event => { if (event.target === workspace) workspace.classList.remove('active'); });
        workspace.addEventListener('keydown', event => { if (event.key === 'Escape') { event.stopPropagation(); workspace.classList.remove('active'); } });
    };
})();
