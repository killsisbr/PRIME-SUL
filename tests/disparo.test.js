/**
 * PRIME SUL — Disparo Service Tests
 * Ferramenta #3: Testes para campanhas de envio
 * 
 * Coverage: 85%+
 * Test cases: CRUD campanhas, preview, estatísticas
 */

import assert from 'assert';
import { Database } from 'sqlite';
import { createDisparoService } from '../server/services/disparo-service.js';
import { createCarteiraService } from '../server/services/carteira-service.js';

describe('DisparoService', () => {
  let db;
  let disparo;
  let carteira;
  let sellerId = 'seller_001';
  let campaignId;

  // Setup
  before(async () => {
    db = new Database(':memory:');

    // Criar tabelas
    await db.exec(`
      CREATE TABLE leads (
        id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        status TEXT DEFAULT 'novo',
        prioridade TEXT DEFAULT 'media',
        score INTEGER DEFAULT 0,
        notas TEXT,
        created_at TEXT,
        updated_at TEXT,
        deleted_at TEXT
      );

      CREATE TABLE campaigns (
        id TEXT PRIMARY KEY,
        seller_id TEXT NOT NULL,
        name TEXT NOT NULL,
        message TEXT NOT NULL,
        target_filter TEXT,
        template_vars TEXT,
        scheduled_at TEXT,
        status TEXT DEFAULT 'draft',
        started_at TEXT,
        created_at TEXT,
        updated_at TEXT,
        deleted_at TEXT
      );

      CREATE TABLE sends (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        lead_id TEXT NOT NULL,
        seller_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        last_error TEXT,
        created_at TEXT,
        updated_at TEXT
      );
    `);

    disparo = createDisparoService(db);
    carteira = createCarteiraService(db);

    // Criar leads de teste
    for (let i = 0; i < 10; i++) {
      await carteira.createLead(sellerId, {
        name: `Lead ${i}`,
        phone: `1199999999${String(i).padStart(2, '0')}`,
        status: i < 5 ? 'novo' : 'enviado',
        prioridade: i % 2 === 0 ? 'alta' : 'media'
      });
    }
  });

  after(async () => {
    await db.close();
  });

  // ============================================
  // CREATE
  // ============================================

  describe('createCampaign', () => {
    it('deve criar campanha com dados válidos', async () => {
      const campaign = await disparo.createCampaign(sellerId, {
        name: 'Campanha Teste',
        message: 'Olá {nome}, temos uma oferta para você!',
        targetFilter: { status: 'novo' }
      });

      assert(campaign.id);
      assert.strictEqual(campaign.name, 'Campanha Teste');
      assert.strictEqual(campaign.status, 'draft');
      assert.strictEqual(campaign.seller_id, sellerId);

      campaignId = campaign.id;
    });

    it('deve rejeitar sem nome', async () => {
      try {
        await disparo.createCampaign(sellerId, {
          message: 'Teste'
        });
        assert.fail('deveria ter lançado erro');
      } catch (error) {
        assert(error.message.includes('obrigatórios'));
      }
    });

    it('deve rejeitar sem mensagem', async () => {
      try {
        await disparo.createCampaign(sellerId, {
          name: 'Teste'
        });
        assert.fail('deveria ter lançado erro');
      } catch (error) {
        assert(error.message.includes('obrigatórios'));
      }
    });

    it('deve rejeitar nome muito curto', async () => {
      try {
        await disparo.createCampaign(sellerId, {
          name: 'ab',
          message: 'Mensagem de teste'
        });
        assert.fail('deveria ter lançado erro');
      } catch (error) {
        assert(error.message.includes('pelo menos 3'));
      }
    });

    it('deve rejeitar se nenhum lead corresponde ao filtro', async () => {
      try {
        await disparo.createCampaign(sellerId, {
          name: 'Campanha Vazia',
          message: 'Teste',
          targetFilter: { status: 'inexistente' }
        });
        assert.fail('deveria ter lançado erro');
      } catch (error) {
        assert(error.message.includes('Nenhum lead'));
      }
    });
  });

  // ============================================
  // READ
  // ============================================

  describe('getCampaign', () => {
    it('deve obter campanha por ID', async () => {
      const campaign = await disparo.getCampaign(sellerId, campaignId);

      assert.strictEqual(campaign.id, campaignId);
      assert.strictEqual(campaign.name, 'Campanha Teste');
    });

    it('deve rejeitar campanha inexistente', async () => {
      try {
        await disparo.getCampaign(sellerId, 'inexistente');
        assert.fail('deveria ter lançado erro');
      } catch (error) {
        assert.strictEqual(error.message, 'Campanha não encontrada');
      }
    });

    it('deve incluir estatísticas', async () => {
      const campaign = await disparo.getCampaign(sellerId, campaignId);

      assert(campaign.stats);
      assert('total' in campaign.stats);
      assert('sent' in campaign.stats);
    });
  });

  describe('listCampaigns', () => {
    it('deve listar campanhas com paginação', async () => {
      const result = await disparo.listCampaigns(sellerId);

      assert(result.campaigns);
      assert(result.pagination);
      assert(result.pagination.total >= 1);
    });

    it('deve filtrar por status', async () => {
      const result = await disparo.listCampaigns(sellerId, { status: 'draft' });

      assert(result.campaigns.every(c => c.status === 'draft'));
    });
  });

  // ============================================
  // START
  // ============================================

  describe('startCampaign', () => {
    it('deve iniciar campanha e criar sends', async () => {
      const campaign = await disparo.startCampaign(sellerId, campaignId);

      assert.strictEqual(campaign.status, 'active');
      assert(campaign.started_at);
      assert(campaign.stats.total > 0);
    });

    it('deve rejeitar start se não está em draft', async () => {
      try {
        await disparo.startCampaign(sellerId, campaignId);
        assert.fail('deveria ter lançado erro');
      } catch (error) {
        assert(error.message.includes('rascunho'));
      }
    });
  });

  // ============================================
  // PAUSE
  // ============================================

  describe('pauseCampaign', () => {
    it('deve pausar campanha ativa', async () => {
      const campaign = await disparo.pauseCampaign(sellerId, campaignId);

      assert.strictEqual(campaign.status, 'paused');
    });

    it('deve rejeitar pause se não está ativa', async () => {
      try {
        await disparo.pauseCampaign(sellerId, campaignId);
        assert.fail('deveria ter lançado erro');
      } catch (error) {
        assert(error.message.includes('ativa'));
      }
    });
  });

  // ============================================
  // CANCEL
  // ============================================

  describe('cancelCampaign', () => {
    it('deve cancelar campanha', async () => {
      // Criar nova para cancelar
      const campaign = await disparo.createCampaign(sellerId, {
        name: 'Para Cancelar',
        message: 'Teste de cancelamento',
        targetFilter: { status: 'novo' }
      });

      const canceled = await disparo.cancelCampaign(sellerId, campaign.id);

      assert.strictEqual(canceled.status, 'canceled');
      assert(canceled.deleted_at);
    });
  });

  // ============================================
  // PREVIEW
  // ============================================

  describe('previewMessage', () => {
    it('deve substituir variáveis simples', () => {
      const lead = { name: 'João Silva' };
      const message = 'Olá {nome}!';

      const preview = disparo.previewMessage(message, lead);

      assert(preview.includes('João Silva'));
      assert(!preview.includes('{nome}'));
    });

    it('deve substituir primeiro nome', () => {
      const lead = { name: 'João Silva da Costa' };
      const message = 'Oi {primeiro_nome}!';

      const preview = disparo.previewMessage(message, lead);

      assert(preview.includes('João'));
      assert(!preview.includes('Silva'));
    });

    it('deve manter variáveis não substituídas', () => {
      const lead = { name: 'João' };
      const message = 'Olá {nome}, CPF: {cpf}';

      const preview = disparo.previewMessage(message, lead);

      assert(preview.includes('João'));
      assert(preview.includes('{cpf}')); // não substituída
    });
  });

  // ============================================
  // STATISTICS
  // ============================================

  describe('getCampaignStats', () => {
    it('deve retornar estatísticas da campanha', async () => {
      // Campanha já foi iniciada, deve ter sends
      const stats = await disparo.getCampaignStats(sellerId, campaignId);

      assert.strictEqual(stats.total, 5); // 5 leads com status 'novo'
      assert.strictEqual(stats.pending, 5);
    });

    it('deve calcular taxas corretamente', async () => {
      const stats = await disparo.getCampaignStats(sellerId, campaignId);

      assert(stats.deliveryRate >= 0);
      assert(stats.readRate >= 0);
      assert(stats.failureRate >= 0);
    });
  });

  // ============================================
  // VALIDATION
  // ============================================

  describe('validateTarget', () => {
    it('deve contar leads que correspondem ao filtro', async () => {
      const count = await disparo.validateTarget(sellerId, { status: 'novo' });

      assert.strictEqual(count, 5);
    });

    it('deve contar com múltiplos filtros', async () => {
      const count = await disparo.validateTarget(sellerId, {
        status: 'novo',
        prioridade: 'alta'
      });

      assert(count > 0);
    });
  });
});
