(() => {
  const dataElement = document.getElementById('dashboard-data');
  if (!dataElement || !window.Chart) return;

  let payload;
  try {
    payload = JSON.parse(dataElement.textContent || '{}');
  } catch (error) {
    console.error('dashboard: failed to parse data payload', error);
    return;
  }

  const resumo = payload.resumo || {};
  const categorias = Array.isArray(payload.categorias) ? payload.categorias : [];

  renderCategorias(categorias);
  renderComparativo(resumo);
})();

function renderCategorias(categorias) {
  const canvas = document.getElementById('graficoCategorias');
  if (!canvas) return;

  const labels = categorias.map(item => `${item.categoria} (${item.secao})`);
  const valores = categorias.map(item => Number(item.totalAtual) || 0);
  const context = canvas.getContext('2d');
  if (!context) return;

  new Chart(context, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Realizado',
          data: valores,
          backgroundColor: '#3b82f6',
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'Top 10 Categorias' }
      },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function renderComparativo(resumo) {
  const canvas = document.getElementById('graficoComparativo');
  if (!canvas) return;

  const context = canvas.getContext('2d');
  if (!context) return;

  const renda = Number(resumo.rendaTotal) || 0;
  const despesas = Number(resumo.despesasTotal) || 0;
  const despesaColor = resumo.overspending ? '#ef4444' : '#3b82f6';

  new Chart(context, {
    type: 'bar',
    data: {
      labels: ['Renda', 'Despesas'],
      datasets: [
        {
          label: 'Total (R$)',
          data: [renda, despesas],
          backgroundColor: ['#22c55e', despesaColor],
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Visão Geral do Período' }
      },
      scales: { y: { beginAtZero: true } }
    }
  });
}
