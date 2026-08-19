# Prime Sul - Features e melhorias do Admin

> Levantamento realizado em 19/08/2026 a partir do frontend, das rotas relacionadas e da referencia do modulo de Marketing/Status do projeto `D:\saas-web`.

## Objetivo

Reduzir a poluicao visual do admin, eliminar atalhos repetitivos e deixar cada modulo autoexplicativo. Cada entrada deve levar a uma funcao diferente e previsivel, com contexto suficiente para o administrador entender o que pode fazer antes de executar uma acao sensivel.

## Escala de prioridade

| Prioridade | Significado |
| --- | --- |
| P0 | Risco de dados, seguranca ou comportamento enganoso. Corrigir antes de liberar em producao. |
| P1 | Fluxo principal quebrado, confuso ou diferente do que a interface promete. |
| P2 | Melhoria relevante de usabilidade, orientacao e produtividade. |
| P3 | Refinamento visual ou evolucao futura. |

## Resumo executivo

| Prioridade | Modulo | Correcao principal |
| --- | --- | --- |
| P0 | Marketing/Status | Isolar posts por `organization_id`; hoje a consulta e as mutacoes nao filtram a empresa. |
| P0 | Leads | Remover o falso OCR que gera CPF, telefone e renda aleatorios, ou identificar claramente como demonstracao. |
| P1 | Marketing/Status | Separar `Novo Status`, `Calendario` e `Previa`; hoje os atalhos nao entregam tres funcoes distintas. |
| P1 | Marketing/Status | Criar calendario semanal com regua de 24 horas e marcadores de agendamento. |
| P1 | Marketing/Status | Corrigir estados de rascunho, edicao de enviados e recorrencia. |
| P1 | Funil | Remover o ID duplicado `fl-c-transfer-btn`, que torna um dos botoes inconsistente. |
| P1 | Bots/Numeros | Separar conexao do WhatsApp de governanca anti-ban e evitar acoes duplicadas. |
| P1 | Configuracao | Validar e limitar as chaves e faixas aceitas pelo backend. |
| P2 | Leads/Funil | Reduzir modais encadeados e organizar acoes individuais e em massa. |
| P2 | Hub | Transformar a entrada em resumo operacional, sem repetir o menu completo. |

---

## 1. Marketing e Status

### 1.1 Problema atual

O HUD apresenta tres recursos, mas eles nao representam tres fluxos independentes:

- `Novo Status` aciona `#mk-new` e abre o editor completo.
- `Calendario` apenas abre o workspace atual, sem calendario.
- `Previa` tambem aciona `#mk-new`, abrindo o mesmo editor vazio de `Novo Status`.

O editor mistura conteudo, design, agendamento e previa. Ao mesmo tempo, os indicadores e a lista de resultados ficam fora dele. Isso faz o usuario entrar em um formulario quando queria consultar agenda, previa ou desempenho.

### 1.2 Comportamento esperado dos recursos

#### Novo Status - P1

Deve abrir somente o fluxo de criacao/edicao:

1. Conteudo: titulo interno, texto e modelo rapido.
2. Formato: texto, imagem ou link.
3. Design: cor, fonte e midia.
4. Publicacao: salvar rascunho, agendar ou publicar agora.
5. Previa ao vivo dentro do editor, como apoio da criacao.

O relatorio geral e o calendario nao devem abrir dentro desse popup.

#### Calendario - P1

Deve abrir ou focar uma area propria no painel principal:

- Abas `Seg`, `Ter`, `Qua`, `Qui`, `Sex`, `Sab` e `Dom`.
- Regua horizontal de `00h` a `24h`.
- Linha indicando o horario atual quando o dia selecionado for hoje.
- Marcadores posicionados pelo horario de cada status.
- Cor do marcador por estado: rascunho, agendado, enviado, falha e cancelado.
- Clique em um ponto vazio da regua abre `Novo Status` com dia e horario preenchidos.
- Clique em um marcador abre os detalhes daquele status.
- Navegacao para semana anterior, atual e seguinte.
- Resumo do dia: agendados, enviados e falhas.

Essa interacao segue a boa pratica observada no `saas-web`, mas deve usar os componentes e a identidade visual do Prime Sul.

#### Previa - P1

Deve ter uma funcao propria e nao criar um status vazio:

