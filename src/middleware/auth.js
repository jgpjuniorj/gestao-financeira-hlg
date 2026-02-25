import bcrypt from 'bcryptjs';
import { findUserByUsername, findHouseholdById } from '../services/db.js';

export function ensureAuth(req, res, next) {
  if (req.session?.user?.authenticated) {
    return next();
  }

  const redirectTo = req.originalUrl && req.originalUrl !== '/' ? req.originalUrl : '/dashboard';
  const search = redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : '';
  return res.redirect(`/login${search}`);
}

export function requireAdmin(req, res, next) {
  if (req.session?.user?.isAdmin) {
    return next();
  }

  if (req.accepts('json') && !req.accepts('html')) {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }

  return res.status(403).render('error', {
    message: 'Acesso restrito ao administrador.'
  });
}

export async function authenticateUser(usernameInput, passwordInput) {
  const normalizedUser = (usernameInput || '').trim();
  const normalizedPass = passwordInput || '';

  if (!normalizedUser || !normalizedPass) {
    return null;
  }

  const user = await findUserByUsername(normalizedUser);
  if (!user?.passwordHash) {
    return null;
  }

  const isValid = bcrypt.compareSync(normalizedPass, user.passwordHash);
  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    householdId: user.householdId,
    isAdmin: Boolean(user.isAdmin)
  };
}

export async function attachLocals(req, res, next) {
  try {
    const sessionUser = req.session?.user ?? null;
    let household = null;

    const activeHouseholdId = sessionUser?.activeHouseholdId || sessionUser?.householdId || null;
    if (activeHouseholdId) {
      household = await findHouseholdById(activeHouseholdId);
      if (!household && sessionUser?.householdId && sessionUser.householdId !== activeHouseholdId) {
        household = await findHouseholdById(sessionUser.householdId);
        if (req.session?.user) {
          req.session.user.activeHouseholdId = sessionUser.householdId;
        }
      }
    }

    req.currentHousehold = household ?? null;
    res.locals.isAuthenticated = Boolean(sessionUser?.authenticated);
    res.locals.currentUser = sessionUser;
    res.locals.isAdmin = Boolean(sessionUser?.isAdmin);
    res.locals.currentHousehold = household;
    next();
  } catch (error) {
    next(error);
  }
}

