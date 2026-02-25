import { v4 as uuidv4 } from 'uuid';
import { pool } from './pool.js';
import { ValidationError } from './errors.js';

export async function findUserByUsername(username) {
  const safeUsername = (username || '').trim();
  if (!safeUsername) return null;

  const [rows] = await pool.execute(
    `SELECT id,
            username,
            password_hash AS passwordHash,
            created_at AS createdAt,
            updated_at AS updatedAt,
            last_login_at AS lastLoginAt,
            household_id AS householdId,
            is_admin AS isAdmin
     FROM users
     WHERE LOWER(username) = LOWER(?)
     LIMIT 1`,
    [safeUsername]
  );

  const user = rows[0] || null;
  if (!user) return null;
  return { ...user, isAdmin: Boolean(user.isAdmin) };
}

export async function findUserById(userId) {
  const [rows] = await pool.execute(
    `SELECT id,
            username,
            household_id AS householdId,
            is_admin AS isAdmin,
            created_at AS createdAt,
            last_login_at AS lastLoginAt
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );

  const user = rows[0] || null;
  if (!user) return null;
  return { ...user, isAdmin: Boolean(user.isAdmin) };
}

export async function recordUserLogin(userId) {
  await pool.execute(
    'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?',
    [userId]
  );
}

export async function listUsersSummary() {
  const [rows] = await pool.query(
    `SELECT u.id,
            u.username,
            u.created_at AS createdAt,
            u.last_login_at AS lastLoginAt,
            u.household_id AS householdId,
            u.is_admin AS isAdmin,
            h.name AS householdName,
            h.slug AS householdSlug
     FROM users u
     LEFT JOIN households h ON h.id = u.household_id
     ORDER BY u.username COLLATE utf8mb4_unicode_ci`
  );
  return rows.map(row => ({ ...row, isAdmin: Boolean(row.isAdmin) }));
}

export async function createUserAccount(usernameInput, passwordHash, householdId, isAdmin = false) {
  const username = (usernameInput || '').trim();
  if (!username) {
    throw new ValidationError('Nome de usuário é obrigatório.', { code: 'USER_USERNAME_REQUIRED' });
  }
  if (!passwordHash) {
    throw new ValidationError('Senha inválida.', { code: 'USER_PASSWORD_REQUIRED' });
  }
  if (!householdId) {
    throw new ValidationError('Household é obrigatório.', { code: 'USER_HOUSEHOLD_REQUIRED' });
  }

  const id = uuidv4();
  await pool.execute(
    'INSERT INTO users (id, username, password_hash, household_id, is_admin) VALUES (?, ?, ?, ?, ?)',
    [id, username, passwordHash, householdId, isAdmin ? 1 : 0]
  );
  return id;
}

export async function updateUserPassword(userId, passwordHash) {
  await pool.execute(
    'UPDATE users SET password_hash = ? WHERE id = ?',
    [passwordHash, userId]
  );
}

export async function reassignUserHousehold(userId, householdId) {
  await pool.execute(
    'UPDATE users SET household_id = ? WHERE id = ?',
    [householdId, userId]
  );
}

export async function setUserAdminFlag(userId, isAdmin) {
  await pool.execute(
    'UPDATE users SET is_admin = ? WHERE id = ?',
    [isAdmin ? 1 : 0, userId]
  );
}

export async function deleteUserAccount(userId) {
  await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
}

export async function countUsers() {
  const [rows] = await pool.query('SELECT COUNT(1) AS count FROM users');
  return Number(rows[0]?.count || 0);
}
