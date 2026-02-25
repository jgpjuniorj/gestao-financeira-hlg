import { Router } from 'express';
import bcrypt from 'bcryptjs';
import {
  listUsersSummary,
  createUserAccount,
  updateUserPassword,
  deleteUserAccount,
  countUsers,
  listHouseholds,
  reassignUserHousehold,
  setUserAdminFlag
} from '../services/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

function feedbackFromQuery(query) {
  const map = {
    created: { type: 'success', text: 'Usuário criado com sucesso.' },
    updated: { type: 'success', text: 'Senha atualizada com sucesso.' },
    deleted: { type: 'success', text: 'Usuário removido.' },
    duplicate: { type: 'error', text: 'Nome de usuário já está em uso.' },
    invalid: { type: 'error', text: 'Preencha os dados obrigatórios.' },
    self: { type: 'error', text: 'Não é possível remover o próprio usuário.' },
    last: { type: 'error', text: 'Ao menos um usuário deve permanecer ativo.' },
    moved: { type: 'success', text: 'Usuário movido para outro ambiente.' },
    move_error: { type: 'error', text: 'Não foi possível mover o usuário.' },
    missing_household: { type: 'error', text: 'Selecione um ambiente válido.' },
    admin_on: { type: 'success', text: 'Usuário promovido a administrador.' },
    admin_off: { type: 'success', text: 'Permissões de administrador removidas.' },
    admin_error: { type: 'error', text: 'Não foi possível atualizar as permissões.' }
  };
  return map[query] || null;
}

function parseAdminFlag(value) {
  const normalized = String(value ?? '').toLowerCase();
  return ['1', 'true', 'on', 'yes'].includes(normalized);
}

router.get('/', asyncHandler(async (req, res) => {
  const feedback = feedbackFromQuery(req.query.status);
  const [users, households] = await Promise.all([
    listUsersSummary(),
    listHouseholds()
  ]);

  res.render('users', {
    users,
    households,
    feedback
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';
  const householdId = req.body.householdId || '';
  const isAdmin = parseAdminFlag(req.body.isAdmin);

  if (!username || !password || !householdId) {
    return res.redirect('/users?status=invalid');
  }

  try {
    const passwordHash = bcrypt.hashSync(password, 10);
    await createUserAccount(username, passwordHash, householdId, isAdmin);
    return res.redirect('/users?status=created');
  } catch (error) {
    if (error?.errno === 1452 || error?.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.redirect('/users?status=missing_household');
    }
    if (error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062) {
      return res.redirect('/users?status=duplicate');
    }
    console.error('Erro ao criar usuário:', error);
    return res.redirect('/users?status=invalid');
  }
}));

router.post('/:id/password', asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const password = req.body.password || '';

  if (!password) {
    return res.redirect('/users?status=invalid');
  }

  try {
    const passwordHash = bcrypt.hashSync(password, 10);
    await updateUserPassword(userId, passwordHash);
    return res.redirect('/users?status=updated');
  } catch (error) {
    console.error('Erro ao atualizar senha:', error);
    return res.redirect('/users?status=invalid');
  }
}));

router.post('/:id/household', asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const householdId = req.body.householdId || '';

  if (!householdId) {
    return res.redirect('/users?status=missing_household');
  }

  try {
    await reassignUserHousehold(userId, householdId);

    if (req.session?.user?.id === userId) {
      req.session.user.householdId = householdId;
      req.session.user.activeHouseholdId = householdId;
    }

    return res.redirect('/users?status=moved');
  } catch (error) {
    if (error?.errno === 1452 || error?.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.redirect('/users?status=missing_household');
    }
    console.error('Erro ao mover usuário:', error);
    return res.redirect('/users?status=move_error');
  }
}));

router.post('/:id/admin', asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const isAdmin = parseAdminFlag(req.body.isAdmin);

  try {
    await setUserAdminFlag(userId, isAdmin);

    if (req.session?.user?.id === userId) {
      req.session.user.isAdmin = isAdmin;
    }

    return res.redirect(`/users?status=${isAdmin ? 'admin_on' : 'admin_off'}`);
  } catch (error) {
    console.error('Erro ao atualizar permissões:', error);
    return res.redirect('/users?status=admin_error');
  }
}));

router.post('/:id/delete', asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const sessionUserId = req.session?.user?.id;

  if (userId === sessionUserId) {
    return res.redirect('/users?status=self');
  }

  const totalUsers = await countUsers();
  if (totalUsers <= 1) {
    return res.redirect('/users?status=last');
  }

  try {
    await deleteUserAccount(userId);
    return res.redirect('/users?status=deleted');
  } catch (error) {
    console.error('Erro ao remover usuário:', error);
    return res.redirect('/users?status=invalid');
  }
}));

export default router;
