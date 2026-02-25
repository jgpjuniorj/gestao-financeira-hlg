import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_HOUSEHOLD_SLUG } from './config.js';
import { clampSlug, ensureRequired, sanitizeName, slugify } from './helpers.js';
import { ConflictError, NotFoundError, ValidationError } from './errors.js';
import { withConnection } from './pool.js';

async function ensureUniqueSlug(connection, base, excludeId = null) {
  const safeBase = clampSlug(base || 'tenant');
  let attempt = 0;

  while (attempt < 500) {
    const suffix = attempt === 0 ? '' : `-${attempt}`;
    const truncated = safeBase.slice(0, Math.max(1, 120 - suffix.length));
    const candidate = clampSlug(`${truncated}${suffix}`);

    const params = excludeId ? [candidate, excludeId] : [candidate];
    const query = excludeId
      ? 'SELECT id FROM households WHERE slug = ? AND id <> ?'
      : 'SELECT id FROM households WHERE slug = ?';

    const [rows] = await connection.execute(query, params);
    if (rows.length === 0) {
      return candidate;
    }

    attempt += 1;
  }

  throw new Error('HOUSEHOLD_SLUG_COLLISION');
}

export async function listHouseholds() {
  return withConnection(async connection => {
    const [rows] = await connection.query(
      `SELECT id,
              name,
              slug,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM households
       ORDER BY name COLLATE utf8mb4_unicode_ci`
    );
    return rows;
  });
}

export async function findHouseholdById(id) {
  return withConnection(async connection => {
    const [rows] = await connection.execute(
      `SELECT id,
              name,
              slug,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM households
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  });
}

export async function findHouseholdBySlug(slug) {
  return withConnection(async connection => {
    const [rows] = await connection.execute(
      `SELECT id,
              name,
              slug,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM households
       WHERE slug = ?
       LIMIT 1`,
      [slug]
    );
    return rows[0] || null;
  });
}

export async function createHousehold(nameInput, slugInput = '') {
  const name = ensureRequired(nameInput, () => new ValidationError('Nome do ambiente é obrigatório.', { code: 'HOUSEHOLD_NAME_REQUIRED' }));

  return withConnection(async connection => {
    const baseSlug = slugify(slugInput || name);
    const slug = await ensureUniqueSlug(connection, baseSlug);
    const id = uuidv4();

    await connection.execute(
      'INSERT INTO households (id, name, slug) VALUES (?, ?, ?)',
      [id, name, slug]
    );

    return { id, name, slug };
  });
}

export async function updateHousehold(id, { name: nameInput, slug: slugInput }) {
  return withConnection(async connection => {
    const [currentRows] = await connection.execute(
      'SELECT id, name, slug, created_at AS createdAt, updated_at AS updatedAt FROM households WHERE id = ? LIMIT 1',
      [id]
    );
    const existing = currentRows[0];
    if (!existing) {
      throw new NotFoundError('Ambiente não encontrado.', { code: 'HOUSEHOLD_NOT_FOUND' });
    }

    const updates = [];
    const params = [];

    if (typeof nameInput === 'string') {
      const name = sanitizeName(nameInput);
      if (name) {
        updates.push('name = ?');
        params.push(name);
      }
    }

    if (typeof slugInput === 'string' && slugInput.trim()) {
      const baseSlug = slugify(slugInput);
      const slug = await ensureUniqueSlug(connection, baseSlug, id);
      updates.push('slug = ?');
      params.push(slug);
    }

    if (!updates.length) {
      return existing;
    }

    params.push(id);
    await connection.execute(
      `UPDATE households SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    );

    const [rows] = await connection.execute(
      'SELECT id, name, slug, created_at AS createdAt, updated_at AS updatedAt FROM households WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || existing;
  });
}

async function getHouseholdUsageCounts(connection, householdId) {
  const queries = [
    ['users', 'SELECT COUNT(1) AS total FROM users WHERE household_id = ?'],
    ['sections', 'SELECT COUNT(1) AS total FROM sections WHERE household_id = ?'],
    ['categories', 'SELECT COUNT(1) AS total FROM categories WHERE household_id = ?'],
    ['entries', 'SELECT COUNT(1) AS total FROM entries WHERE household_id = ?']
  ];

  const usage = {
    users: 0,
    sections: 0,
    categories: 0,
    entries: 0
  };

  for (const [key, sql] of queries) {
    const [rows] = await connection.execute(sql, [householdId]);
    usage[key] = Number(rows[0]?.total || 0);
  }

  return usage;
}

export async function deleteHousehold(id) {
  return withConnection(async connection => {
    const [rows] = await connection.execute(
      'SELECT id, slug FROM households WHERE id = ? LIMIT 1',
      [id]
    );
    const household = rows[0];

    if (!household) {
      throw new Error('HOUSEHOLD_NOT_FOUND');
    }

    if (household.slug === DEFAULT_HOUSEHOLD_SLUG) {
      throw new ConflictError('Não é permitido excluir o ambiente padrão.', {
        code: 'HOUSEHOLD_DELETE_FORBIDDEN'
      });
    }

    const usage = await getHouseholdUsageCounts(connection, id);
    if (usage.users > 0 || usage.sections > 0 || usage.categories > 0 || usage.entries > 0) {
      throw new ConflictError('O ambiente possui dados associados.', {
        code: 'HOUSEHOLD_NOT_EMPTY',
        meta: usage
      });
    }

    await connection.execute('DELETE FROM households WHERE id = ?', [id]);
  });
}
