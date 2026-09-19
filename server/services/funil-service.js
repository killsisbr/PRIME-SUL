/**
 * PRIME SUL — Funil Service (Sales Pipeline)
 * Ferramenta #2: Análise e gestão de funil de vendas
 * 
 * Métodos:
 * - getFunnelBySeller(sellerId) — Obter funil completo com conversões
 * - calculateConversion(fromStatus, toStatus, leads) — Calcular taxa de conversão
 * - detectBottleneck(funnel) — Detectar gargalo no funil
 * - predictNextStage(lead) — Prever próximo estágio
 * - getStageMetrics(sellerId, status) — Métricas de um estágio
 * - getProgressionHistory(sellerId) — Histórico de progressão
 */

export class FunnelService {
  constructor(db) {
    this.db = db;
    
    // Estágios do funil (ordem importa!)
    this.stages = [
      { name: 'novo', displayName: 'Novo', order: 1, color: '#e3f2fd' },
      { name: 'enviado', displayName: 'Enviado', order: 2, color: '#fff3e0' },
      { name: 'sim', displayName: 'Sim', order: 3, color: '#e8f5e9' },
      { name: 'nao', displayName: 'Não', order: 4, color: '#ffebee' },
      { name: 'bloqueado', displayName: 'Bloqueado', order: 5, color: '#f3e5f5' }
    ];
  }

  /**
   * Obter funil completo com conversões
   * 
   * @param {string} sellerId - ID do vendedor
   * @returns {Promise<Object>} Funil com dados de cada estágio
   */
  async getFunnelBySeller(sellerId) {
    // Contar leads em cada estágio
    const stageCounts = await this.db.all(
      `SELECT status, COUNT(*) as count 
       FROM leads 
       WHERE seller_id = ? AND deleted_at IS NULL
       GROUP BY status`,
      [sellerId]
    );

    // Criar mapa de contagens
    const counts = {};
    this.stages.forEach(stage => {
      counts[stage.name] = 0;
    });

    for (const row of stageCounts || []) {
      if (counts.hasOwnProperty(row.status)) {
        counts[row.status] = row.count;
      }
    }

    // Calcular conversões entre estágios
    const funnel = [];
    let total = Object.values(counts).reduce((a, b) => a + b, 0);

    this.stages.forEach((stage, index) => {
      const count = counts[stage.name];
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      
      let conversionRate = 0;
      let conversionFrom = null;

      // Calcular taxa de conversão DO estágio anterior
      if (index > 0) {
        const prevStage = this.stages[index - 1];
        const prevCount = counts[prevStage.name];
        conversionRate = prevCount > 0 ? Math.round((count / prevCount) * 100) : 0;
        conversionFrom = prevStage.name;
      }

      funnel.push({
        status: stage.name,
        displayName: stage.displayName,
        order: stage.order,
        color: stage.color,
        count,
        percentage,
        conversionRate,
        conversionFrom
      });
    });

    // Calcular métricas gerais
    const conversion = counts.sim + counts.nao;
    const conversionRate = total > 0 ? Math.round((conversion / total) * 100) : 0;

    return {
      funnel,
      totals: counts,
      totalLeads: total,
      conversions: conversion,
      conversionRate,
      bottleneck: this.detectBottleneck(funnel)
    };
  }

  /**
   * Detectar gargalo no funil
   * Identifica o estágio com maior queda de conversão
   * 
   * @param {Array} funnel - Dados do funil
   * @returns {Object|null} Gargalo encontrado ou null
   */
  detectBottleneck(funnel) {
    if (!funnel || funnel.length < 2) return null;

    let maxDrop = 0;
    let bottleneckStage = null;

    // Encontrar estágio com maior queda
    for (let i = 1; i < funnel.length; i++) {
      const currentStage = funnel[i];
      const prevStage = funnel[i - 1];

      if (currentStage.conversionRate < 30 && prevStage.count > 0) {
        const drop = 100 - currentStage.conversionRate;
        
        if (drop > maxDrop) {
          maxDrop = drop;
          bottleneckStage = {
            stage: currentStage.status,
            displayName: currentStage.displayName,
            fromStage: prevStage.status,
            dropPercentage: drop,
            conversionRate: currentStage.conversionRate,
            severity: this.calculateSeverity(drop)
          };
        }
      }
    }

    return bottleneckStage;
  }

