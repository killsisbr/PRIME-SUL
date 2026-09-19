/**
 * PRIME SUL — Carteira Card (Frontend)
 * Ferramenta #1: UI para gerenciar leads
 * 
 * Exibe:
 * - Lista de leads (tabela)
 * - Filtros (status, prioridade)
 * - Paginação
 * - Busca
 * - Modal para criar/editar lead
 */

class CarteiraCard {
  constructor() {
    this.apiBase = '/api/leads';
    this.leads = [];
    this.page = 1;
    this.filters = {
      status: 'todos',
      prioridade: 'todos',
      search: ''
    };
    this.counts = {};
    this.init();
  }

  init() {
    this.createHTML();
    this.attachEvents();
    this.loadCounts();
    this.loadLeads();
  }

  /**
   * Criar estrutura HTML
   */
  createHTML() {
    const html = `
      <div class="carteira-container">
        <!-- Header -->
        <div class="carteira-header">
          <h2>📋 Carteira de Clientes</h2>
          <button class="btn-primary" id="btn-new-lead">
            ➕ Novo Lead
          </button>
        </div>

        <!-- Stats -->
        <div class="carteira-stats">
          <div class="stat-card">
            <span class="stat-label">Total</span>
            <span class="stat-value" id="stat-total">0</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Novo</span>
            <span class="stat-value" id="stat-novo">0</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Enviado</span>
            <span class="stat-value" id="stat-enviado">0</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Sim</span>
            <span class="stat-value" id="stat-sim">0</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">Não</span>
            <span class="stat-value" id="stat-nao">0</span>
          </div>
        </div>

        <!-- Filters -->
        <div class="carteira-filters">
          <input 
            type="text" 
            class="filter-input" 
            id="filter-search" 
            placeholder="🔍 Buscar por nome, telefone ou email..."
          >
          
          <select class="filter-select" id="filter-status">
            <option value="todos">Todos os Status</option>
            <option value="novo">Novo</option>
            <option value="enviado">Enviado</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
            <option value="bloqueado">Bloqueado</option>
          </select>

          <select class="filter-select" id="filter-prioridade">
            <option value="todos">Todas as Prioridades</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>

        <!-- Leads Table -->
        <div class="carteira-table-wrapper">
          <table class="carteira-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th>Email</th>
                <th>Status</th>
                <th>Prioridade</th>
                <th>Score</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody id="leads-tbody">
              <tr class="loading">
                <td colspan="7">Carregando...</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="carteira-pagination">
          <button class="btn-pagination" id="btn-prev">← Anterior</button>
          <span id="pagination-info"></span>
          <button class="btn-pagination" id="btn-next">Próximo →</button>
        </div>
      </div>

      <!-- Modal: Criar/Editar Lead -->
      <div class="modal" id="modal-lead">
        <div class="modal-content">
          <div class="modal-header">
            <h3 id="modal-title">Novo Lead</h3>
            <button class="modal-close" id="modal-close">&times;</button>
          </div>

          <form id="form-lead">
            <div class="form-group">
              <label>Nome *</label>
              <input type="text" name="name" required>
            </div>

            <div class="form-group">
              <label>Telefone *</label>
              <input type="tel" name="phone" required placeholder="(XX) XXXXX-XXXX">
            </div>

            <div class="form-group">
              <label>Email</label>
              <input type="email" name="email">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Status</label>
                <select name="status">
                  <option value="novo">Novo</option>
                  <option value="enviado">Enviado</option>
                  <option value="sim">Sim</option>
                  <option value="nao">Não</option>
                  <option value="bloqueado">Bloqueado</option>
                </select>
              </div>

              <div class="form-group">
                <label>Prioridade</label>
                <select name="prioridade">
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="baixa">Baixa</option>
                </select>
              </div>

              <div class="form-group">
                <label>Score</label>
                <input type="number" name="score" min="0" max="100">
              </div>
            </div>

            <div class="form-group">
              <label>Notas</label>
              <textarea name="notas" rows="3"></textarea>
            </div>

            <div class="form-actions">
              <button type="button" class="btn-secondary" id="btn-modal-cancel">Cancelar</button>
              <button type="submit" class="btn-primary">Salvar</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Inserir no DOM
    const container = document.querySelector('#assistant-popup') || document.body;
    container.innerHTML = html;
  }

  /**
   * Attach event listeners
   */
  attachEvents() {
    // Filtros
    document.getElementById('filter-search').addEventListener('change', () => {
      this.filters.search = this.value;
      this.page = 1;
      this.loadLeads();
    });

    document.getElementById('filter-status').addEventListener('change', (e) => {
      this.filters.status = e.target.value;
      this.page = 1;
      this.loadLeads();
    });

    document.getElementById('filter-prioridade').addEventListener('change', (e) => {
      this.filters.prioridade = e.target.value;
      this.page = 1;
      this.loadLeads();
    });

    // Botões
    document.getElementById('btn-new-lead').addEventListener('click', () => {
      this.openModal();
    });

    document.getElementById('btn-prev').addEventListener('click', () => {
      if (this.page > 1) {
        this.page--;
        this.loadLeads();
      }
    });

    document.getElementById('btn-next').addEventListener('click', () => {
      this.page++;
      this.loadLeads();
    });

    // Modal
    document.getElementById('modal-close').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('btn-modal-cancel').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('form-lead').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveLead();
    });

    // Fechar modal ao clicar fora
    document.getElementById('modal-lead').addEventListener('click', (e) => {
      if (e.target.id === 'modal-lead') {
        this.closeModal();
      }
    });
  }

  /**
   * Carregar contagem de leads
   */
  async loadCounts() {
    try {
      const response = await fetch(`${this.apiBase}/counts`);
      const json = await response.json();

      if (json.success) {
        this.counts = json.data;
        this.updateStats();
      }
    } catch (error) {
      console.error('Erro ao carregar contagens:', error);
    }
  }

  /**
   * Atualizar estatísticas
   */
  updateStats() {
    document.getElementById('stat-total').textContent = this.counts.total || 0;
    document.getElementById('stat-novo').textContent = this.counts.novo || 0;
    document.getElementById('stat-enviado').textContent = this.counts.enviado || 0;
    document.getElementById('stat-sim').textContent = this.counts.sim || 0;
    document.getElementById('stat-nao').textContent = this.counts.nao || 0;
  }

  /**
   * Carregar leads
   */
  async loadLeads() {
    try {
      const query = new URLSearchParams({
        status: this.filters.status,
        prioridade: this.filters.prioridade,
        search: this.filters.search,
        page: this.page
      });

      const response = await fetch(`${this.apiBase}?${query}`);
      const json = await response.json();

      if (json.success) {
        this.leads = json.data;
        this.renderLeads();
        this.updatePagination(json.pagination);
      }
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
      this.showError('Erro ao carregar leads');
    }
  }

  /**
   * Renderizar tabela de leads
   */
  renderLeads() {
    const tbody = document.getElementById('leads-tbody');

    if (this.leads.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">Nenhum lead encontrado</td></tr>';
      return;
    }

    tbody.innerHTML = this.leads.map(lead => `
      <tr>
        <td class="name">${this.escape(lead.name)}</td>
        <td>${this.formatPhone(lead.phone)}</td>
        <td>${this.escape(lead.email || '-')}</td>
        <td><span class="status-badge status-${lead.status}">${lead.status}</span></td>
        <td><span class="priority-badge priority-${lead.prioridade}">${lead.prioridade}</span></td>
        <td>${lead.score || 0}</td>
        <td class="actions">
          <button class="btn-small btn-edit" onclick="carteiraCard.editLead('${lead.id}')">✏️ Editar</button>
          <button class="btn-small btn-delete" onclick="carteiraCard.deleteLead('${lead.id}')">🗑️ Deletar</button>
        </td>
      </tr>
    `).join('');
  }

  /**
   * Atualizar paginação
   */
  updatePagination(pagination) {
    document.getElementById('pagination-info').textContent = 
      `Página ${pagination.page} de ${pagination.pages}`;

    document.getElementById('btn-prev').disabled = pagination.page === 1;
    document.getElementById('btn-next').disabled = pagination.page === pagination.pages;
  }

  /**
   * Abrir modal para novo lead
   */
  openModal(lead = null) {
    const modal = document.getElementById('modal-lead');
    const form = document.getElementById('form-lead');
    const title = document.getElementById('modal-title');

    form.reset();

    if (lead) {
      title.textContent = 'Editar Lead';
      document.querySelector('input[name="name"]').value = lead.name;
      document.querySelector('input[name="phone"]').value = lead.phone;
      document.querySelector('input[name="email"]').value = lead.email || '';
      document.querySelector('select[name="status"]').value = lead.status;
      document.querySelector('select[name="prioridade"]').value = lead.prioridade;
      document.querySelector('input[name="score"]').value = lead.score || 0;
      document.querySelector('textarea[name="notas"]').value = lead.notas || '';
      form.dataset.leadId = lead.id;
    } else {
      title.textContent = 'Novo Lead';
      delete form.dataset.leadId;
    }

    modal.classList.add('active');
  }

  /**
   * Fechar modal
   */
  closeModal() {
    document.getElementById('modal-lead').classList.remove('active');
  }

  /**
   * Editar lead
   */
  async editLead(leadId) {
    try {
      const response = await fetch(`${this.apiBase}/${leadId}`);
      const json = await response.json();

      if (json.success) {
        this.openModal(json.data);
      }
    } catch (error) {
      console.error('Erro ao carregar lead:', error);
      this.showError('Erro ao carregar lead');
    }
  }

  /**
   * Salvar lead
   */
  async saveLead() {
    const form = document.getElementById('form-lead');
    const leadId = form.dataset.leadId;

    const data = {
      name: form.elements.name.value,
      phone: form.elements.phone.value,
      email: form.elements.email.value,
      status: form.elements.status.value,
      prioridade: form.elements.prioridade.value,
      score: parseInt(form.elements.score.value) || 0,
      notas: form.elements.notas.value
    };

    try {
      const url = leadId ? `${this.apiBase}/${leadId}` : this.apiBase;
      const method = leadId ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const json = await response.json();

      if (json.success) {
        this.showSuccess(json.message);
        this.closeModal();
        this.loadCounts();
        this.loadLeads();
      } else {
        this.showError(json.error);
      }
    } catch (error) {
      console.error('Erro ao salvar lead:', error);
      this.showError('Erro ao salvar lead');
    }
  }

  /**
   * Deletar lead
   */
  async deleteLead(leadId) {
    if (!confirm('Tem certeza que deseja deletar este lead?')) {
      return;
    }

    try {
      const response = await fetch(`${this.apiBase}/${leadId}`, { method: 'DELETE' });
      const json = await response.json();

      if (json.success) {
        this.showSuccess(json.message);
        this.loadCounts();
        this.loadLeads();
      } else {
        this.showError(json.error);
      }
    } catch (error) {
      console.error('Erro ao deletar lead:', error);
      this.showError('Erro ao deletar lead');
    }
  }

  /**
   * Helpers
   */
  escape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  formatPhone(phone) {
    if (!phone) return '-';
    return phone.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
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
  window.carteiraCard = new CarteiraCard();
});
