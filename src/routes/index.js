
import { Router } from 'express';
import {
  listSections,
  listCategories,
  listEntries,
  createSection,
  updateSection,
  deleteSection,
  createCategory,
  updateCategory,
  deleteCategory,
  createEntry,
  updateEntry,
  deleteEntry
} from '../services/db.js';
import { aggregate } from '../services/aggregator.js';
import { currentPeriod, comparePeriodsDesc, formatPeriodLabel } from '../utils/period.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', (req, res) => res.redirect('/dashboard'));

router.get('/dashboard', asyncHandler(async (req, res) => {
  const rawPeriod = typeof req.query.period === 'string' ? req.query.period : '';
  const period = rawPeriod.trim() || null;
  const data = await aggregate({
    period,
    householdId: req.currentHousehold?.id
  });
  res.render('dashboard', {
    data,
    period
  });
}));

function roundCurrency(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

router.get('/manage', asyncHandler(async (req, res) => {
  const householdId = req.currentHousehold?.id;
  const [sections, categories, entries] = await Promise.all([
    listSections(householdId),
    listCategories(householdId),
    listEntries(householdId)
  ]);

  res.render('manage', {
    sections,
    categories,
    entries,
    defaultPeriod: currentPeriod()
  });
}));

router.get('/entries', asyncHandler(async (req, res) => {
  const householdId = req.currentHousehold?.id;
  const [sections, categories, allEntries] = await Promise.all([
    listSections(householdId),
    listCategories(householdId),
    listEntries(householdId)
  ]);

  const periodsRaw = Array.from(new Set(allEntries.map(e => e.period).filter(Boolean)))
    .sort(comparePeriodsDesc);
  const selectedPeriod = (req.query.period || '').trim();
  const entriesFiltered = selectedPeriod ? allEntries.filter(e => e.period === selectedPeriod) : allEntries;
  const entries = entriesFiltered
    .slice()
    .sort((a, b) => {
      const cmp = comparePeriodsDesc(a.period || '', b.period || '');
      if (cmp !== 0) return cmp;
      return (Number(b.actual) || 0) - (Number(a.actual) || 0);
    });
  const totalValue = entries.reduce((acc, e) => acc + (Number(e.actual) || 0), 0);

  const groupedMap = new Map();
  for (const entry of entries) {
    const key = entry.period || 'Sem período';
    if (!groupedMap.has(key)) groupedMap.set(key, { period: key, entries: [], total: 0 });
    const group = groupedMap.get(key);
    group.entries.push(entry);
    group.total += Number(entry.actual) || 0;
  }

  const groupedEntries = Array.from(groupedMap.values())
    .sort((a, b) => comparePeriodsDesc(a.period, b.period))
    .map(group => ({
      ...group,
      total: roundCurrency(group.total),
      label: formatPeriodLabel(group.period)
    }));

  const periodOptions = periodsRaw.map(period => ({ value: period, label: formatPeriodLabel(period) }));

  res.render('entries', {
    sections,
    categories,
    entries,
    groupedEntries,
    periodOptions,
    selectedPeriod,
    defaultPeriod: currentPeriod(),
    totalValue: roundCurrency(totalValue)
  });
}));

router.post('/section', asyncHandler(async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.redirect('/manage');
  await createSection(name, req.currentHousehold?.id);
  res.redirect('/manage');
}));

router.post('/category', asyncHandler(async (req, res) => {
  const name = (req.body.name || '').trim();
  const sectionId = req.body.sectionId;
  if (!name || !sectionId) return res.redirect('/manage');
  await createCategory(name, sectionId, req.currentHousehold?.id);
  res.redirect('/manage');
}));

router.post('/entry', asyncHandler(async (req, res) => {
  const { categoryId } = req.body;
  if (!categoryId) return res.redirect('/entries');

  const period = (req.body.period || '').trim() || currentPeriod();
  const actual = Number(req.body.actual) || 0;
  if (!period) return res.redirect('/entries');

  await createEntry(categoryId, period, actual, req.currentHousehold?.id);
  res.redirect('/entries');
}));

router.post('/section/:id/update', asyncHandler(async (req, res) => {
  const sectionId = req.params.id;
  const name = (req.body.name || '').trim();
  if (name) await updateSection(sectionId, name, req.currentHousehold?.id);
  res.redirect('/manage');
}));

router.post('/section/:id/delete', asyncHandler(async (req, res) => {
  await deleteSection(req.params.id, req.currentHousehold?.id);
  res.redirect('/manage');
}));

router.post('/category/:id/update', asyncHandler(async (req, res) => {
  const name = (req.body.name || '').trim();
  const sectionId = req.body.sectionId;
  if (name && sectionId) {
    await updateCategory(req.params.id, name, sectionId, req.currentHousehold?.id);
  }
  res.redirect('/manage');
}));

router.post('/category/:id/delete', asyncHandler(async (req, res) => {
  await deleteCategory(req.params.id, req.currentHousehold?.id);
  res.redirect('/manage');
}));

router.post('/entry/:id/update', asyncHandler(async (req, res) => {
  const categoryId = req.body.categoryId;
  const period = (req.body.period || '').trim() || currentPeriod();
  const actual = Number(req.body.actual) || 0;

  if (!categoryId || !period) return res.redirect('/entries');

  await updateEntry(req.params.id, categoryId, period, actual, req.currentHousehold?.id);
  res.redirect('/entries');
}));

router.post('/entry/:id/delete', asyncHandler(async (req, res) => {
  await deleteEntry(req.params.id, req.currentHousehold?.id);
  res.redirect('/entries');
}));

export default router;
