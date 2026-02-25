
import { comparePeriodsDesc } from '../utils/period.js';
import { listSections, listCategories, listEntries } from './db.js';

const INCOME_KEYWORDS = ['resumo', 'renda', 'salário', 'salario', 'entrada', 'entradas', 'receita', 'receitas', 'ganho', 'bonus', 'bônus'];
const SAVINGS_KEYWORDS = ['poupança', 'poupanca', 'reserva', 'investimento', 'investimentos', 'fundo'];

export async function aggregate({ period = null, householdId }) {
  if (!householdId) {
    return {
      sections: [],
      categorias: [],
      resumo: {
        rendaTotal: 0,
        despesasTotal: 0,
        resultado: 0,
        economiaPercent: 0,
        percentSpent: 0,
        overspending: false,
        saldoPositivo: false,
        saldoNegativo: false,
        poupancaTotal: 0,
        hasSavings: false
      },
      meses: []
    };
  }

  const [sections, categories, entriesRaw] = await Promise.all([
    listSections(householdId),
    listCategories(householdId),
    listEntries(householdId)
  ]);

  const sectionMap = new Map(sections.map(section => [section.id, section]));
  const categoryMap = new Map(categories.map(category => [category.id, category]));

  const selectedPeriod = typeof period === 'string' ? period.trim() : '';
  const filteredEntries = entriesRaw.filter(entry => {
    if (!selectedPeriod) return true;
    if (typeof entry.period !== 'string') return false;
    return entry.period.trim() === selectedPeriod;
  });

  const sectionTotals = new Map();
  const categoryTotals = new Map();

  let rendaTotal = 0;
  let despesasTotal = 0;
  let poupancaTotal = 0;

  for (const entry of filteredEntries) {
    const valor = toAmount(entry.actual);
    if (!valor) continue;

    const category = categoryMap.get(entry.categoryId);
    if (!category) continue;

    const section = sectionMap.get(category.sectionId);
    const sectionId = section?.id ?? 'sem-secao';
    const sectionName = section?.name ?? 'Sem Seção';

    const income = isIncomeGroup(section, category);
    const savings = isSavingsGroup(section, category);

    accumulateSection(sectionTotals, sectionId, sectionName, valor, income);
    accumulateCategory(categoryTotals, category.id, category.name, sectionName, valor);

    if (income) {
      rendaTotal += valor;
    } else {
      despesasTotal += valor;
    }

    if (savings) {
      poupancaTotal += valor;
    }
  }

  const sectionsArray = buildSections(sectionTotals, rendaTotal, despesasTotal);
  const categoriasArray = buildCategories(categoryTotals);

  const resultado = round(rendaTotal - despesasTotal);
  const economiaPercent = rendaTotal ? round((resultado / rendaTotal) * 100) : 0;
  const percentSpent = rendaTotal ? round((despesasTotal / rendaTotal) * 100) : 0;
  const overspending = despesasTotal > rendaTotal;
  const saldoPositivo = resultado > 0;
  const saldoNegativo = resultado < 0;
  const hasSavings = poupancaTotal > 0;

  const meses = Array.from(
    new Set(
      entriesRaw
        .map(entry => entry?.period)
        .filter(Boolean)
        .map(periodValue => String(periodValue).trim())
    )
  ).sort(comparePeriodsDesc);

  return {
    sections: sectionsArray,
    categorias: categoriasArray,
    resumo: {
      rendaTotal: round(rendaTotal),
      despesasTotal: round(despesasTotal),
      resultado,
      economiaPercent,
      percentSpent,
      overspending,
      saldoPositivo,
      saldoNegativo,
      poupancaTotal: round(poupancaTotal),
      hasSavings
    },
    meses
  };
}

function accumulateSection(map, id, name, value, isIncome) {
  if (!map.has(id)) {
    map.set(id, { name, total: 0, income: Boolean(isIncome) });
  }

  const entry = map.get(id);
  entry.total += value;
  entry.income = entry.income || isIncome;
}

function accumulateCategory(map, id, name, sectionName, value) {
  if (!map.has(id)) {
    map.set(id, { name, sectionName, total: 0 });
  }

  const entry = map.get(id);
  entry.total += value;
}

function buildSections(sectionTotals, rendaTotal, despesasTotal) {
  return Array.from(sectionTotals.values())
    .map(section => {
      const base = section.income ? rendaTotal : despesasTotal;
      const participacao = base ? round((section.total / base) * 100) : 0;
      return {
        secao: section.name,
        totalAtual: round(section.total),
        participacao
      };
    })
    .sort((a, b) => b.totalAtual - a.totalAtual);
}

function buildCategories(categoryTotals) {
  return Array.from(categoryTotals.values())
    .map(category => ({
      categoria: category.name,
      secao: category.sectionName,
      totalAtual: round(category.total)
    }))
    .sort((a, b) => b.totalAtual - a.totalAtual);
}

function toAmount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isIncomeGroup(section, category) {
  if (!section && !category) return false;
  const sectionId = section?.id ?? '';
  if (sectionId === 'sec-resumo') return true;

  const haystack = `${section?.name ?? ''} ${category?.name ?? ''}`.toLowerCase();
  return INCOME_KEYWORDS.some(keyword => haystack.includes(keyword));
}

function isSavingsGroup(section, category) {
  if (!section && !category) return false;
  const haystack = `${section?.name ?? ''} ${category?.name ?? ''}`.toLowerCase();
  return SAVINGS_KEYWORDS.some(keyword => haystack.includes(keyword));
}
