/**
 * PRIME SUL — Carteira Service (Lead Management)
 * Ferramenta #1: Gerenciar carteira de clientes
 *
 * Schema real da tabela `leads` (ver server/database/db.js):
 * id, organization_id, seller_id, name, phone, cpf, agencia, conta, tags, city,
 * origem, limite_est, renda, valor_desejado, obs, prioridade, score, lead_code,
 * triage_status, triage_bot_number_id, phone2, phone3,
 * status IN ('novos','enviados','sim','nao','bloqueado','duplicado'),
 * created_at, updated_at
 *
 * Métodos:
 * - listLeads(sellerId, filters) — Listar leads com paginação
 * - createLead(sellerId, data) — Criar novo lead
 * - getLead(sellerId, leadId) — Obter lead específico
 * - updateLead(sellerId, leadId, data) — Atualizar lead
 * - deleteLead(sellerId, leadId) — Deletar lead (hard delete; schema não tem soft-delete)
 * - countsBySeller(sellerId) — Contar leads por status
 * - search(sellerId, query) — Buscar lead por nome/phone
 */

const VALID_STATUS = ['novos', 'enviados', 'sim', 'nao', 'bloqueado', 'duplicado'];
const VALID_PRIORIDADE = ['alta', 'media', 'baixa'];

class CarteiraService {
  constructor(dbModule) {
    // server/database/db.js exporta { db, init, migrate, run, get, all }
    this.run = dbModule.run;
    this.get = dbModule.get;
    this.all = dbModule.all;
  }

  /**
   * Listar leads com filtros e paginação
   *
   * @param {number} sellerId - ID do vendedor
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

    if (status && status !== 'todos') {
      where.push('status = ?');
      params.push(status);
    }

    if (prioridade && prioridade !== 'todos') {
      where.push('prioridade = ?');
      params.push(prioridade);
    }

    if (search) {
      where.push('(name LIKE ? OR phone LIKE ? OR cpf LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const countResult = await this.get(
      `SELECT COUNT(*) as total FROM leads WHERE ${where.join(' AND ')}`,
      params
    );
    const total = countResult?.total || 0;

    const pages = Math.ceil(total / limit);
    const validPage = Math.max(1, Math.min(page, pages || 1));
    const offset = (validPage - 1) * limit;

    const sortMap = {
      name: 'name ASC',
      created_at: 'created_at DESC',
      updated_at: 'updated_at DESC',
      score: 'score DESC',
      prioridade: 'prioridade DESC'
    };
    const orderBy = sortMap[sort] || 'created_at DESC';

    const leads = await this.all(
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
   * @param {number} sellerId - ID do vendedor
   * @param {Object} data - Dados do lead
   * @returns {Promise<Object>} Lead criado
   */
  async createLead(sellerId, data) {
    if (!data.name || !data.phone) {
      throw new Error('Nome e telefone são obrigatórios');
    }

    const {
      name,
      phone,
      cpf = null,
      city = null,
      prioridade = 'media',
      score = 0,
      status = 'novos',
      obs = null,
      renda = null,
      limite_est = null
    } = data;

    if (!VALID_PRIORIDADE.includes(prioridade)) {
      throw new Error('Prioridade inválida (alta, media, baixa)');
    }
    if (!VALID_STATUS.includes(status)) {
      throw new Error(`Status inválido (${VALID_STATUS.join(', ')})`);
    }

    const result = await this.run(
      `INSERT INTO leads
       (organization_id, seller_id, name, phone, cpf, city, prioridade, score, status, obs, renda, limite_est, origem, created_at, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL', datetime('now'), datetime('now'))`,
      [sellerId, name, phone, cpf, city, prioridade, score, status, obs, renda, limite_est]
    );

    const leadId = result?.lastID;
    return this.getLead(sellerId, leadId);
  }

  /**
   * Obter lead específico
   *
   * @param {number} sellerId - ID do vendedor
   * @param {number} leadId - ID do lead
   * @returns {Promise<Object>} Lead
   */
  async getLead(sellerId, leadId) {
    const lead = await this.get(
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
   * @param {number} sellerId - ID do vendedor
   * @param {number} leadId - ID do lead
   * @param {Object} data - Dados a atualizar
   * @returns {Promise<Object>} Lead atualizado
   */
  async updateLead(sellerId, leadId, data) {
    await this.getLead(sellerId, leadId);

    const allowed = ['name', 'phone', 'cpf', 'city', 'status', 'prioridade', 'score', 'obs', 'renda', 'limite_est'];
    const updates = {};

    for (const key of allowed) {
      if (key in data) {
        updates[key] = data[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return this.getLead(sellerId, leadId);
    }

    if (updates.prioridade && !VALID_PRIORIDADE.includes(updates.prioridade)) {
      throw new Error('Prioridade inválida (alta, media, baixa)');
    }

    if (updates.status && !VALID_STATUS.includes(updates.status)) {
      throw new Error(`Status inválido (${VALID_STATUS.join(', ')})`);
    }

    updates.updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const keys = Object.keys(updates);
    const values = Object.values(updates);

    await this.run(
      `UPDATE leads SET ${keys.map(k => `${k} = ?`).join(', ')}
       WHERE id = ? AND seller_id = ?`,
      [...values, leadId, sellerId]
    );

    return this.getLead(sellerId, leadId);
  }

  /**
   * Deletar lead (hard delete — schema real não possui coluna deleted_at)
   *
   * @param {number} sellerId - ID do vendedor
   * @param {number} leadId - ID do lead
   * @returns {Promise<boolean>} true se deletado
   */
  async deleteLead(sellerId, leadId) {
    await this.getLead(sellerId, leadId);

    await this.run(
      `DELETE FROM leads WHERE id = ? AND seller_id = ?`,
      [leadId, sellerId]
    );

    return true;
  }

  /**
   * Contar leads por status
   *
   * @param {number} sellerId - ID do vendedor
   * @returns {Promise<Object>} Contagem por status
   */
  async countsBySeller(sellerId) {
    const results = await this.all(
      `SELECT status, COUNT(*) as count
       FROM leads
       WHERE seller_id = ?
       GROUP BY status`,
      [sellerId]
    );

    const counts = {
      novos: 0,
      enviados: 0,
      sim: 0,
      nao: 0,
      bloqueado: 0,
      duplicado: 0
    };

    for (const row of results || []) {
      if (Object.prototype.hasOwnProperty.call(counts, row.status)) {
        counts[row.status] = row.count;
      }
    }

    counts.total = Object.values(counts).reduce((a, b) => a + b, 0);

    return counts;
  }

  /**
   * Buscar leads
   *
   * @param {number} sellerId - ID do vendedor
   * @param {string} query - Query (nome, telefone, cpf)
   * @returns {Promise<Array>} Leads encontrados (max 10)
   */
  async search(sellerId, query) {
    if (!query || query.length < 2) {
      return [];
    }

    const searchTerm = `%${query}%`;

    const leads = await this.all(
      `SELECT id, name, phone, cpf, status, prioridade
       FROM leads
       WHERE seller_id = ?
       AND (name LIKE ? OR phone LIKE ? OR cpf LIKE ?)
       ORDER BY name ASC
       LIMIT 10`,
      [sellerId, searchTerm, searchTerm, searchTerm]
    );

    return leads || [];
  }
}

/**
 * Factory function
 */
function createCarteiraService(dbModule) {
  return new CarteiraService(dbModule);
}

module.exports = { CarteiraService, createCarteiraService };
