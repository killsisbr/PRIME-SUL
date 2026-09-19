/**
 * PRIME SUL — Disparo Routes
 * Ferramenta #3: HTTP endpoints para campanhas de envio
 * 
 * Endpoints:
 * - GET /api/disparo — Listar campanhas
 * - POST /api/disparo — Criar campanha
 * - GET /api/disparo/:id — Obter campanha
 * - PATCH /api/disparo/:id — Atualizar campanha (pausar, cancelar)
 * - POST /api/disparo/:id/start — Iniciar campanha
 * - POST /api/disparo/:id/preview — Preview de mensagem
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createDisparoService } from '../services/disparo-service.js';
import { createCarteiraService } from '../services/carteira-service.js';

export function setupDisparoRoutes(app, db) {
  const router = Router();
  const disparo = createDisparoService(db);
  const carteira = createCarteiraService(db);

  // ============================================
  // GET /api/disparo — Listar campanhas
  // ============================================
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const sellerId = req.user.seller_id;
      const { status, page = 1, sort } = req.query;

      const data = await disparo.listCampaigns(sellerId, {
        status,
        page: parseInt(page),
        sort
      });

      res.json({
        success: true,
        data
      });

    } catch (error) {
      console.error('GET /api/disparo:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao listar campanhas'
      });
    }
  });

  // ============================================
  // POST /api/disparo — Criar campanha
  // ============================================
  router.post('/', authMiddleware, async (req, res) => {
    try {
      const sellerId = req.user.seller_id;
      const { name, message, targetFilter, templateVars, scheduledAt } = req.body;

      const campaign = await disparo.createCampaign(sellerId, {
        name,
        message,
        targetFilter,
        templateVars,
        scheduledAt
      });

      res.status(201).json({
        success: true,
        data: campaign,
        message: 'Campanha criada com sucesso'
      });

    } catch (error) {
      console.error('POST /api/disparo:', error);
      const status = error.message.includes('Nenhum lead') ? 400 : 400;
      res.status(status).json({
        success: false,
        error: error.message || 'Erro ao criar campanha'
      });
    }
  });

  // ============================================
  // GET /api/disparo/:id — Obter campanha
  // ============================================
  router.get('/:id', authMiddleware, async (req, res) => {
    try {
      const sellerId = req.user.seller_id;
      const { id } = req.params;

      const campaign = await disparo.getCampaign(sellerId, id);

      res.json({
        success: true,
        data: campaign
      });

    } catch (error) {
      console.error('GET /api/disparo/:id:', error);
      const status = error.message === 'Campanha não encontrada' ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message || 'Erro ao obter campanha'
      });
    }
  });

  // ============================================
  // PATCH /api/disparo/:id — Atualizar status
  // ============================================
  router.patch('/:id', authMiddleware, async (req, res) => {
    try {
      const sellerId = req.user.seller_id;
      const { id } = req.params;
      const { action } = req.body; // 'pause' ou 'cancel'

      if (!['pause', 'cancel'].includes(action)) {
        return res.status(400).json({
          success: false,
          error: 'Action deve ser "pause" ou "cancel"'
        });
      }

      let campaign;

      if (action === 'pause') {
        campaign = await disparo.pauseCampaign(sellerId, id);
      } else if (action === 'cancel') {
        campaign = await disparo.cancelCampaign(sellerId, id);
      }

      res.json({
        success: true,
        data: campaign,
        message: `Campanha ${action}d com sucesso`
      });

    } catch (error) {
      console.error('PATCH /api/disparo/:id:', error);
      const status = error.message.includes('não encontrada') ? 404 : 400;
      res.status(status).json({
        success: false,
        error: error.message || 'Erro ao atualizar campanha'
      });
    }
  });

  // ============================================
  // POST /api/disparo/:id/start — Iniciar campanha
  // ============================================
  router.post('/:id/start', authMiddleware, async (req, res) => {
    try {
      const sellerId = req.user.seller_id;
      const { id } = req.params;

      const campaign = await disparo.startCampaign(sellerId, id);

      res.json({
        success: true,
        data: campaign,
        message: 'Campanha iniciada com sucesso'
      });

    } catch (error) {
      console.error('POST /api/disparo/:id/start:', error);
      const status = error.message.includes('não encontrada') ? 404 : 400;
      res.status(status).json({
        success: false,
        error: error.message || 'Erro ao iniciar campanha'
      });
    }
  });

  // ============================================
  // POST /api/disparo/:id/preview — Preview de mensagem
  // ============================================
  router.post('/:id/preview', authMiddleware, async (req, res) => {
    try {
      const sellerId = req.user.seller_id;
      const { id } = req.params;
      const { leadId } = req.body;

      if (!leadId) {
        return res.status(400).json({
          success: false,
          error: 'leadId é obrigatório'
        });
      }

      // Obter campanha
      const campaign = await disparo.getCampaign(sellerId, id);

      // Obter lead
      const lead = await carteira.getLead(sellerId, leadId);

      // Preview
      const preview = disparo.previewMessage(campaign.message, lead, campaign.templateVars);

      res.json({
        success: true,
        data: {
          message: campaign.message,
          preview,
          lead: {
            id: lead.id,
            name: lead.name,
            phone: lead.phone
          }
        }
      });

    } catch (error) {
      console.error('POST /api/disparo/:id/preview:', error);
      const status = error.message.includes('não encontrado') ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message || 'Erro ao gerar preview'
      });
    }
  });

  // ============================================
  // Registrar rotas
  // ============================================
  app.use('/api/disparo', router);
}
