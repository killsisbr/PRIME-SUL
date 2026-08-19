(function () {
    const MODULE_HUD = {
        leads: { icon:'fa-users', accent:'#3b82f6', eyebrow:'CARTEIRA COMERCIAL', headline:'SEUS LEADS,\nSUA OPERAÇÃO.', desc:'Organize a base, priorize oportunidades e avance cada contato pelo funil sem perder contexto.', metrics:[['BASE','kbx-total'],['ETAPAS','5'],['VISÃO','KANBAN']], cards:[['fa-table-columns','ABRIR CARTEIRA','Veja e organize todos os leads no quadro.','workspace'],['fa-user-plus','NOVO LEAD','Cadastre uma oportunidade na sua lista exclusiva.','#kbx-new'],['fa-filter','FILTROS E SCORE','Encontre prioridades, origens e melhores oportunidades.','#kbx-search'],['fa-wand-magic-sparkles','AUTOMAÇÕES','Configure ações em cada coluna do processo.','workspace']] },
        campanhas: { icon:'fa-paper-plane', accent:'#10b981', eyebrow:'CENTRAL DE CONVERSÃO', headline:'DISPARE COM\nCONTROLE.', desc:'Crie campanhas, acompanhe resultados e concentre os vendedores apenas nos leads interessados.', metrics:[['CAMPANHAS','cp-stat-total'],['RODANDO','cp-stat-running'],['ENVIOS','cp-stat-sent']], cards:[['fa-plus','NOVA CAMPANHA','Defina público, mensagem e números de envio.','.ps-head button, #btn-new-campaign'],['fa-list-check','GERENCIAR','Pause, retome e acompanhe os disparos.','workspace'],['fa-chart-line','RESULTADOS','Acompanhe confirmações e falhas em tempo real.','workspace'],['fa-shield-halved','BOAS PRÁTICAS','Revise limites e distribuição antes do envio.','workspace']] },
        bots: { icon:'fa-mobile-screen-button', accent:'#10b981', eyebrow:'CONEXÃO WHATSAPP', headline:'CONECTE.\nMONITORE. VENDA.', desc:'Escaneie o QR Code, acompanhe a saúde das sessões e deixe seus números preparados para operar.', metrics:[['NÚMEROS','bt-total'],['ONLINE','bt-conectados'],['LIMITE','bt-limite']], cards:[['fa-qrcode','CONECTAR NÚMERO','Adicione uma sessão e escaneie o QR Code.','#bt-num'],['fa-signal','SAÚDE DAS SESSÕES','Veja conexões, cooldown e disponibilidade.','workspace'],['fa-shield-heart','PROTEÇÃO','Acompanhe limites e preserve os números.','workspace'],['fa-rotate','ATUALIZAR STATUS','Confira novamente todas as conexões.','workspace']] },
        timeline: { icon:'fa-clock-rotate-left', accent:'#0ea5e9', eyebrow:'OBSERVABILIDADE', headline:'TUDO QUE O BOT\nFEZ, EM ORDEM.', desc:'Investigue conexões, envios, pausas e incidentes para entender a operação em tempo real.', metrics:[['VISÃO','AO VIVO'],['EVENTOS','TODOS'],['ORDEM','CRONOLÓGICA']], cards:[['fa-timeline','ABRIR TIMELINE','Veja a sequência completa de eventos.','workspace'],['fa-paper-plane','ENVIOS','Analise mensagens processadas pelos bots.','#tl-type'],['fa-triangle-exclamation','INCIDENTES','Identifique cooldowns, falhas e banimentos.','#tl-type'],['fa-magnifying-glass','INVESTIGAR','Use os filtros para localizar um evento.','#tl-num']] },
        marketing: { icon:'fa-bullhorn', accent:'#f59e0b', eyebrow:'PRESENÇA DIGITAL', headline:'TRANSFORME STATUS\nEM OPORTUNIDADE.', desc:'Crie conteúdos, visualize como ficarão no WhatsApp e programe publicações com consistência.', metrics:[['CANAL','STATUS'],['PREVIEW','AO VIVO'],['AGENDA','ATIVA']], cards:[['fa-plus','NOVO STATUS','Crie uma publicação com visualização de celular.','#mk-new'],['fa-calendar-days','AGENDAMENTOS','Organize o calendário de publicações.','workspace'],['fa-layer-group','TEMPLATES','Reaproveite formatos e mensagens de sucesso.','workspace'],['fa-mobile-screen','PRÉVIA WHATSAPP','Confira o resultado antes de publicar.','#mk-new']] },
        numeros: { icon:'fa-shield-halved', accent:'#df4632', eyebrow:'PROTEÇÃO ANTI-BAN', headline:'NÚMEROS PRONTOS,\nRISCO SOB CONTROLE.', desc:'Distribua os primeiros contatos, controle limites diários e retire números de risco da rotação.', metrics:[['FUNÇÃO','TRIAGEM'],['ROTAÇÃO','ATIVA'],['PROTEÇÃO','COOLDOWN']], cards:[['fa-plus','NOVO NÚMERO','Cadastre um número descartável para triagem.','#numNumber'],['fa-arrows-rotate','ROTAÇÃO','Acompanhe quais números podem receber envios.','workspace'],['fa-temperature-low','COOLDOWN','Veja sessões resfriando e limites diários.','workspace'],['fa-ban','BLOQUEIOS','Isole rapidamente números comprometidos.','workspace']] },
        vendedores: { icon:'fa-user-tie', accent:'#8b5cf6', eyebrow:'GESTÃO DE EQUIPE', headline:'CADA VENDEDOR,\nUMA OPERAÇÃO.', desc:'Controle acessos, limites, listas exclusivas e números próprios sem misturar carteiras.', metrics:[['MODELO','MULTI-TENANT'],['CARTEIRA','EXCLUSIVA'],['ACESSO','CONTROLADO']], cards:[['fa-user-plus','NOVO VENDEDOR','Crie acesso e defina o limite da carteira.','#btn-new-seller'],['fa-users-gear','GERENCIAR EQUIPE','Edite permissões, dados e disponibilidade.','workspace'],['fa-mobile-screen','WHATSAPP PRÓPRIO','Acompanhe os números conectados por vendedor.','workspace'],['fa-lock','PERMISSÕES','Mantenha leads e sessões isolados.','workspace']] },
        config: { icon:'fa-sliders', accent:'#181716', eyebrow:'CENTRAL DE REGRAS', headline:'CONFIGURE UMA VEZ.\nOPERE MELHOR.', desc:'Defina mensagens, limites e parâmetros usados pelos bots e pelos novos disparos da empresa.', metrics:[['ESCOPO','EMPRESA'],['REGRAS','CENTRAIS'],['EFEITO','NOVOS ENVIOS']], cards:[['fa-building-columns','PARCERIA E CRÉDITO','Revise dados institucionais e regras comerciais.','#cfgCnpj'],['fa-message','TEMPLATES','Configure os textos usados nos contatos.','#cfgTemplate'],['fa-shield-halved','LIMITES ANTI-BAN','Ajuste volume, intervalo e resfriamento.','#cfgDailyLimit'],['fa-floppy-disk','REVISAR E SALVAR','Acesse todas as configurações do sistema.','.ps-btn-save']] }
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
