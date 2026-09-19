/**
 * PRIME SUL — Disparo Card (Frontend)
 * Ferramenta #3: Interface para criar e gerenciar campanhas
 * 
 * Features:
 * - Campaign builder (nome, mensagem, público-alvo)
 * - Preview em tempo real
 * - Scheduler (data/hora)
 * - Status tracking
 * - Lista de campanhas
 */

class DisparoCard {
  constructor() {
    this.apiBase = '/api/disparo';
    this.init();
  }

  init() {
    this.createHTML();
    this.attachEvents();
    this.loadCampaigns();
  }

  /**
   * Criar estrutura HTML
   */
  createHTML() {
    const html = `
      <div class="disparo-container">
        <!-- Header -->
        <div class="disparo-header">
          <h2>📤 Disparo Comercial</h2>
          <button id="btn-new-campaign" class="btn-primary">
            + Nova Campanha
          </button>
        </div>

        <!-- Main Grid -->
        <div class="disparo-grid">
          <!-- Nova Campanha (builder) -->
          <div id="campaign-builder" class="campaign-builder" style="display: none;">
            <div class="builder-section">
              <h3>Criar Campanha</h3>
              
              <!-- Nome -->
              <div class="form-group">
                <label>Nome da Campanha</label>
                <input type="text" id="campaign-name" placeholder="ex: Oferta Black Friday" />
              </div>

              <!-- Mensagem -->
              <div class="form-group">
                <label>Mensagem (suporta {nome}, {primeiro_nome}, {telefone})</label>
                <textarea id="campaign-message" placeholder="Olá {primeiro_nome}! Temos uma oferta especial para você..." rows="4"></textarea>
              </div>

              <!-- Público-alvo -->
              <div class="form-row">
                <div class="form-group">
                  <label>Status dos Leads</label>
                  <select id="campaign-status">
                    <option value="">Todos</option>
                    <option value="novo">Novo</option>
                    <option value="enviado">Enviado</option>
                    <option value="sim">Sim</option>
                  </select>
                </div>

                <div class="form-group">
                  <label>Prioridade</label>
                  <select id="campaign-priority">
                    <option value="">Todos</option>
                    <option value="alta">Alta</option>
                    <option value="media">Média</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </div>
              </div>

              <!-- Agendamento -->
              <div class="form-group">
                <label>Agendar para (opcional)</label>
                <input type="datetime-local" id="campaign-scheduled-at" />
              </div>

              <!-- Preview -->
              <div class="preview-box">
                <h4>Preview</h4>
                <div id="message-preview" class="preview-content">
                  (Escreva a mensagem para ver preview)
                </div>
              </div>

              <!-- Público-alvo info -->
              <div class="target-info">
                <span id="target-count">0</span> leads serão alcançados
              </div>

              <!-- Ações -->
              <div class="form-actions">
                <button id="btn-save-campaign" class="btn-primary">Salvar Campanha</button>
                <button id="btn-cancel-builder" class="btn-secondary">Cancelar</button>
              </div>
            </div>
          </div>

          <!-- Lista de Campanhas -->
          <div id="campaigns-list" class="campaigns-list">
            <div class="list-header">
              <h3>Minhas Campanhas</h3>
              <select id="filter-status" class="filter-select">
                <option value="">Todos os status</option>
                <option value="draft">Rascunho</option>
                <option value="active">Ativa</option>
                <option value="paused">Pausada</option>
                <option value="completed">Completa</option>
              </select>
            </div>

            <div id="campaigns-table-wrapper"></div>
          </div>
        </div>

        <!-- Modal para detalhe de campanha -->
        <div id="campaign-modal" class="modal">
          <div class="modal-content">
            <div class="modal-header">
              <h3 id="modal-title">Detalhes da Campanha</h3>
              <button class="modal-close" onclick="disparoCard.closeModal()">×</button>
            </div>

            <div id="modal-body" class="modal-body"></div>

            <div class="modal-footer">
              <button id="btn-modal-action" class="btn-primary">Iniciar</button>
              <button onclick="disparoCard.closeModal()" class="btn-secondary">Fechar</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const container = document.querySelector('#assistant-popup') || document.body;
    container.innerHTML = html;
  }

  /**
   * Attach event listeners
   */
  attachEvents() {
    // Nova campanha
    document.getElementById('btn-new-campaign').addEventListener('click', () => {
      document.getElementById('campaign-builder').style.display = 'block';
      document.getElementById('campaigns-list').style.display = 'none';
    });

    // Cancelar builder
    document.getElementById('btn-cancel-builder').addEventListener('click', () => {
      document.getElementById('campaign-builder').style.display = 'none';
      document.getElementById('campaigns-list').style.display = 'block';
    });

    // Preview em tempo real
    document.getElementById('campaign-message').addEventListener('input', () => {
      this.updatePreview();
    });

    document.getElementById('campaign-name').addEventListener('input', () => {
      this.updatePreview();
    });

    // Salvar campanha
    document.getElementById('btn-save-campaign').addEventListener('click', () => {
      this.saveCampaign();
    });

    // Filtro status
    document.getElementById('filter-status').addEventListener('change', () => {
      this.loadCampaigns();
    });
  }

  /**
   * Carregar campanhas
   */
  async loadCampaigns() {
    try {
      const status = document.getElementById('filter-status').value;
      const query = status ? `?status=${status}` : '';

      const response = await fetch(`${this.apiBase}${query}`);
      const json = await response.json();

      if (json.success) {
        this.renderCampaigns(json.data.campaigns);
      }
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
      this.showError('Erro ao carregar campanhas');
    }
  }

  /**
   * Renderizar campanhas em tabela
   */
  renderCampaigns(campaigns) {
    if (campaigns.length === 0) {
      document.getElementById('campaigns-table-wrapper').innerHTML = 
        '<p style="padding: 16px; color: #999; text-align: center;">Nenhuma campanha criada. Clique em "Nova Campanha" para começar.</p>';
      return;
    }

    const html = `
      <table class="campaigns-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Status</th>
            <th>Mensagem</th>
            <th>Público</th>
            <th>Criada em</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${campaigns.map(c => `
            <tr>
              <td><strong>${this.escape(c.name)}</strong></td>
              <td><span class="status-badge status-${c.status}">${c.status}</span></td>
              <td>${this.escape(c.message.substring(0, 30))}...</td>
              <td>${c.stats?.total || 0}</td>
              <td>${new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
              <td class="actions">
                <button onclick="disparoCard.openCampaignDetail('${c.id}')" class="btn-small btn-edit">Ver</button>
                ${c.status === 'draft' ? `
                  <button onclick="disparoCard.startCampaign('${c.id}')" class="btn-small" style="background: #e8f5e9; color: #2e7d32;">Iniciar</button>
                ` : ''}
                ${c.status === 'active' ? `
                  <button onclick="disparoCard.pauseCampaign('${c.id}')" class="btn-small" style="background: #fff3e0; color: #f57c00;">Pausar</button>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    document.getElementById('campaigns-table-wrapper').innerHTML = html;
  }

  /**
   * Abrir detalhe da campanha
   */
  async openCampaignDetail(campaignId) {
    try {
      const response = await fetch(`${this.apiBase}/${campaignId}`);
      const json = await response.json();

      if (json.success) {
        this.renderCampaignModal(json.data);
        document.getElementById('campaign-modal').classList.add('active');
      }
    } catch (error) {
      console.error('Erro ao carregar campanha:', error);
      this.showError('Erro ao carregar campanha');
    }
  }

  /**
   * Renderizar modal de campanha
   */
  renderCampaignModal(campaign) {
    const { stats } = campaign;
    const html = `
      <div class="campaign-detail">
        <div class="detail-section">
          <h4>Informações</h4>
          <p><strong>Nome:</strong> ${this.escape(campaign.name)}</p>
          <p><strong>Status:</strong> <span class="status-badge status-${campaign.status}">${campaign.status}</span></p>
          <p><strong>Criada em:</strong> ${new Date(campaign.created_at).toLocaleDateString('pt-BR')}</p>
        </div>

        <div class="detail-section">
          <h4>Mensagem</h4>
          <div class="message-box">${this.escape(campaign.message)}</div>
        </div>

        <div class="detail-section">
          <h4>Estatísticas</h4>
          <div class="stats-grid">
            <div class="stat"><span class="stat-label">Total</span> <span class="stat-value">${stats.total}</span></div>
            <div class="stat"><span class="stat-label">Enviados</span> <span class="stat-value">${stats.sent}</span></div>
            <div class="stat"><span class="stat-label">Entregues</span> <span class="stat-value">${stats.delivered}</span></div>
            <div class="stat"><span class="stat-label">Lidos</span> <span class="stat-value">${stats.read}</span></div>
            <div class="stat"><span class="stat-label">Falhados</span> <span class="stat-value">${stats.failed}</span></div>
            <div class="stat"><span class="stat-label">Taxa Entrega</span> <span class="stat-value">${stats.deliveryRate}%</span></div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-body').innerHTML = html;

    // Atualizar botão de ação
    const btnAction = document.getElementById('btn-modal-action');
    if (campaign.status === 'draft') {
      btnAction.textContent = 'Iniciar Campanha';
      btnAction.onclick = () => this.startCampaign(campaign.id);
    } else if (campaign.status === 'active') {
      btnAction.textContent = 'Pausar';
      btnAction.onclick = () => this.pauseCampaign(campaign.id);
    } else {
      btnAction.style.display = 'none';
    }
  }

  /**
   * Atualizar preview
   */
  updatePreview() {
    const message = document.getElementById('campaign-message').value;
    const name = 'João Silva';

    if (!message) {
      document.getElementById('message-preview').innerHTML = '(Escreva a mensagem para ver preview)';
      return;
    }

    const preview = message
      .replace(/{nome}/g, name)
      .replace(/{primeiro_nome}/g, name.split(' ')[0])
      .replace(/{telefone}/g, '11999999999');

    document.getElementById('message-preview').innerHTML = this.escape(preview);
  }

  /**
   * Salvar campanha
   */
  async saveCampaign() {
    const name = document.getElementById('campaign-name').value.trim();
    const message = document.getElementById('campaign-message').value.trim();
    const status = document.getElementById('campaign-status').value;
    const priority = document.getElementById('campaign-priority').value;
    const scheduledAt = document.getElementById('campaign-scheduled-at').value;

    if (!name || !message) {
      this.showError('Preencha nome e mensagem');
      return;
    }

    try {
      const response = await fetch(this.apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          message,
          targetFilter: {
            status: status || undefined,
            prioridade: priority || undefined
          },
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null
        })
      });

      const json = await response.json();

      if (json.success) {
        this.showSuccess('Campanha criada com sucesso!');
        document.getElementById('campaign-builder').style.display = 'none';
        document.getElementById('campaigns-list').style.display = 'block';
        document.getElementById('campaign-name').value = '';
        document.getElementById('campaign-message').value = '';
        this.loadCampaigns();
      } else {
        this.showError(json.error);
      }
    } catch (error) {
      console.error('Erro ao salvar:', error);
      this.showError('Erro ao salvar campanha');
    }
  }

  /**
   * Iniciar campanha
   */
  async startCampaign(campaignId) {
    try {
      const response = await fetch(`${this.apiBase}/${campaignId}/start`, {
        method: 'POST'
      });

      const json = await response.json();

      if (json.success) {
        this.showSuccess('Campanha iniciada!');
        this.closeModal();
        this.loadCampaigns();
      } else {
        this.showError(json.error);
      }
    } catch (error) {
      console.error('Erro:', error);
      this.showError('Erro ao iniciar campanha');
    }
  }

  /**
   * Pausar campanha
   */
  async pauseCampaign(campaignId) {
    try {
      const response = await fetch(`${this.apiBase}/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' })
      });

      const json = await response.json();

      if (json.success) {
        this.showSuccess('Campanha pausada!');
        this.closeModal();
        this.loadCampaigns();
      } else {
        this.showError(json.error);
      }
    } catch (error) {
      console.error('Erro:', error);
      this.showError('Erro ao pausar campanha');
    }
  }

  /**
   * Helpers
   */
  escape(text) {
    return (text || '').replace(/[<>]/g, c => c === '<' ? '&lt;' : '&gt;');
  }

  closeModal() {
    document.getElementById('campaign-modal').classList.remove('active');
  }

  showSuccess(message) {
    alert(`✅ ${message}`);
  }

  showError(message) {
    alert(`❌ ${message}`);
  }
}

// Inicializar quando DOM carregar
document.addEventListener('DOMContentLoaded', () => {
  window.disparoCard = new DisparoCard();
});