- Se houver um status selecionado, abrir uma visualizacao somente leitura.
- Sem selecao, mostrar os proximos status e pedir que o usuario escolha um.
- Exibir formato, texto, imagem/link, numero responsavel, data e estado.
- Permitir `Editar`, `Duplicar`, `Publicar agora` ou `Voltar ao calendario`, conforme o estado.
- A simulacao de cinco segundos deve existir apenas dentro dessa visualizacao ou do editor.

### 1.3 Relatorio de Status - P1

O painel inicial de Marketing deve ser a central de acompanhamento, contendo:

- Cards de agendados, enviados, falhas e rascunhos.
- Indicador de conexao do numero que publicara o status.
- Proximas publicacoes em ordem cronologica.
- Historico recente com data de envio, numero utilizado e erro legivel.
- Filtros por periodo, estado, formato e numero.
- Acao para tentar novamente quando houver falha.
- Diferenca visual clara entre `sem horario`, `agendado`, `publicando`, `enviado`, `falhou` e `cancelado`.

### 1.4 Correcao dos estados e regras - P1

O backend atual cria todo post como `scheduled`, mesmo sem `scheduled_at`. Esse item fica com aparencia de agendado, mas nunca e processado.

Estados propostos:

| Estado | Uso |
| --- | --- |
| `draft` | Conteudo salvo sem data de publicacao. |
| `scheduled` | Possui data futura valida. |
| `publishing` | Envio em processamento, evitando duplo clique/duplo worker. |
| `sent` | Publicado com sucesso e com `sent_at`. |
| `failed` | Falhou e possui codigo/mensagem de erro. |
| `cancelled` | Agendamento cancelado sem excluir o historico. |

Regras necessarias:

- Nao permitir `scheduled` sem data.
- Nao editar um item `sent` como se ele ainda fosse o mesmo agendamento.
- A acao sobre um enviado deve ser `Duplicar`, criando um novo ID em rascunho.
- Validar titulo, tamanho da mensagem, URL de imagem, tipo, fonte, cor, numero e data no backend.
- Impedir publicacao duplicada enquanto o item estiver em `publishing`.
- Registrar tentativa, numero usado, resultado e horario.
- Em recorrencia, calcular a proxima ocorrencia no fuso da empresa, sem simplesmente somar 24 horas em UTC.
- Oferecer recorrencia por dias da semana, nao apenas `todo dia`.

### 1.5 Isolamento por empresa - P0

A tabela `marketing_posts` nao possui `organization_id`, e o servico usa consultas por ID sem filtro de organizacao. Em um ambiente multiempresa, um administrador pode listar, alterar, excluir ou publicar status pertencentes a outra empresa.

Correcao necessaria:

- Adicionar `organization_id` em `marketing_posts` com indice por empresa, estado e data.
- Passar `req.user.organization_id` em todas as operacoes do servico.
- Filtrar `list`, `create`, `update`, `remove`, `sendNow` e `processDue` pela organizacao.
- Garantir que `number_id` pertence a mesma organizacao do post.
- Criar testes de isolamento entre duas organizacoes.

### 1.6 Criterios de aceite de Marketing/Status

- [ ] Os tres cards do HUD executam funcoes diferentes.
- [ ] `Novo Status` abre o editor limpo e nao o relatorio.
- [ ] `Calendario` exibe sete dias e uma regua de 24 horas.
- [ ] Clicar na regua preenche corretamente data e horario.
- [ ] `Previa` nunca cria ou altera dados so por ser aberta.
- [ ] Status sem data e salvo como rascunho.
- [ ] Um status enviado so pode ser visualizado ou duplicado.
- [ ] Falhas mostram causa e oferecem nova tentativa segura.
- [ ] Posts de uma empresa nunca aparecem ou podem ser alterados por outra.
- [ ] Layout funciona em desktop e celular sem deformar o preview.
- [ ] Datas sao exibidas e gravadas corretamente no fuso `America/Sao_Paulo` ou no fuso configurado da empresa.

---

## 2. Hub do Admin

### Problemas

- O launchpad inicial, o HUD global e alguns HUDs internos repetem a mesma lista de modulos.
- A area principal ainda funciona mais como um segundo menu do que como um resumo de operacao.
- Alguns numeros do hub nao deixam claro se representam total historico, ativo ou apenas o dia atual.

### Melhorias - P2