  /**
   * Calcular severidade do gargalo
   * @private
   */
  calculateSeverity(dropPercentage) {
    if (dropPercentage >= 60) return 'critica';
    if (dropPercentage >= 40) return 'alta';
    if (dropPercentage >= 20) return 'media';
    return 'baixa';
  }

  /**
   * Prever próximo estágio de um lead
   * Baseado em histórico e pontuação
   * 
   * @param {string} sellerId - ID do vendedor
   * @param {Object} lead - Dados do lead
   * @returns {Promise<Object>} Previsão com confiança
   */
  async predictNextStage(sellerId, lead) {
    if (!lead.status || lead.status === 'bloqueado') {
      return {
        predictedStage: null,
        confidence: 0,
        reason: 'Lead bloqueado ou status inválido'
      };
    }

    // Regras simples de previsão
    const rules = {
      'novo': {
        next: 'enviado',
        conditions: (lead) => lead.score >= 50,
        confidence: 70
      },
      'enviado': {
        next: 'sim',
        conditions: (lead) => lead.score >= 70,
        confidence: 60
      },
      'sim': {
        next: null,
        conditions: () => true,
        confidence: 100,
        reason: 'Lead já convertido'
      },
      'nao': {
        next: null,
        conditions: () => true,
        confidence: 100,
        reason: 'Lead rejeitado'
      }
    };

    const rule = rules[lead.status];
    if (!rule) {
      return {
        predictedStage: null,
        confidence: 0,
        reason: 'Status desconhecido'
      };
    }

    // Aplicar condições
    let confidence = rule.confidence;
    
    if (!rule.conditions(lead)) {
      confidence = Math.max(10, confidence - 30);
    }

    return {
      predictedStage: rule.next,
      currentStage: lead.status,
      confidence,
      reason: rule.reason || `Próximo estágio esperado baseado em score`,
      recommendation: this.getRecommendation(lead, rule.next)
    };
  }

  /**
   * Obter recomendação de ação
   * @private
   */
  getRecommendation(lead, nextStage) {
    const recommendations = {
      'enviado': 'Dispare uma mensagem de acompanhamento',
      'sim': 'Passar para o time de vendas',
      'nao': 'Arquive ou remova da lista',
      null: 'Lead pode ser convertido'
    };

    return recommendations[nextStage] || 'Revisar manualmente';
  }

  /**
   * Obter métricas de um estágio específico
   * 
   * @param {string} sellerId - ID do vendedor
   * @param {string} status - Status/estágio
   * @returns {Promise<Object>} Métricas do estágio
   */
  async getStageMetrics(sellerId, status) {
    // Contar leads no estágio
    const count = await this.db.get(
      `SELECT COUNT(*) as total FROM leads 
       WHERE seller_id = ? AND status = ? AND deleted_at IS NULL`,
      [sellerId, status]
    );

    // Score médio
    const scoreAvg = await this.db.get(
      `SELECT AVG(score) as avg FROM leads 
       WHERE seller_id = ? AND status = ? AND deleted_at IS NULL`,
      [sellerId, status]
    );

    // Prioridade distribuição
    const priorities = await this.db.all(
      `SELECT prioridade, COUNT(*) as count FROM leads 
       WHERE seller_id = ? AND status = ? AND deleted_at IS NULL
       GROUP BY prioridade`,
      [sellerId, status]
    );

    // Tempo médio no estágio (dias)
    const avgTime = await this.db.get(
      `SELECT AVG((julianday('now') - julianday(created_at))) as days 
       FROM leads 
       WHERE seller_id = ? AND status = ? AND deleted_at IS NULL`,
      [sellerId, status]
    );

    return {
      status,
      total: count?.total || 0,
      avgScore: Math.round(scoreAvg?.avg || 0),
      avgDaysInStage: Math.round(avgTime?.days || 0),
      priorities: Object.fromEntries(
        (priorities || []).map(p => [p.prioridade, p.count])
      )
    };
  }

