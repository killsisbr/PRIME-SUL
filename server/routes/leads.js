/**
 * PRIME SUL — Leads Routes
 * Ferramenta #1: HTTP endpoints para gerenciar leads
 * 
 * Endpoints:
 * - GET /api/leads — Listar leads com filtros
 * - GET /api/leads/counts — Contar leads por status
 * - GET /api/leads/:id — Obter lead específico
 * - POST /api/leads — Criar novo lead
 * - PATCH /api/leads/:id — Atualizar lead
 * - DELETE /api/leads/:id — Deletar lead
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createCarteiraService } from '../services/carteira-service.js';

export function setupLeadsRoutes(app, db) {
  const router = Router();
  const carteira = createCarteiraService(db);

  // ============================================
  // GET /api/leads — Listar leads com filtros
  // ============================================
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const sellerId = req.user.seller_id;

      // Query parameters
      const {
        status = 'todos',
        prioridade = 'todos',
        page = '1',
        sort = 'created_at',
        search = ''
      } = req.query;

      // Validar página
      const pageNum = Math.max(1, parseInt(page) || 1);

      const result = await carteira.listLeads(sellerId, {
        status: status === 'todos' ? undefined : status,
        prioridade: prioridade === 'todos' ? undefined : prioridade,
        page: pageNum,
        sort,
        search,
        limit: 20
      });

      res.json({
        success: true,
        data: result.leads,
        pagination: {
          total: result.total,
          page: result.page,
          pages: result.pages,
          limit: result.limit
        }
      });

    } catch (error) {
      console.error('GET /api/leads:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao listar leads'
      });
    }
  });

  // ============================================
  // GET /api/leads/counts — Contar por status
  // ============================================
  router.get('/counts', authMiddleware, async (req, res) => {
    try {
      const sellerId = req.user.seller_id;
      const counts = await carteira.countsBySeller(sellerId);

      res.json({
        success: true,
        data: counts
      });

    } catch (error) {
      console.error('GET /api/leads/counts:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao contar leads'
      });
    }
  });

  // ============================================
  // GET /api/leads/:id — Obter lead específico
  // ============================================
  router.get('/:id', authMiddleware, async (req, res) => {
    try {
      const sellerId = req.user.seller_id;
      const { id } = req.params;

      const lead = await carteira.getLead(sellerId, id);

      res.json({
        success: true,
        data: lead
      });

    } catch (error) {
      console.error('GET /api/leads/:id:', error);
      const status = error.message === 'Lead não encontrado' ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message || 'Erro ao obter lead'
      });
    }
  });

  // ============================================
  // POST /api/leads — Criar novo lead
  // ============================================
  router.post('/', authMiddleware, async (req, res) => {
    try {
      const sellerId = req.user.seller_id;
      const { name, phone, email, prioridade, score, status, notas } = req.body;

      // Validação básica
      if (!name || !phone) {
        return res.status(400).json({
          success: false,
          error: 'Nome e telefone são obrigatórios'
        });
      }

      const newLead = await carteira.createLead(sellerId, {
        name,
        phone,
        email: email || '',
        prioridade: prioridade || 'media',
        score: parseInt(score) || 0,
        status: status || 'novo',
        notas: notas || ''
      });

      res.status(201).json({
        success: true,
        data: newLead,
        message: 'Lead criado com sucesso'
      });

    } catch (error) {
      console.error('POST /api/leads:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Erro ao criar lead'
      });
    }
  });

  // ============================================
  // PATCH /api/leads/:id — Atualizar lead
  // ============================================
  router.patch('/:id', authMiddleware, async (req, res) => {
    try {
      const sellerId = req.user.seller_id;
      const { id } = req.params;
      const updates = req.body;

      // Não permitir atualizar seller_id
      delete updates.seller_id;
      delete updates.id;
      delete updates.created_at;

      const updatedLead = await carteira.updateLead(sellerId, id, updates);

      res.json({
        success: true,
        data: updatedLead,
        message: 'Lead atualizado com sucesso'
      });

    } catch (error) {
      console.error('PATCH /api/leads/:id:', error);
      const status = error.message === 'Lead não encontrado' ? 404 : 400;
      res.status(status).json({
        success: false,
        error: error.message || 'Erro ao atualizar lead'
      });
    }
  });

  // ============================================
  // DELETE /api/leads/:id — Deletar lead
  // ============================================
  router.delete('/:id', authMiddleware, async (req, res) => {
    try {
      const sellerId = req.user.seller_id;
      const { id } = req.params;

      await carteira.deleteLead(sellerId, id);

      res.json({
        success: true,
        message: 'Lead deletado com sucesso'
      });

    } catch (error) {
      console.error('DELETE /api/leads/:id:', error);
      const status = error.message === 'Lead não encontrado' ? 404 : 500;
      res.status(status).json({
        success: false,
        error: error.message || 'Erro ao deletar lead'
      });
    }
  });

  // ============================================
  // Registrar rotas
  // ============================================
  app.use('/api/leads', router);
}
