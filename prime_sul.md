# PRIME SUL --- Sistema de Gestão Comercial, Leads e WhatsApp

## 1. Visão Geral

O **Prime Sul** será uma plataforma interna de gestão comercial
desenvolvida para centralizar o trabalho da equipe de vendas, organizar
leads, controlar a responsabilidade de cada vendedor, acompanhar o funil
comercial e integrar o atendimento via WhatsApp.

O sistema será dividido principalmente em dois ambientes:

-   **Painel Administrativo:** visão completa da operação, vendedores,
    leads, funil geral, indicadores e configurações.
-   **Painel do Vendedor:** ambiente individual onde cada vendedor
    gerencia exclusivamente sua carteira de leads, contatos, etapas do
    funil e atendimentos.

A base de dados será centralizada. Dessa forma, todos os vendedores
trabalham sobre a mesma base de leads, evitando cadastros duplicados e
conflitos de atendimento.

------------------------------------------------------------------------

## 2. Objetivos Principais

-   Centralizar todos os leads da operação.
-   Impedir que o mesmo lead seja cadastrado por vendedores diferentes.
-   Definir claramente qual vendedor é responsável por cada lead.
-   Criar um funil comercial individual para cada vendedor.
-   Disponibilizar ao administrador um funil consolidado de toda a
    equipe.
-   Integrar números de WhatsApp aos vendedores.
-   Permitir múltiplos números por vendedor de forma configurável.
-   Facilitar disparos e contatos comerciais.
-   Registrar o histórico das interações.
-   Criar ferramentas de acompanhamento e gestão da equipe.
-   Gerar indicadores e relatórios comerciais.

------------------------------------------------------------------------

## 3. Perfis de Acesso

### 3.1 Administrador

O administrador terá acesso completo ao sistema.

Poderá:

-   Cadastrar, editar, ativar e desativar vendedores.
-   Visualizar todos os leads.
-   Visualizar o responsável por cada lead.
-   Pesquisar leads por CPF, telefone, nome ou outros identificadores.
-   Visualizar o funil geral da empresa.
-   Filtrar o funil por vendedor.
-   Acompanhar quantidade de leads por vendedor.
-   Acompanhar desempenho e movimentações.
-   Transferir leads entre vendedores quando necessário.
-   Visualizar números de WhatsApp vinculados aos vendedores.
-   Configurar limites e regras para números de WhatsApp.
-   Criar e administrar modelos de mensagens.
-   Consultar relatórios.
-   Consultar histórico de atividades.
-   Configurar etapas do funil.
-   Gerenciar configurações gerais do sistema.

### 3.2 Vendedor

Cada vendedor terá uma conta individual.

O vendedor poderá:

-   Cadastrar novos leads.
-   Consultar sua própria carteira.
-   Visualizar somente os leads sob sua responsabilidade.
-   Movimentar seus leads dentro do funil.
-   Registrar informações e observações.
-   Criar tarefas e retornos.
-   Utilizar seus números de WhatsApp.
-   Selecionar o número utilizado no contato.
-   Utilizar modelos de mensagens permitidos.
-   Consultar o histórico dos próprios clientes.
-   Utilizar filtros, tags e pesquisas.
-   Acompanhar indicadores individuais.

------------------------------------------------------------------------

## 4. Cadastro Centralizado e Proteção de Leads

Um dos principais componentes do sistema será o controle centralizado de
leads.

Quando um vendedor tentar cadastrar um novo cliente, o sistema deverá
consultar a base central antes de concluir o cadastro.

### Fluxo

1.  Vendedor informa os dados do lead.
2.  Sistema pesquisa automaticamente na base.
3.  Caso não exista, o cadastro é permitido.
4.  O lead é vinculado ao vendedor que realizou o cadastro.
5.  Caso já exista, o sistema bloqueia a duplicação.
6.  O vendedor recebe uma informação de que o lead já está cadastrado.

Os principais campos utilizados para detecção poderão incluir:

-   CPF.
-   Telefone.
-   Nome.
-   Outros identificadores definidos pela operação.

O CPF e o telefone poderão funcionar como identificadores fortes para
evitar duplicidade.

------------------------------------------------------------------------

## 5. Responsabilidade pelo Lead

Todo lead deverá possuir um vendedor responsável.

Exemplo:

`Lead -> Vendedor responsável -> Etapa do funil -> Histórico -> Próxima ação`

O vínculo deverá permanecer registrado mesmo que o lead seja movimentado
entre diferentes etapas.

Somente usuários com autorização administrativa poderão transferir um
lead para outro vendedor.

Toda transferência deverá ficar registrada no histórico.

------------------------------------------------------------------------

## 6. Funil Comercial

### 6.1 Funil Individual

Cada vendedor possuirá seu próprio funil.

Ele verá exclusivamente seus clientes.

As etapas deverão ser configuráveis.

Exemplo inicial:

1.  Novo Lead
2.  Primeiro Contato
3.  Em Atendimento
4.  Simulação
5.  Link Enviado
6.  Aguardando Cliente
7.  Negociação
8.  Convertido
9.  Perdido