- Manter uma unica navegacao global.
- Usar o Hub para mostrar alertas e decisoes: campanhas rodando, numeros em risco, falhas recentes, leads sem responsavel e proximas publicacoes.
- Exibir periodo e definicao em cada metrica.
- Manter no maximo uma acao primaria, como `Criar campanha`.
- Trocar cards repetidos por uma lista curta de pendencias com links contextuais.
- Preservar `Ctrl+K` como busca de ferramentas, sem duplicar o launchpad visual.

### Criterios de aceite

- [ ] Nenhuma ferramenta aparece como card de navegacao em mais de duas camadas consecutivas.
- [ ] Cada alerta do Hub leva diretamente ao item que precisa de atencao.
- [ ] As metricas informam periodo e significado.

---

## 3. Bots WhatsApp e Numeros Anti-Ban

### Problema

Os dois modulos exibem saude e estado dos numeros e permitem reativar ou banir. A divisao de responsabilidade nao fica clara para o administrador.

### Organizacao proposta - P1

`Bots WhatsApp` deve cuidar de conexao:

- Slots, QR Code, conectar, desconectar e remover sessao.
- Estado da sessao: conectado, conectando ou offline.
- Identidade real reconhecida pelo WhatsApp.
- Pausa emergencial global com confirmacao e impacto explicado.

`Numeros Anti-Ban` deve cuidar de governanca:

- Limite diario, consumo, cooldown, bloqueio e historico de incidentes.
- Motivo e horario de entrada em cooldown.
- Previsao de reativacao.
- Acao manual de isolar/reativar com justificativa registrada.
- Link para abrir a conexao correspondente, sem repetir o QR Code.

### Melhorias adicionais - P2

- Trocar o termo `descartavel` por `numero de triagem` ou explicar o termo, para nao incentivar troca indiscriminada.
- Diferenciar `banido pelo WhatsApp`, `bloqueado manualmente`, `offline` e `em cooldown`.
- Exigir confirmacao contextual antes de pausar todos os bots ou remover sessao.
- Mostrar tempo restante e consumo em numeros, nao apenas cores.

### Criterios de aceite

- [ ] Acoes de conexao existem apenas em `Bots WhatsApp`.
- [ ] Acoes de limite e risco existem apenas em `Numeros Anti-Ban`.
- [ ] O mesmo estado possui o mesmo nome e cor nos dois modulos.
- [ ] Toda acao destrutiva explica o impacto antes da confirmacao.

---

## 4. Leads

### OCR de documento enganoso - P0

O recurso apresentado como `IA Vision OCR` nao le o documento. Ele espera 1,2 segundo e gera telefone, CPF, cidade, renda e limite ficticios. Isso pode inserir dados pessoais falsos na base e transmitir uma confirmacao incorreta ao usuario.

Correcao:

- Remover o preenchimento aleatorio imediatamente.
- Enquanto nao houver OCR real, ocultar o botao ou rotular como `Demonstracao - nao salva dados reais`.
- Na implementacao real, enviar a imagem para um servico de extracao, mostrar confianca por campo e exigir revisao humana antes de salvar.
- Nunca inferir CPF, telefone, renda ou limite quando o dado nao estiver legivel.
- Registrar consentimento e definir politica de descarte da imagem.

### Simplificacao do modulo - P2

- Separar a barra principal em `Buscar/filtrar`, `Novo lead` e `Acoes da etapa`.
- Manter OCR dentro de `Novo lead`, e nao como segundo atalho que abre o mesmo modal.
- Habilitar ferramentas de etapa somente depois de mostrar claramente a etapa e a quantidade afetada.
- Antes de disparos ou movimentacoes em massa, exibir resumo com elegiveis, excluidos, opt-outs e limite anti-ban.
- Permitir cancelar o processamento sem fechar a unica tela de acompanhamento.
- Remover listeners globais de colar ao destruir o modulo, evitando acumulo ao reabrir a tela.

### Criterios de aceite

- [ ] Nenhum dado ficticio e salvo como se tivesse sido extraido.
- [ ] Toda acao em massa mostra quantos leads serao afetados.
- [ ] Opt-outs e contatos inelegiveis aparecem no resumo antes do envio.
- [ ] Reabrir o modulo nao duplica eventos de colar ou processamento.

---

## 5. Funil de Vendas

### Correcao funcional - P1

O HTML possui dois elementos com o mesmo ID `fl-c-transfer-btn`. O JavaScript usa `getElementById`, portanto apenas um recebe corretamente visibilidade e evento. O outro pode parecer inativo ou se comportar de forma inconsistente.

Correcao:

