/**
 * PRIME SUL — Disparo Service (Disparo Comercial)
 * Ferramenta #3: Gerenciar campanhas de envio com marketing elaborado
 * 
 * Métodos:
 * - createCampaign(sellerId, data) — Criar nova campanha
 * - getCampaign(sellerId, campaignId) — Obter campanha
 * - listCampaigns(sellerId, filters) — Listar campanhas
 * - startCampaign(sellerId, campaignId) — Iniciar envios
 * - pauseCampaign(sellerId, campaignId) — Pausar envios
 * - cancelCampaign(sellerId, campaignId) — Cancelar campanha
 * - getCampaignStats(sellerId, campaignId) — Estatísticas
 * - previewMessage(message, lead, vars) — Preview com variáveis
 */

export class DisparoService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Criar nova campanha
   * 
   * @param {string} sellerId - ID do vendedor
   * @param {Object} data - Dados da campanha
   * @returns {Promise<Object>} Campanha criada
   */
  async createCampaign(sellerId, data) {
    // Validação
    if (!data.name || !data.message) {
      throw new Error('Nome e mensagem são obrigatórios');
    }

    if (data.name.length < 3) {
      throw new Error('Nome deve ter pelo menos 3 caracteres');
    }

    if (data.message.length < 10) {
      throw new Error('Mensagem deve ter pelo menos 10 caracteres');
    }

    // Validar público-alvo
    const targetCount = await this.validateTarget(sellerId, data.targetFilter);
    if (targetCount === 0) {
      throw new Error('Nenhum lead corresponde aos critérios de público-alvo');
    }

    // Gerar ID
    const id = `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Inserir
    const now = new Date().toISOString();
    await this.db.run(
      `INSERT INTO campaigns (
        id, seller_id, name, message, target_filter, 
        template_vars, scheduled_at, status, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sellerId,
        data.name,
        data.message,
        JSON.stringify(data.targetFilter || {}),
        JSON.stringify(data.templateVars || {}),
        data.scheduledAt || null,
        'draft',
        now,
        now
      ]
    );

    return this.getCampaign(sellerId, id);
  }

  /**
   * Obter campanha por ID
   */
  async getCampaign(sellerId, campaignId) {
    const campaign = await this.db.get(
      `SELECT * FROM campaigns 
       WHERE id = ? AND seller_id = ? AND deleted_at IS NULL`,
      [campaignId, sellerId]
    );

    if (!campaign) {
      throw new Error('Campanha não encontrada');
    }

    // Parse JSON fields
    campaign.targetFilter = JSON.parse(campaign.targetFilter || '{}');
    campaign.templateVars = JSON.parse(campaign.templateVars || '{}');

    // Adicionar stats
    const stats = await this.getCampaignStats(sellerId, campaignId);
    campaign.stats = stats;

    return campaign;
  }

  /**
   * Listar campanhas com filtros
   */
  async listCampaigns(sellerId, filters = {}) {
    const {
      status = null,
      page = 1,
      limit = 20,
      sort = 'created_at'
    } = filters;

    let query = `SELECT * FROM campaigns 
                 WHERE seller_id = ? AND deleted_at IS NULL`;
    let params = [sellerId];

    // Filtro status
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    // Ordenação
    const validSorts = ['created_at', 'updated_at', 'scheduled_at', 'name'];
    const sortCol = validSorts.includes(sort) ? sort : 'created_at';
    query += ` ORDER BY ${sortCol} DESC`;

    // Paginação
    const offset = (page - 1) * limit;
    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    // Contar total
    const countResult = await this.db.get(
      `SELECT COUNT(*) as total FROM campaigns 
       WHERE seller_id = ? AND deleted_at IS NULL ${status ? 'AND status = ?' : ''}`,
      [sellerId, ...(status ? [status] : [])]
    );

    const campaigns = await this.db.all(query, params);

    return {
      campaigns: (campaigns || []).map(c => ({
        ...c,
        targetFilter: JSON.parse(c.targetFilter || '{}'),
        templateVars: JSON.parse(c.templateVars || '{}')
      })),
      pagination: {
        total: countResult.total,
        page,
        pages: Math.ceil(countResult.total / limit),
        limit
      }
    };
  }

  /**
   * Iniciar campanha (muda status para "active")
   */
  async startCampaign(sellerId, campaignId) {
    const campaign = await this.getCampaign(sellerId, campaignId);

    if (campaign.status !== 'draft') {
      throw new Error(`Campanha deve estar em rascunho para iniciar (atual: ${campaign.status})`);
    }

    const now = new Date().toISOString();
    await this.db.run(
      `UPDATE campaigns 
       SET status = ?, started_at = ?, updated_at = ?
       WHERE id = ? AND seller_id = ?`,
      ['active', now, now, campaignId, sellerId]
    );

    // Criar envios na fila
    await this.createSends(sellerId, campaignId, campaign.targetFilter);

    return this.getCampaign(sellerId, campaignId);
  }

  /**
   * Pausar campanha
   */
  async pauseCampaign(sellerId, campaignId) {
    const campaign = await this.getCampaign(sellerId, campaignId);

    if (campaign.status !== 'active') {
      throw new Error(`Campanha deve estar ativa para pausar`);
    }

    const now = new Date().toISOString();
    await this.db.run(
      `UPDATE campaigns 
       SET status = ?, updated_at = ?
       WHERE id = ? AND seller_id = ?`,
      ['paused', now, campaignId, sellerId]
    );

    return this.getCampaign(sellerId, campaignId);
  }

  /**
   * Cancelar campanha (soft delete)
   */
  async cancelCampaign(sellerId, campaignId) {
    const campaign = await this.getCampaign(sellerId, campaignId);

    if (campaign.status === 'completed') {
      throw new Error('Campanha já foi concluída e não pode ser cancelada');
    }

    const now = new Date().toISOString();
    await this.db.run(
      `UPDATE campaigns 
       SET status = ?, deleted_at = ?, updated_at = ?
       WHERE id = ? AND seller_id = ?`,
      ['canceled', now, now, campaignId, sellerId]
    );

    return this.getCampaign(sellerId, campaignId);
  }

  /**
   * Obter estatísticas da campanha
   */
  async getCampaignStats(sellerId, campaignId) {
    // Verificar propriedade
    const campaign = await this.db.get(
      `SELECT id FROM campaigns WHERE id = ? AND seller_id = ?`,
      [campaignId, sellerId]
    );

    if (!campaign) {
      throw new Error('Campanha não encontrada');
    }

    // Contar envios por status
    const stats = await this.db.get(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read,
        SUM(CASE WHEN status = 'clicked' THEN 1 ELSE 0 END) as clicked
       FROM sends
       WHERE campaign_id = ?`,
      [campaignId]
    );

    const total = stats.total || 0;
    const sent = stats.sent || 0;
    const delivered = stats.delivered || 0;
    const read = stats.read || 0;
    const failed = stats.failed || 0;

    return {
      total,
      pending: stats.pending || 0,
      sent,
      delivered,
      failed,
      read,
      clicked: stats.clicked || 0,
      deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
      readRate: delivered > 0 ? Math.round((read / delivered) * 100) : 0,
      failureRate: total > 0 ? Math.round((failed / total) * 100) : 0
    };
  }

  /**
   * Preview de mensagem com variáveis
   * 
   * @param {string} message - Template de mensagem
   * @param {Object} lead - Dados do lead
   * @param {Object} vars - Variáveis adicionais
   * @returns {string} Mensagem formatada
   */
  previewMessage(message, lead = {}, vars = {}) {
    // Variáveis disponíveis
    const variables = {
      '{nome}': lead.name || '',
      '{primeiro_nome}': (lead.name || '').split(' ')[0] || '',
      '{telefone}': lead.phone || '',
      '{email}': lead.email || '',
      '{status}': lead.status || '',
      '{prioridade}': lead.prioridade || '',
      '{score}': lead.score || '',
      ...vars
    };

    // Substituir variáveis
    let preview = message;
    for (const [key, value] of Object.entries(variables)) {
      preview = preview.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    }

    return preview;
  }

  /**
   * Validar público-alvo (quantos leads correspondem)
   * @private
   */
  async validateTarget(sellerId, filter = {}) {
    const { status, prioridade } = filter;

    let query = `SELECT COUNT(*) as count FROM leads 
                 WHERE seller_id = ? AND deleted_at IS NULL`;
    let params = [sellerId];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    if (prioridade) {
      query += ` AND prioridade = ?`;
      params.push(prioridade);
    }

    const result = await this.db.get(query, params);
    return result.count || 0;
  }

  /**
   * Criar registros de envio (fila)
   * @private
   */
  async createSends(sellerId, campaignId, targetFilter) {
    const { status, prioridade } = targetFilter;

    // Obter leads que correspondem
    let query = `SELECT id FROM leads 
                 WHERE seller_id = ? AND deleted_at IS NULL`;
    let params = [sellerId];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }

    if (prioridade) {
      query += ` AND prioridade = ?`;
      params.push(prioridade);
    }

    const leads = await this.db.all(query, params);

    // Criar sends
    const now = new Date().toISOString();
    for (const lead of leads || []) {
      const sendId = `send_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await this.db.run(
        `INSERT INTO sends (
          id, campaign_id, lead_id, seller_id, 
          status, attempts, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sendId,
          campaignId,
          lead.id,
          sellerId,
          'pending',
          0,
          now,
          now
        ]
      );
    }
  }

  /**
   * Obter próximos envios para processar (fila)
   */
  async getNextSends(limit = 50) {
    return this.db.all(
      `SELECT 
        s.*, c.message, c.template_vars,
        l.phone, l.name
       FROM sends s
       JOIN campaigns c ON s.campaign_id = c.id
       JOIN leads l ON s.lead_id = l.id
       WHERE s.status = 'pending' AND c.status = 'active'
       AND s.attempts < 5
       ORDER BY s.created_at ASC
       LIMIT ?`,
      [limit]
    );
  }

  /**
   * Marcar envio como processado
   */
  async markSendAsProcessed(sendId, result) {
    const now = new Date().toISOString();
    const status = result.success ? 'sent' : 'failed';

    await this.db.run(
      `UPDATE sends 
       SET status = ?, attempts = attempts + 1, 
           last_error = ?, updated_at = ?
       WHERE id = ?`,
      [status, result.error || null, now, sendId]
    );
  }

  /**
   * Obter campanhas agendadas para executar agora
   */
  async getScheduledCampaignsToRun() {
    const now = new Date().toISOString();

    return this.db.all(
      `SELECT * FROM campaigns 
       WHERE status = 'draft' 
       AND scheduled_at IS NOT NULL 
       AND scheduled_at <= ?
       AND deleted_at IS NULL`,
      [now]
    );
  }
}

/**
 * Factory function
 */
export function createDisparoService(db) {
  return new DisparoService(db);
}