As etapas definitivas poderão ser adaptadas ao processo comercial
utilizado pela Prime Sul.

### 6.2 Funil Administrativo

O administrador terá uma visão consolidada.

Poderá visualizar:

-   Todos os leads.
-   Todos os vendedores.
-   Quantidade por etapa.
-   Quantidade por vendedor.
-   Leads parados.
-   Leads convertidos.
-   Leads perdidos.
-   Leads aguardando retorno.

Também deverá existir filtro por:

-   Vendedor.
-   Etapa.
-   Período.
-   Status.
-   Tags.
-   Origem do lead.

------------------------------------------------------------------------

## 7. WhatsApp

O sistema será integrado à solução de WhatsApp já disponível para o
projeto.

Cada vendedor poderá possuir múltiplos números vinculados à sua conta.

A quantidade não deverá ficar limitada de forma fixa no código. O
administrador poderá definir quantos números cada vendedor pode
cadastrar.

Exemplo:

`Vendedor -> Números vinculados -> Número principal / números adicionais`

O vendedor poderá escolher o número utilizado para realizar determinado
contato ou definir um número padrão.

O painel administrativo poderá exibir o estado das conexões disponíveis.

------------------------------------------------------------------------

## 8. Disparo e Modelos de Mensagens

O sistema terá uma área para facilitar o envio de mensagens aos leads.

Poderão existir modelos como:

-   Primeiro contato.
-   Retorno.
-   Solicitação de documentação.
-   Envio de link de simulação.
-   Lembrete.
-   Reativação de lead.
-   Pós-atendimento.

O administrador poderá manter modelos padronizados para a equipe.

O vendedor poderá selecionar:

`Lead -> Número de envio -> Modelo -> Personalização -> Envio`

Campos dinâmicos poderão ser utilizados futuramente, por exemplo:

-   Nome do cliente.
-   Nome do vendedor.
-   Link.
-   Data.
-   Informações específicas do atendimento.

------------------------------------------------------------------------

## 9. Histórico do Lead

Cada lead possuirá uma linha do tempo.

Poderão ser registrados:

-   Data do cadastro.
-   Vendedor responsável.
-   Alterações de etapa.
-   Mensagens enviadas.
-   Observações.
-   Retornos agendados.
-   Transferências entre vendedores.
-   Mudanças importantes no cadastro.
-   Resultado final.

Isso permitirá reconstruir todo o processo comercial daquele cliente.

------------------------------------------------------------------------

## 10. Follow-up e Retornos

O vendedor poderá registrar uma próxima ação para cada lead.

Exemplos:

-   Ligar amanhã.
-   Retornar em três dias.
-   Cobrar documentação.
-   Confirmar recebimento do link.
-   Verificar resultado da simulação.

O sistema poderá apresentar uma área como:

### Retornos de Hoje

Mostrando os clientes que precisam de contato naquele dia.

Também poderão existir categorias como:

-   Atrasados.
-   Hoje.
-   Próximos.
-   Sem retorno definido.

------------------------------------------------------------------------

## 11. Tags e Organização

Os leads poderão receber tags para facilitar a gestão.

Exemplos:

-   Quente.
-   Morno.
-   Frio.
-   Documentação pendente.
-   Aguardando banco.
-   Aguardando cliente.
-   Prioridade.
-   Reativação.

As tags poderão ser utilizadas nos filtros do vendedor e do
administrador.

------------------------------------------------------------------------

## 12. Dashboard Administrativo

O painel inicial administrativo poderá apresentar indicadores como:

-   Total de leads.
-   Novos leads no período.
-   Leads em atendimento.
-   Leads convertidos.
-   Leads perdidos.
-   Leads sem movimentação.
-   Retornos atrasados.
-   Quantidade de leads por vendedor.
-   Conversões por vendedor.
-   Distribuição dos leads por etapa.

O objetivo não é somente registrar informações, mas oferecer ao
responsável pela operação uma visão real do andamento comercial.

------------------------------------------------------------------------

## 13. Dashboard do Vendedor

Cada vendedor poderá visualizar indicadores próprios:

-   Total de leads da carteira.
-   Novos leads.
-   Atendimentos em andamento.
-   Retornos do dia.
-   Retornos atrasados.
-   Simulações.
-   Conversões.
-   Leads perdidos.

O vendedor não terá acesso aos dados privados das carteiras dos demais
vendedores.

------------------------------------------------------------------------

## 14. Relatórios

O sistema poderá gerar relatórios por período.

Exemplos:

### Relatório Geral

-   Leads recebidos.
-   Leads trabalhados.
-   Leads convertidos.
-   Leads perdidos.
-   Taxa de conversão.
-   Distribuição por etapa.

### Relatório por Vendedor

-   Quantidade de leads.
-   Quantidade de contatos.
-   Movimentações.
-   Conversões.
-   Leads perdidos.
-   Leads sem movimentação.
-   Retornos pendentes.

### Relatório de Origem

Caso seja registrada a origem dos leads:

-   Campanha.
-   Indicação.
-   Site.
-   WhatsApp.
-   Lista.
-   Outro canal.

Isso permitirá identificar quais fontes estão trazendo melhores
resultados.

------------------------------------------------------------------------

## 15. Gestão da Equipe

Além do CRM, o sistema funcionará como ferramenta de acompanhamento
comercial.

O administrador poderá identificar rapidamente:

-   Quem está recebendo mais leads.
-   Quem está movimentando a carteira.
-   Quem possui leads parados.
-   Quem possui retornos atrasados.
-   Qual vendedor possui maior conversão.
-   Em quais etapas os clientes estão travando.

Essa camada transforma o projeto de uma simples ferramenta de disparo em
uma plataforma de gestão comercial.

------------------------------------------------------------------------

## 16. Auditoria e Segurança

Ações importantes deverão possuir registro.

Exemplos:

-   Quem cadastrou um lead.
-   Quando cadastrou.
-   Quem alterou uma etapa.
-   Quem transferiu o lead.
-   Alterações relevantes no cadastro.
-   Data e horário das operações.

A auditoria é especialmente importante porque vários vendedores
utilizarão uma base centralizada.

------------------------------------------------------------------------

## 17. Pesquisa Global

O sistema deverá possuir pesquisa rápida.

Possíveis campos:

-   CPF.
-   Telefone.
-   Nome.
-   ID do lead.

Antes mesmo de criar um cadastro, o vendedor poderá verificar se aquele
cliente já existe.

------------------------------------------------------------------------

## 18. Importação de Leads

Como evolução ou módulo adicional, o administrador poderá importar
listas de leads.

Exemplo:

`Planilha CSV/XLSX -> Validação -> Remoção de duplicados -> Distribuição`

Os leads poderão ser:

-   atribuídos manualmente;
-   divididos igualmente;
-   distribuídos em rodízio;
-   direcionados a vendedores específicos.

------------------------------------------------------------------------

## 19. Estrutura Conceitual

``` text
PRIME SUL
|
+-- Administrador
|   +-- Dashboard Geral
|   +-- Funil Geral
|   +-- Gestão de Vendedores
|   +-- Gestão de Leads
|   +-- WhatsApp
|   +-- Modelos de Mensagem
|   +-- Relatórios
|   +-- Auditoria
|   +-- Configurações
|
+-- Vendedor
    +-- Dashboard Individual
    +-- Meu Funil
    +-- Meus Leads
    +-- WhatsApp
    +-- Mensagens
    +-- Follow-ups
    +-- Histórico
    +-- Relatórios Individuais
```

------------------------------------------------------------------------

## 20. Estrutura Técnica Inicial

Uma arquitetura inicial possível:

-   **Frontend:** HTML, CSS e JavaScript.
-   **Backend:** Node.js.
-   **API:** REST + comunicação em tempo real quando necessária.
-   **Banco:** SQLite inicialmente, com possibilidade de migração
    conforme escala.
-   **WhatsApp:** integração com a solução/API já disponível no projeto.
-   **Autenticação:** contas individuais com controle de permissões.
-   **Perfis:** administrador e vendedor.

A arquitetura deverá manter os módulos separados para permitir evolução
sem necessidade de reconstruir o sistema inteiro.

------------------------------------------------------------------------

## 21. MVP

Para a primeira versão funcional, o foco poderá ser:

1.  Login.
2.  Administrador e vendedores.
3.  Cadastro de vendedores.
4.  Cadastro centralizado de leads.
5.  Bloqueio de duplicidade.
6.  Vínculo lead-vendedor.
7.  Funil individual.
8.  Funil geral administrativo.
9.  Integração WhatsApp.
10. Números configuráveis por vendedor.
11. Disparo de mensagens.
12. Histórico do lead.
13. Follow-ups.
14. Dashboard básico.
15. Relatórios básicos.

------------------------------------------------------------------------

## 22. Evoluções Futuras

Após validar o uso real da equipe, poderão ser adicionados:

-   Distribuição automática de leads.
-   Importação avançada de planilhas.
-   Regras automáticas de follow-up.
-   Alertas de leads parados.
-   Automação de tarefas repetitivas.
-   Indicadores avançados de conversão.
-   Metas por vendedor.
-   Ranking comercial.
-   Exportação de relatórios.
-   Integrações adicionais.
-   Inteligência artificial para auxiliar classificação e priorização
    dos leads.

------------------------------------------------------------------------

## 23. Resultado Esperado

O Prime Sul deverá centralizar a operação comercial em um único
ambiente.

Em vez de vendedores trabalharem com contatos e controles isolados, a
empresa passa a possuir uma base única, organizada e auditável, enquanto
cada vendedor continua responsável pela própria carteira.

O administrador obtém uma visão geral da operação e cada vendedor recebe
um ambiente focado no próprio trabalho.

O resultado esperado é:

**menos duplicidade + maior organização + acompanhamento da equipe +
histórico centralizado + controle de leads + comunicação integrada +
maior capacidade de gestão comercial.**
