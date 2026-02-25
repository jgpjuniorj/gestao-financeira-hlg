import { Router } from 'express';
import {
  listHouseholds,
  createHousehold,
  updateHousehold,
  deleteHousehold,
  findHouseholdById
} from '../services/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

function feedbackFromQuery(query) {
  const map = {
    created: { type: 'success', text: 'Ambiente criado com sucesso.' },
    updated: { type: 'success', text: 'Ambiente atualizado.' },
    deleted: { type: 'success', text: 'Ambiente removido.' },
    activated: { type: 'success', text: 'Contexto alterado para o ambiente selecionado.' },
    invalid: { type: 'error', text: 'Preencha os campos obrigatórios.' },
    not_found: { type: 'error', text: 'Ambiente não localizado.' },
    not_empty: { type: 'error', text: 'Ambiente possui dados e não pode ser removido.' },
    delete_forbidden: { type: 'error', text: 'Ambiente padrão não pode ser removido.' },
    operation_failed: { type: 'error', text: 'Não foi possível concluir a operação.' }
  };
  return map[query] || null;
}

router.get('/', asyncHandler(async (req, res) => {
  const feedback = feedbackFromQuery(req.query.status);
  const households = await listHouseholds();

  res.render('households', {
    households,
    feedback,
    activeHouseholdId: req.session?.user?.activeHouseholdId || req.session?.user?.householdId || null
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  const name = (req.body.name || '').trim();
  const slugInput = (req.body.slug || '').trim();

  if (!name) {
    return res.redirect('/admin/households?status=invalid');
  }

  try {
    await createHousehold(name, slugInput);
    return res.redirect('/admin/households?status=created');
  } catch (error) {
    console.error('Erro ao criar ambiente:', error);
    return res.redirect('/admin/households?status=operation_failed');
  }
}));

router.post('/:id/update', asyncHandler(async (req, res) => {
  const id = req.params.id;
  const name = req.body.name;
  const slugInput = req.body.slug;

  try {
    await updateHousehold(id, { name, slug: slugInput });
    return res.redirect('/admin/households?status=updated');
  } catch (error) {
    console.error('Erro ao atualizar ambiente:', error);
    return res.redirect('/admin/households?status=operation_failed');
  }
}));

router.post('/:id/delete', asyncHandler(async (req, res) => {
  const id = req.params.id;

  try {
    await deleteHousehold(id);

    if (req.session?.user && req.session.user.activeHouseholdId === id) {
      req.session.user.activeHouseholdId = req.session.user.householdId;
    }

    return res.redirect('/admin/households?status=deleted');
  } catch (error) {
    if (error?.code === 'HOUSEHOLD_NOT_EMPTY') {
      return res.redirect('/admin/households?status=not_empty');
    }
    if (error?.code === 'HOUSEHOLD_DELETE_FORBIDDEN') {
      return res.redirect('/admin/households?status=delete_forbidden');
    }
    if (error?.message === 'HOUSEHOLD_NOT_FOUND') {
      return res.redirect('/admin/households?status=not_found');
    }
    console.error('Erro ao remover ambiente:', error);
    return res.redirect('/admin/households?status=operation_failed');
  }
}));

router.post('/:id/activate', asyncHandler(async (req, res) => {
  const id = req.params.id;
  const household = await findHouseholdById(id);
  if (!household) {
    return res.redirect('/admin/households?status=not_found');
  }

  if (req.session?.user) {
    req.session.user.activeHouseholdId = household.id;
  }

  return res.redirect('/admin/households?status=activated');
}));

export default router;