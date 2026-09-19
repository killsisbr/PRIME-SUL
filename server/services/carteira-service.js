/**
 * PRIME SUL — Carteira Service (Lead Management)
 * Ferramenta #1: Gerenciar carteira de clientes
 * 
 * Métodos:
 * - listLeads(sellerId, filters) — Listar leads com paginação
 * - createLead(sellerId, data) — Criar novo lead
 * - getLead(sellerId, leadId) — Obter lead específico
 * - updateLead(sellerId, leadId, data) — Atualizar lead
 * - deleteLead(sellerId, leadId) — Deletar lead
 * - countsBySeller(sellerId) — Contar leads por status
 * - search(sellerId, query) — Buscar lead por nome/phone/email
 */

export class CarteiraService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Listar leads com filtros e paginação
   * 
   * @param {string} sellerId - ID do vendedor
   * @param {Object} filters - Filtros (status, prioridade, page, sort, search)
   * @returns {Promise<{leads: Array, total: number, page: number, pages: number}>}
   */
  async listLeads(sellerId, filters = {}) {
    const {
      status,
      prioridade,
      page = 1,
      sort = 'created_at',
      search = '',
      limit = 20
    } = filters;

    const where = ['seller_id = ?'];
    const params = [sellerId];

    // Filtro por status
    if (status && status !== 'todos') {
      where.push('status = ?');
      params.push(status);
    }

    // Filtro por prioridade
    if (prioridade && prioridade !== 'todos') {
      where.push('prioridade = ?');
      params.push(prioridade);
    }

    // Busca por nome, telefone ou email
    if (search) {
      where.push('(name LIKE ? OR phone LIKE ? OR email LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Contar total
    const countResult = await this.db.get(
      `SELECT COUNT(*) as total FROM leads WHERE ${where.join(' AND ')}`,
      params
    );
    const total = countResult?.total || 0;

    // Validar página
    const pages = Math.ceil(total / limit);
    const validPage = Math.max(1, Math.min(page, pages || 1));
    const offset = (validPage - 1) * limit;

    // Mapear ordenação
    const sortMap = {
      'name': 'name ASC',
      'created_at': 'created_at DESC',
      'updated_at': 'updated_at DESC',
      'score': 'score DESC',
      'prioridade': 'prioridade DESC'
    };
    const orderBy = sortMap[sort] || 'created_at DESC';

    // Listar leads
    const leads = await this.db.all(
      `SELECT * FROM leads 
       WHERE ${where.join(' AND ')} 
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      leads: leads || [],
      total,
      page: validPage,
      pages: Math.max(1, pages),
      limit
    };
  }

  /**
   * Criar novo lead
   * 
   * @param {string} sellerId - ID do vendedor
   * @param {Object} data - Dados do lead {name, phone, email, prioridade, score}
   * @returns {Promise<Object>} Lead criado
   */
  async createLead(sellerId, data) {
    // Validação
    if (!data.name || !data.phone) {
      throw new Error('Nome e telefone são obrigatórios');
    }

    const {
      name,
      phone,
      email = '',
      prioridade = 'media',
      score = 0,
      status = 'novo',
      notas = ''
    } = data;

    // Validar prioridade
    if (!['alta', 'media', 'baixa'].includes(prioridade)) {
      throw new Error('Prioridade inválida (alta, media, baixa)');
    }

    const leadId = this.generateId();
    const now = new Date().toISOString();

    await this.db.run(
      `INSERT INTO leads 
       (id, seller_id, name, phone, email, prioridade, score, status, notas, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [leadId, sellerId, name, phone, email, prioridade, score, status, notas, now, now]
    );

    return this.getLead(sellerId, leadId);
  }

  /**
   * Obter lead específico
   * 
   * @param {string} sellerId - ID do vendedor
   * @param {string} leadId - ID do lead
   * @returns {Promise<Object|null>} Lead ou null
   */
  async getLead(sellerId, leadId) {
    const lead = await this.db.get(
      `SELECT * FROM leads WHERE id = ? AND seller_id = ?`,
      [leadId, sellerId]
    );

    if (!lead) {
      throw new Error('Lead não encontrado');
    }

    return lead;
  }

  /**
   * Atualizar lead
   * 
   * @param {string} sellerId - ID do vendedor
   * @param {string} leadId - ID do lead
   * @param {Object} data - Dados a atualizar
   * @returns {Promise<Object>} Lead atualizado
   */
  async updateLead(sellerId, leadId, data) {
    // Validar que lead existe
    await this.getLead(sellerId, leadId);

    // Campos permitidos para atualizar
    const allowed = ['name', 'phone', 'email', 'status', 'prioridade', 'score', 'notas'];
    const updates = {};

    for (const key of allowed) {
      if (key in data) {
        updates[key] = data[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return this.getLead(sellerId, leadId);
    }

    // Validar prioridade se informada
    if (updates.prioridade && !['alta', 'media', 'baixa'].includes(updates.prioridade)) {
      throw new Error('Prioridade inválida (alta, media, baixa)');
    }

    // Validar status se informado
    if (updates.status && !['novo', 'enviado', 'sim', 'nao', 'bloqueado'].includes(updates.status)) {
      throw new Error('Status inválido (novo, enviado, sim, nao, bloqueado)');
    }

    updates.updated_at = new Date().toISOString();

    const keys = Object.keys(updates);
    const values = Object.values(updates);

    await this.db.run(
      `UPDATE leads SET ${keys.map(k => `${k} = ?`).join(', ')} 
       WHERE id = ? AND seller_id = ?`,
      [...values, leadId, sellerId]
    );

    return this.getLead(sellerId, leadId);
  }

  /**
   * Deletar lead (soft delete)
   * 
   * @param {string} sellerId - ID do vendedor
   * @param {string} leadId - ID do lead
   * @returns {Promise<boolean>} true se deletado
   */
  async deleteLead(sellerId, leadId) {
    await this.getLead(sellerId, leadId);

    const now = new Date().toISOString();

    await this.db.run(
      `UPDATE leads SET deleted_at = ?, updated_at = ? 
       WHERE id = ? AND seller_id = ?`,
      [now, now, leadId, sellerId]
    );

    return true;
  }

  /**
   * Contar leads por status
   * 
   * @param {string} sellerId - ID do vendedor
   * @returns {Promise<Object>} Contagem por status {novo: 5, enviado: 3, ...}
   */
  async countsBySeller(sellerId) {
    const results = await this.db.all(
      `SELECT status, COUNT(*) as count 
       FROM leads 
       WHERE seller_id = ? AND deleted_at IS NULL
       GROUP BY status`,
      [sellerId]
    );

    const counts = {
      novo: 0,
      enviado: 0,
      sim: 0,
      nao: 0,
      bloqueado: 0
    };

    for (const row of results || []) {
      if (counts.hasOwnProperty(row.status)) {
        counts[row.status] = row.count;
      }
    }

    counts.total = Object.values(counts).reduce((a, b) => a + b, 0);

    return counts;
  }

  /**
   * Buscar leads
   * 
   * @param {string} sellerId - ID do vendedor
   * @param {string} query - Query (nome, telefone, email)
   * @returns {Promise<Array>} Leads encontrados (max 10)
   */
  async search(sellerId, query) {
    if (!query || query.length < 2) {
      return [];
    }

    const searchTerm = `%${query}%`;

    const leads = await this.db.all(
      `SELECT id, name, phone, email, status, prioridade 
       FROM leads 
       WHERE seller_id = ? 
       AND deleted_at IS NULL
       AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)
       ORDER BY name ASC
       LIMIT 10`,
      [sellerId, searchTerm, searchTerm, searchTerm]
    );

    return leads || [];
  }

  /**
   * Gerar ID único
   * @private
   */
  generateId() {
    return `lead_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Factory function
 */
export function createCarteiraService(db) {
  return new CarteiraService(db);
}
