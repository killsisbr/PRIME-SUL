/**
 * PRIME SUL — Funil Card (Frontend)
 * Ferramenta #2: Visualização de funil de vendas
 * 
 * Exibe:
 * - Gráfico de funil (piramidal)
 * - Taxa de conversão por estágio
 * - Gargalos detectados
 * - Sugestões de ação
 * - Comparação de períodos
 */

class FunnelCard {
  constructor() {
    this.apiBase = '/api/funnel';
    this.chart = null;
    this.init();
  }

  init() {
    this.createHTML();
    this.attachEvents();
    this.loadFunnelData();
    this.loadSuggestions();
  }

  /**
   * Criar estrutura HTML
   */
  createHTML() {
    const html = `
      <div class="funil-container">
        <!-- Header -->
        <div class="funil-header">
          <h2>📊 Funil de Vendas</h2>
          <div class="header-actions">
            <select id="period-filter" class="filter-select">
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="60">Últimos 60 dias</option>
            </select>
          </div>
        </div>

        <!-- Main Grid -->
        <div class="funil-grid">
          <!-- Gráfico Funil -->
          <div class="funil-chart-wrapper">
            <canvas id="funnel-chart"></canvas>
          </div>

          <!-- Estágios e Conversões -->
          <div class="funil-stages">
            <div id="stages-list"></div>
          </div>
        </div>

        <!-- Gargalos -->
        <div id="bottleneck-section" style="display: none;">
          <div class="bottleneck-alert">
            <h3>⚠️ Gargalo Detectado</h3>
            <div id="bottleneck-details"></div>
          </div>
        </div>

        <!-- Sugestões -->
        <div class="funil-suggestions">
          <h3>💡 Sugestões de Ação</h3>
          <div id="suggestions-list"></div>
        </div>

        <!-- Comparação de Períodos -->
        <div class="funil-comparison">
          <h3>📈 Comparação de Períodos</h3>
          <div id="comparison-table"></div>
        </div>

        <!-- Histórico -->
        <div class="funil-history">
          <h3>⏱️ Histórico de Progressão</h3>
          <div id="history-list"></div>
        </div>
      </div>
    `;

    const container = document.querySelector('#assistant-popup') || document.body;
    container.innerHTML = html;

    // Carregar Chart.js se não estiver carregado
    if (!window.Chart) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      script.onload = () => this.initChart();
      document.head.appendChild(script);
    }
  }

  /**
   * Attach event listeners
   */
  attachEvents() {
    document.getElementById('period-filter').addEventListener('change', (e) => {
      this.loadComparison(parseInt(e.target.value));
    });
  }

  /**
   * Carregar dados do funil
   */
  async loadFunnelData() {
    try {
      const response = await fetch(this.apiBase);
      const json = await response.json();

      if (json.success) {
        this.renderFunnel(json.data);
        this.renderStages(json.data.funnel);
        
        if (json.data.bottleneck) {
          this.renderBottleneck(json.data.bottleneck);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar funil:', error);
      this.showError('Erro ao carregar funil');
    }
  }

  /**
   * Renderizar gráfico de funil
   */
  renderFunnel(data) {
    const stages = data.funnel.map(f => f.displayName);
    const counts = data.funnel.map(f => f.count);
    const percentages = data.funnel.map(f => f.percentage);

    // Criar dados para gráfico
    const chartData = {
      labels: stages.map((s, i) => `${s}\n${counts[i]} (${percentages[i]}%)`),
      datasets: [{
        label: 'Leads',
        data: counts,
        backgroundColor: data.funnel.map(f => f.color),
        borderColor: '#000',
        borderWidth: 2,
        borderRadius: 0
      }]
    };

    // Destruir gráfico anterior
    if (this.chart) {
      this.chart.destroy();
    }

    // Criar novo gráfico
    const ctx = document.getElementById('funnel-chart');
    this.chart = new Chart(ctx, {
      type: 'bar',
      data: chartData,
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: `Taxa de Conversão: ${data.conversionRate}%`
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            border: {
              display: true,
              width: 2,
              color: '#000'
            }
          },
          y: {
            border: {
              display: true,
              width: 2,
              color: '#000'
            }
          }
        }
      }
    });
  }

  /**
   * Renderizar detalhes de estágios
   */
  renderStages(stages) {
    const html = stages.map((stage, index) => `
      <div class="stage-card">
        <div class="stage-header">
          <h4>${stage.displayName}</h4>
          <span class="stage-count">${stage.count}</span>
        </div>
        
        <div class="stage-metrics">
          <div class="metric">
            <span class="metric-label">% do Total</span>
            <span class="metric-value">${stage.percentage}%</span>
          </div>
          
          ${index > 0 ? `
            <div class="metric">
              <span class="metric-label">Taxa Conversão</span>
              <span class="metric-value ${stage.conversionRate < 30 ? 'low' : ''}">${stage.conversionRate}%</span>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');

    document.getElementById('stages-list').innerHTML = html;
  }

  /**
   * Renderizar gargalo
   */
  renderBottleneck(bottleneck) {
    const severityColors = {
      'critica': '#d32f2f',
      'alta': '#f57c00',
      'media': '#fbc02d',
      'baixa': '#2e7d32'
    };

    const html = `
      <div style="border-left: 4px solid ${severityColors[bottleneck.severity]}; padding: 16px;">
        <p><strong>${bottleneck.displayName}:</strong> ${bottleneck.dropPercentage}% queda</p>
        <p>De <em>${bottleneck.fromStage}</em> para <em>${bottleneck.stage}</em></p>
        <p><em>Taxa conversão: ${bottleneck.conversionRate}%</em></p>
      </div>
    `;

    document.getElementById('bottleneck-section').style.display = 'block';
    document.getElementById('bottleneck-details').innerHTML = html;
  }

  /**
   * Carregar sugestões
   */
  async loadSuggestions() {
    try {
      const response = await fetch(`${this.apiBase}/suggestions`);
      const json = await response.json();

      if (json.success) {
        this.renderSuggestions(json.data);
      }
    } catch (error) {
      console.error('Erro ao carregar sugestões:', error);
    }
  }

  /**
   * Renderizar sugestões
   */
  renderSuggestions(suggestions) {
    if (suggestions.length === 0) {
      document.getElementById('suggestions-list').innerHTML = 
        '<p style="color: #666; font-style: italic;">Nenhuma sugestão no momento</p>';
      return;
    }

    const html = suggestions.map(s => `
      <div class="suggestion-card ${s.severity}">
        <div class="suggestion-header">
          <h4>${s.title}</h4>
          <span class="severity-badge severity-${s.severity}">${s.severity}</span>
        </div>
        <p>${s.description}</p>
        <button class="btn-action" onclick="funnelCard.handleSuggestion('${s.type}')">
          ${s.action}
        </button>
      </div>
    `).join('');

    document.getElementById('suggestions-list').innerHTML = html;
  }

  /**
   * Carregar comparação de períodos
   */
  async loadComparison(days = 7) {
    try {
      const response = await fetch(`${this.apiBase}/compare?days=${days}`);
      const json = await response.json();

      if (json.success) {
        this.renderComparison(json.data);
      }
    } catch (error) {
      console.error('Erro ao carregar comparação:', error);
    }
  }

  /**
   * Renderizar tabela de comparação
   */
  renderComparison(data) {
    const html = `
      <table class="comparison-table">
        <thead>
          <tr>
            <th>Estágio</th>
            <th>Agora</th>
            <th>Período Anterior</th>
            <th>Mudança</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(data.comparison).map(([stage, stats]) => `
            <tr>
              <td>${stage}</td>
              <td>${stats.current}</td>
              <td>${stats.past}</td>
              <td class="${stats.delta >= 0 ? 'positive' : 'negative'}">
                ${stats.delta >= 0 ? '+' : ''}${stats.delta} (${stats.deltaPercent}%)
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    document.getElementById('comparison-table').innerHTML = html;
  }

  /**
   * Inicializar gráfico
   */
  initChart() {
    this.loadFunnelData();
  }

  /**
   * Handlersde sugestões
   */
  handleSuggestion(type) {
    switch (type) {
      case 'bottleneck':
        alert('Revise seu processo de conversão para o estágio com gargalo');
        break;
      case 'low_conversion':
        alert('Considere ajustar sua estratégia de vendas');
        break;
      case 'high_new':
        alert('Crie uma campanha de disparo para leads novos');
        break;
    }
  }

  /**
   * Mostrar erro
   */
  showError(message) {
    alert(`❌ ${message}`);
  }
}

// Inicializar quando DOM carregar
document.addEventListener('DOMContentLoaded', () => {
  window.funnelCard = new FunnelCard();
});