- Manter um unico botao de transferencia, ou usar IDs diferentes com uma funcao compartilhada.
- Adicionar teste simples que falhe quando houver IDs duplicados nos componentes HTML.

### Simplificacao - P2

- O modulo possui funil, Kanban, drawer, detalhe do cliente, edicao, transferencia e console de automacao. Organizar em tres niveis: visao, detalhe e acao.
- Evitar modal sobre modal; edicao e transferencia devem substituir o conteudo do detalhe ou usar um unico drawer com etapas.
- Separar `Automacao da etapa` de `Acao em massa agora`.
- Mostrar impacto antes de mover leads, recalcular score ou disparar mensagens.
- Incluir descricao curta em `Visao Funil` e `Modo CRM Kanban`, explicando quando usar cada um.

### Criterios de aceite

- [ ] Nao existem IDs duplicados no modulo.
- [ ] Apenas uma camada de modal/drawer fica aberta por vez.
- [ ] O usuario sabe se esta configurando uma regra futura ou executando uma acao imediata.

---

## 6. Campanhas

### Melhorias - P1/P2

- Transformar a criacao em etapas visiveis: `Mensagem`, `Publico`, `Revisao` e `Agendamento`.
- Na revisao, mostrar numero selecionado, quantidade elegivel, removidos por opt-out, removidos por cooldown/recontato e previsao de duracao.
- Explicar que `Iniciar` envia imediatamente quando nao existe agendamento.
- Pedir confirmacao antes de iniciar, pausar, cancelar ou tentar novamente.
- Mostrar timezone ao lado do campo de agendamento.
- Exibir andamento e motivo das falhas sem exigir abrir outro modulo.
- Depois de iniciada, manter filtros e publico imutaveis, mas permitir duplicar campanha.
- Padronizar `Agendada`, `Rascunho`, `Rodando`, `Pausada`, `Concluida` e `Cancelada` entre frontend e backend.

### Criterios de aceite

- [ ] A tela de revisao informa exatamente quem recebera e quem foi excluido.
- [ ] Nenhum disparo comeca sem confirmacao explicita.
- [ ] Data e fuso do agendamento ficam visiveis.
- [ ] Falhas podem ser filtradas e compreendidas.

---

## 7. Timeline dos Bots

### Melhorias - P2

- Diferenciar `ao vivo` de polling a cada oito segundos; usar texto como `Atualiza automaticamente`.
- Mostrar `ultima atualizacao` e estado de erro/desconexao.
- Adicionar busca por texto, campanha e lead, alem de numero/tipo/periodo.
- Ao clicar em falha, abrir detalhes e a acao relacionada: numero, campanha ou status.
- Permitir pausar a atualizacao automatica enquanto o usuario investiga.
- Unificar eventos de Marketing/Status com a timeline operacional.
- Aplicar paginacao ou carregamento incremental, evitando limite fixo invisivel de 400 eventos.

### Criterios de aceite

- [ ] O usuario sabe quando os dados foram atualizados pela ultima vez.
- [ ] Todo incidente oferece contexto suficiente para investigacao.
- [ ] Eventos antigos podem ser carregados sem substituir silenciosamente o historico.

---

## 8. Vendedores

### Melhorias - P2

- Trocar o titulo fixo `Novo vendedor` por `Novo` ou `Editar`, conforme o contexto.
- Explicar diferenca entre telefone do cadastro, numero operacional e sessao conectada.
- Exibir leads atribuidos, capacidade, estado da conta e ultima atividade no card.
- Antes de desativar vendedor ou numero, informar para onde vao os leads e automacoes pendentes.
- Centralizar permissao, numeros e conexao no detalhe do vendedor, sem abrir varios popups independentes.
- Adicionar busca e filtro de ativos/inativos.

### Criterios de aceite

- [ ] O administrador entende qual numero e usado em cada finalidade.
- [ ] Desativacoes nao deixam leads ou tarefas sem responsavel silenciosamente.
- [ ] O detalhe do vendedor concentra as acoes relacionadas.

---

## 9. Configuracao

### Validacao e seguranca - P1

A rota `PUT /config` aceita qualquer chave enviada e persiste o valor como texto. O frontend tambem permite limites sem validacao de relacao entre eles.

Correcao:

- Criar allowlist de chaves configuraveis.
- Validar tipo, minimo e maximo no backend.
- Rejeitar chaves desconhecidas.
- Registrar quem alterou configuracoes sensiveis e quando.
- Impedir combinacoes perigosas, como delay muito baixo ou lote maior que o limite diario.
- Exibir delay em segundos/minutos para humanos e converter internamente para milissegundos.

