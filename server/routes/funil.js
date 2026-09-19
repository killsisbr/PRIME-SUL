/**
 * PRIME SUL — Funil Routes
 * Ferramenta #2: HTTP endpoints para análise de funil
 * 
 * Endpoints:
 * - GET /api/funnel — Obter funil completo
 * - GET /api/funnel/stage/:status — Métricas de um estágio
 * - GET /api/funnel/suggestions — Sugestões de ações
 * - GET /api/funnel/compare — Comparar com período anterior
 * - POST /api/funnel/predict/:leadId — Prever próximo estágio
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createFunnelService } from '../services/funil-service.js';
import { createCarteiraService } from '../services/carteira-service.js';

export function setupFunnelRoutes(app, db) {
  const router = Router();
  const funnel = createFunnelService(db);
  const carteira = createCarteiraService(db);

  // ============================================
  // GET /api/funnel — Obter funil completo
  // ============================================
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const sellerId = req.user.seller_id;
      const data = await funnel.getFunnelBySeller(sellerId);

      res.json({
        success: true,
        data
      });

    } catch (error) {
      console.error('GET /api/funnel:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao obter funil'
      });
    }
  });

  // ============================================
  // GET /api/funnel/stage/:status — Métricas de estágio
  // ============================================
  router.get('/stage/:status', authMiddleware, async (req, res) => {
    try {
      const sellerId = req.user.seller_id;
      const { status } = req.params;

      // Validar status
      const validStatuses = ['novo', 'enviado', 'sim', 'nao', 'bloqueado'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Status inválido'
        });
      }

      const metrics = await funnel.getStageMetrics(sellerId, status);

      res.json({
        success: true,
        data: metrics
      });

    } catch (error) {
      console.error('GET /api/funnel/stage/:status:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao obter métricas do estágio'
      });
    }
  });

  // ============================================
  // GET /api/funnel/suggestions — Sugestões
  // ============================================
  router.get('/suggestions', authMiddleware, async (req, res) => {
    try {
      const sellerId = req.user.seller_id;
      const suggestions = await funnel.getSuggestions(sellerId);

      res.json({
        success: true,
        data: suggestions
      });

    } catch (error) {
      console.error('GET /api/funnel/suggestions:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao obter sugestões'
      });
    }
  });

  // ============================================
  // GET /api/funnel/compare — Comparar períodos
  // ============================================
  router.get('/compare', authMiddleware, async (req, res) => {
    try {
      const sellerId = req.user.seller_id;
      const { days = 7 } = req.query;
      const daysNum = Math.max(1, Math.min(90, parseInt(days) || 7));

      const comparison = await funnel.compareWithPeriod(sellerId, daysNum);

      res.json({
        success: true,
        data: comparison
      });

    } catch (error) {
      console.error('GET /api/funnel/compare:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao comparar períodos'
      });
    }
  });

  // ============================================
  // GET /api/funnel/history — Histórico de progressão
  // ============================================
  router.get('/history', authMiddleware, async (req, res) => {
    try {
      const sellerId = req.user.seller_id;
      const history = await funnel.getProgressionHistory(sellerId);

      res.json({
        success: true,
        data: history
      });

    } catch (error) {
      console.error('GET /api/funnel/history:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao obter histórico'
      });
    }
  });

  // ============================================
  // POST /api/funnel/predict/:leadId — Prever estágio
  // ============================================
  router.post('/predict/:leadId', authMiddleware, async (req, res) => {
    try {
      const sellerId = req.user.seller_id;
      const { leadId } = req.params;

      // Obter lead
      const lead = await carteira.getLead(sellerId, leadId);

      // Prever
      const prediction = await funnel.predictNextStage(sellerId, lead);

      res.json({
        success: true,
        data: {
          lead: {
            id: lead.id,
            name: lead.name,
            status: lead.status,
            score: lead.score
          },
          prediction
        }
      });

    } catch (error) {
      console.error('POST /api/funnel/predict/:leadId:', error);
      const status = error.message === 'Lead não encontrado' ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message || 'Erro ao fazer previsão'
      });
    }
  });

  // ============================================
  // Registrar rotas
  // ============================================
  app.use('/api/funnel', router);
}
