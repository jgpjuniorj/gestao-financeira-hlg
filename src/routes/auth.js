import { Router } from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { recordUserLogin } from '../services/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

function sanitizeNext(nextRaw) {
  if (typeof nextRaw !== 'string') return '';
  const trimmed = nextRaw.trim();
  if (!trimmed.startsWith('/')) return '';
  return trimmed;
}

router.get('/login', (req, res) => {
  if (req.session?.user?.authenticated) {
    return res.redirect('/dashboard');
  }

  const next = sanitizeNext(req.query.next);
  res.render('login', { error: null, next });
});

router.post('/login', asyncHandler(async (req, res) => {
  if (req.session?.user?.authenticated) {
    return res.redirect('/dashboard');
  }

  const { username, password, next: nextFromBody } = req.body || {};
  const next = sanitizeNext(nextFromBody || req.query.next);

  try {
    const user = await authenticateUser(username, password);
    if (!user) {
      return res.status(401).render('login', {
        error: 'Credenciais inválidas. Tente novamente.',
        next
      });
    }

    await recordUserLogin(user.id);

    req.session.user = {
      id: user.id,
      username: user.username,
      authenticated: true,
      loggedInAt: new Date().toISOString(),
      householdId: user.householdId,
      activeHouseholdId: user.householdId,
      isAdmin: Boolean(user.isAdmin)
    };

    return res.redirect(next || '/dashboard');
  } catch (err) {
    console.error('Erro ao autenticar usuário:', err);
    return res.status(500).render('login', {
      error: 'Login indisponível. Contate o administrador.',
      next
    });
  }
}));

router.post('/logout', (req, res) => {
  const redirectTarget = '/login';

  if (!req.session) {
    return res.redirect(redirectTarget);
  }

  req.session.user = null;
  req.session.destroy(err => {
    if (err) {
      return res.redirect('/dashboard');
    }
    return res.redirect(redirectTarget);
  });
});

export default router;