### Organizacao - P2

- Mover dados da parceria BB para uma secao de integracao separada se ainda nao estiverem ativos.
- Em `Mensagens`, mostrar previa e variaveis validas sem exigir memorizacao.
- Em `Anti-Ban`, explicar efeito, valor recomendado e risco de cada campo.
- Incluir janela de envio, dias permitidos, cooldown por contato e limite manual ja usados pelo backend.
- Mostrar aviso de alteracoes nao salvas e confirmacao apos salvar.

### Criterios de aceite

- [ ] O backend rejeita valores e chaves invalidas.
- [ ] Toda configuracao usada pelo envio aparece com descricao e unidade clara.
- [ ] Alteracoes sensiveis possuem auditoria.
- [ ] Valores recomendados sao conservadores e coerentes entre si.

---

## 10. Padrao comum para popups e subpopups

### Regras propostas - P1/P2

- Um popup deve ter uma unica finalidade principal.
- Titulo e subtitulo devem dizer o objeto e a acao: `Criar status`, `Detalhes do status`, `Transferir lead`.
- Nao abrir um segundo popup sobre o primeiro; trocar a etapa dentro do mesmo container.
- Cabecalho fixo, corpo rolavel e rodape fixo em telas pequenas.
- `Esc`, clique no fundo e botao fechar devem seguir a mesma regra e nunca descartar alteracoes sem aviso.
- Acao primaria sempre a direita; acao destrutiva separada e com confirmacao contextual.
- Formularios longos devem indicar progresso ou etapas.
- Estados de carregamento, vazio, sucesso e erro devem ocupar o mesmo espaco do conteudo, evitando saltos.
- Todo popup deve restaurar foco ao elemento que o abriu e prender o foco enquanto estiver aberto.
- Nao usar IDs repetidos e evitar funcoes globais `onclick` quando listeners do modulo forem suficientes.

---

## Ordem recomendada de implementacao

### Fase 1 - Confianca e seguranca

1. Isolamento multiempresa de Marketing/Status.
2. Remocao do OCR ficticio.
3. Correcao do ID duplicado no Funil.
4. Allowlist e validacao da Configuracao.

### Fase 2 - Marketing/Status

1. Estados corretos e migracao da tabela.
2. Relatorio principal e filtros.
3. Calendario semanal com timeline de 24 horas.
4. Editor focado em criacao.
5. Previa somente leitura e duplicacao.
6. Testes de timezone, recorrencia, concorrencia e isolamento.

### Fase 3 - Simplificacao do admin

1. Separar responsabilidades de Bots e Numeros.
2. Simplificar Hub.
3. Reduzir camadas de Leads e Funil.
4. Melhorar revisao e confirmacao de Campanhas.
5. Consolidar detalhe de Vendedores.

### Fase 4 - Consistencia e acessibilidade

1. Padronizar popups e estados visuais.
2. Testar teclado, foco e leitores de tela.
3. Testar larguras de 360 px, 768 px, 1024 px e desktop amplo.
4. Criar testes automaticos para IDs duplicados e contratos dos modulos.

## Definicao de pronto geral

- [ ] Fluxo validado em desktop e celular.
- [ ] Estado vazio, carregamento, sucesso e erro implementados.
- [ ] Operacoes sensiveis possuem confirmacao e retorno claro.
- [ ] Rotas validam permissao, organizacao e payload no backend.
- [ ] Datas usam fuso explicito.
- [ ] Nenhum dado ficticio e apresentado como real.
- [ ] Modulo possui descricao curta e cada acao tem finalidade unica.
- [ ] Testes cobrem caminho feliz, falha, autorizacao e isolamento multiempresa.

## Arquivos analisados

- `public/admin.html`
- `public/admin/js/module-hud.js`
- `public/admin/components/hub.*`
- `public/admin/components/marketing.*`
- `public/admin/components/campanhas.*`
- `public/admin/components/numeros.*`
- `public/admin/components/bots.*`
- `public/admin/components/leads.*`
- `public/admin/components/funil.*`
- `public/admin/components/timeline.*`
- `public/admin/components/vendedores.*`
- `public/admin/components/config.*`
- `server/routes/marketing.js`
- `server/services/marketing-service.js`
- `server/database/db.js`
- Referencia: `D:\saas-web\public\admin\components\marketing.*`