  /**
   * Obter histórico de progressão
   * Quando leads mudaram de estágio
   * 
   * @param {string} sellerId - ID do vendedor
   * @returns {Promise<Array>} Histórico de progressão
   */
  async getProgressionHistory(sellerId) {
    // Nota: Requer tabela de auditoria
    // Por enquanto, retorna leads ordenados por atualização
    
    const progressions = await this.db.all(
      `SELECT 
        id, name, status, score, 
        created_at as started_at, 
        updated_at as last_update,
        (julianday(updated_at) - julianday(created_at)) as days_in_funnel
       FROM leads
       WHERE seller_id = ? AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 50`,
      [sellerId]
    );

    return (progressions || []).map(p => ({
      ...p,
      daysInFunnel: Math.round(p.days_in_funnel)
    }));
  }

  /**
   * Obter sugestões de ações
   * 
   * @param {string} sellerId - ID do vendedor
   * @returns {Promise<Array>} Sugestões prioritárias
   */
  async getSuggestions(sellerId) {
    const funnel = await this.getFunnelBySeller(sellerId);
    const suggestions = [];

    // Sugestão 1: Gargalo
    if (funnel.bottleneck) {
      suggestions.push({
        type: 'bottleneck',
        severity: funnel.bottleneck.severity,
        title: `Gargalo detectado em ${funnel.bottleneck.displayName}`,
        description: `${funnel.bottleneck.conversionRate}% dos leads em ${funnel.bottleneck.fromStage} progridem para ${funnel.bottleneck.stage}`,
        action: 'Revisar processo de conversão',
        priority: 1
      });
    }

    // Sugestão 2: Taxa de conversão baixa
    if (funnel.conversionRate < 20) {
      suggestions.push({
        type: 'low_conversion',
        severity: 'alta',
        title: 'Taxa de conversão baixa',
        description: `Apenas ${funnel.conversionRate}% dos leads estão sendo convertidos`,
        action: 'Revisar estratégia de vendas',
        priority: 2
      });
    }

    // Sugestão 3: Leads em estágio "novo"
    if (funnel.funnel[0].count > 20) {
      suggestions.push({
        type: 'high_new',
        severity: 'media',
        title: `${funnel.funnel[0].count} leads novos aguardando ação`,
        description: 'Muitos leads no início do funil',
        action: 'Dispare campanhas para leads novos',
        priority: 3
      });
    }

    return suggestions.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Comparar desempenho com período anterior
   * 
   * @param {string} sellerId - ID do vendedor
   * @param {number} daysAgo - Comparar com X dias atrás
   * @returns {Promise<Object>} Comparação de métricas
   */
  async compareWithPeriod(sellerId, daysAgo = 7) {
    const now = new Date();
    const pastDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    // Leads atuais
    const current = await this.db.all(
      `SELECT status, COUNT(*) as count FROM leads 
       WHERE seller_id = ? AND deleted_at IS NULL
       GROUP BY status`,
      [sellerId]
    );

    // Leads do período anterior
    const past = await this.db.all(
      `SELECT status, COUNT(*) as count FROM leads 
       WHERE seller_id = ? 
       AND created_at < datetime(?)
       AND deleted_at IS NULL
       GROUP BY status`,
      [sellerId, pastDate.toISOString()]
    );

    // Calcular deltas
    const compareData = {};
    const stages = new Set(['novo', 'enviado', 'sim', 'nao', 'bloqueado']);

    for (const stage of stages) {
      const currentCount = (current || []).find(c => c.status === stage)?.count || 0;
      const pastCount = (past || []).find(p => p.status === stage)?.count || 0;
      const delta = currentCount - pastCount;
      const deltaPercent = pastCount > 0 ? Math.round((delta / pastCount) * 100) : 0;

      compareData[stage] = {
        current: currentCount,
        past: pastCount,
        delta,
        deltaPercent
      };
    }

    return {
      period: `Últimos ${daysAgo} dias`,
      comparison: compareData
    };
  }
}

/**
 * Factory function
 */
export function createFunnelService(db) {
  return new FunnelService(db);
}
