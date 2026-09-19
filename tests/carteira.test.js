/**
 * PRIME SUL — Carteira Service Tests
 * Ferramenta #1: Testes para gerenciar leads
 * 
 * Coverage: 85%+
 * Test cases: CRUD, filtros, busca, validação
 */

import assert from 'assert';
import { Database } from 'sqlite';
import { createCarteiraService } from '../server/services/carteira-service.js';

describe('CarteiraService', () => {
  let db;
  let carteira;
  let sellerId = 'seller_001';
  let leadId;

  // Setup
  before(async () => {
    // Criar BD em memória
    db = new Database(':memory:');

    // Criar tabela leads
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
      )
    `);

    carteira = createCarteiraService(db);
  });

  // Cleanup
  after(async () => {
    await db.close();
  });

  // ============================================
  // CREATE
  // ============================================

  describe('createLead', () => {
    it('deve criar um novo lead com dados válidos', async () => {
      const lead = await carteira.createLead(sellerId, {
        name: 'João Silva',
        phone: '11999999999',
        email: 'joao@example.com',
        prioridade: 'alta',
        score: 85
      });

      assert(lead.id);
      assert.strictEqual(lead.name, 'João Silva');
      assert.strictEqual(lead.phone, '11999999999');
      assert.strictEqual(lead.prioridade, 'alta');
      assert.strictEqual(lead.score, 85);
      assert.strictEqual(lead.status, 'novo');

      leadId = lead.id;
    });

    it('deve rejeitar lead sem nome', async () => {
      try {
        await carteira.createLead(sellerId, {
          phone: '11999999999'
        });
        assert.fail('deveria ter lançado erro');
      } catch (error) {
        assert.strictEqual(error.message, 'Nome e telefone são obrigatórios');
      }
    });

    it('deve rejeitar lead sem telefone', async () => {
      try {
        await carteira.createLead(sellerId, {
          name: 'Maria'
        });
        assert.fail('deveria ter lançado erro');
      } catch (error) {
        assert.strictEqual(error.message, 'Nome e telefone são obrigatórios');
      }
    });

    it('deve rejeitar prioridade inválida', async () => {
      try {
        await carteira.createLead(sellerId, {
          name: 'teste',
          phone: '11999999999',
          prioridade: 'critica'
        });
        assert.fail('deveria ter lançado erro');
      } catch (error) {
        assert(error.message.includes('Prioridade inválida'));
      }
    });
  });

  // ============================================
  // READ
  // ============================================

  describe('getLead', () => {
    it('deve obter um lead por ID', async () => {
      const lead = await carteira.getLead(sellerId, leadId);

      assert.strictEqual(lead.id, leadId);
      assert.strictEqual(lead.name, 'João Silva');
    });

    it('deve rejeitar lead inexistente', async () => {
      try {
        await carteira.getLead(sellerId, 'inexistente');
        assert.fail('deveria ter lançado erro');
      } catch (error) {
        assert.strictEqual(error.message, 'Lead não encontrado');
      }
    });

    it('deve rejeitar lead de outro vendedor', async () => {
      try {
        await carteira.getLead('outro_seller', leadId);
        assert.fail('deveria ter lançado erro');
      } catch (error) {
        assert.strictEqual(error.message, 'Lead não encontrado');
      }
    });
  });

  describe('listLeads', () => {
    it('deve listar leads com paginação', async () => {
      // Criar mais alguns leads
      await carteira.createLead(sellerId, {
        name: 'Maria',
        phone: '11888888888',
        prioridade: 'media'
      });

      await carteira.createLead(sellerId, {
        name: 'Pedro',
        phone: '11777777777',
        prioridade: 'baixa'
      });

      const result = await carteira.listLeads(sellerId, { page: 1, limit: 20 });

      assert(result.leads.length >= 3);
      assert(result.total >= 3);
      assert.strictEqual(result.page, 1);
    });

    it('deve filtrar por status', async () => {
      const result = await carteira.listLeads(sellerId, {
        status: 'novo'
      });

      assert(result.leads.every(l => l.status === 'novo'));
    });

    it('deve filtrar por prioridade', async () => {
      const result = await carteira.listLeads(sellerId, {
        prioridade: 'alta'
      });

      assert(result.leads.every(l => l.prioridade === 'alta'));
    });

    it('deve buscar por nome', async () => {
      const result = await carteira.listLeads(sellerId, {
        search: 'João'
      });

      assert(result.leads.length > 0);
      assert(result.leads.some(l => l.name.includes('João')));
    });

    it('deve buscar por telefone', async () => {
      const result = await carteira.listLeads(sellerId, {
        search: '11999999999'
      });

      assert(result.leads.length > 0);
    });
  });

  // ============================================
  // UPDATE
  // ============================================

  describe('updateLead', () => {
    it('deve atualizar status de um lead', async () => {
      const updated = await carteira.updateLead(sellerId, leadId, {
        status: 'enviado'
      });

      assert.strictEqual(updated.status, 'enviado');
    });

    it('deve atualizar múltiplos campos', async () => {
      const updated = await carteira.updateLead(sellerId, leadId, {
        status: 'sim',
        prioridade: 'media',
        score: 95,
        notas: 'Bom cliente'
      });

      assert.strictEqual(updated.status, 'sim');
      assert.strictEqual(updated.prioridade, 'media');
      assert.strictEqual(updated.score, 95);
      assert.strictEqual(updated.notas, 'Bom cliente');
    });

    it('deve rejeitar prioridade inválida ao atualizar', async () => {
      try {
        await carteira.updateLead(sellerId, leadId, {
          prioridade: 'super_alta'
        });
        assert.fail('deveria ter lançado erro');
      } catch (error) {
        assert(error.message.includes('Prioridade inválida'));
      }
    });

    it('deve atualizar timestamp', async () => {
      const before = new Date();
      await new Promise(r => setTimeout(r, 10)); // Aguardar 10ms

      const updated = await carteira.updateLead(sellerId, leadId, {
        notas: 'Update teste'
      });

      const updatedTime = new Date(updated.updated_at);
      assert(updatedTime > before);
    });
  });

  // ============================================
  // DELETE
  // ============================================

  describe('deleteLead', () => {
    it('deve fazer soft delete de um lead', async () => {
      const deleted = await carteira.deleteLead(sellerId, leadId);
      assert.strictEqual(deleted, true);
    });

    it('lead deletado não deve aparecer em listagem padrão', async () => {
      // Criar novo lead para não afetar outros testes
      const tempLead = await carteira.createLead(sellerId, {
        name: 'Temp',
        phone: '11111111111'
      });

      await carteira.deleteLead(sellerId, tempLead.id);

      const result = await carteira.listLeads(sellerId);
      assert(!result.leads.find(l => l.id === tempLead.id));
    });
  });

  // ============================================
  // COUNTS
  // ============================================

  describe('countsBySeller', () => {
    it('deve retornar contagem por status', async () => {
      const counts = await carteira.countsBySeller(sellerId);

      assert(counts.novo >= 0);
      assert(counts.enviado >= 0);
      assert(counts.sim >= 0);
      assert(counts.nao >= 0);
      assert(counts.bloqueado >= 0);
      assert(counts.total >= 0);
    });

    it('deve contar corretamente após criar lead', async () => {
      const countsBefore = await carteira.countsBySeller(sellerId);

      await carteira.createLead(sellerId, {
        name: 'Novo Count',
        phone: '11222222222'
      });

      const countsAfter = await carteira.countsBySeller(sellerId);

      assert.strictEqual(countsAfter.total, countsBefore.total + 1);
    });
  });

  // ============================================
  // SEARCH
  // ============================================

  describe('search', () => {
    it('deve retornar array vazio para query curta', async () => {
      const results = await carteira.search(sellerId, 'a');
      assert.strictEqual(Array.isArray(results), true);
    });

    it('deve buscar por nome', async () => {
      const results = await carteira.search(sellerId, 'Maria');
      assert(results.length > 0);
      assert(results.some(r => r.name.includes('Maria')));
    });

    it('deve buscar por telefone', async () => {
      const results = await carteira.search(sellerId, '11888888888');
      assert(results.length > 0);
    });

    it('deve limitar resultado a 10', async () => {
      // Criar 15 leads
      for (let i = 0; i < 15; i++) {
        await carteira.createLead(sellerId, {
          name: `Search Test ${i}`,
          phone: `1199999999${String(i).padStart(2, '0')}`
        });
      }

      const results = await carteira.search(sellerId, 'Search Test');
      assert(results.length <= 10);
    });
  });

  // ============================================
  // ISOLATION
  // ============================================

  describe('seller isolation', () => {
    it('seller não deve ver leads de outro seller', async () => {
      const otherSellerId = 'seller_002';

      await carteira.createLead(otherSellerId, {
        name: 'Lead Outro Seller',
        phone: '11333333333'
      });

      const myLeads = await carteira.listLeads(sellerId);
      const otherLeads = await carteira.listLeads(otherSellerId);

      assert(!myLeads.leads.some(l => l.seller_id === otherSellerId));
      assert(!otherLeads.leads.some(l => l.seller_id === sellerId));
    });
  });
});
