import { v4 as uuidv4 } from 'uuid';
import { normalizePeriod, sanitizeName, toAmount } from './helpers.js';
import { ValidationError } from './errors.js';
import { pool, withConnection } from './pool.js';

export async function listSections(householdId) {
  const target = householdId || null;
  const [rows] = await pool.query(
    'SELECT id, name FROM sections WHERE household_id = ? ORDER BY name COLLATE utf8mb4_unicode_ci',
    [target]
  );
  return rows;
}

export async function listCategories(householdId) {
  const target = householdId || null;
  const [rows] = await pool.query(
    'SELECT id, section_id AS sectionId, name FROM categories WHERE household_id = ? ORDER BY name COLLATE utf8mb4_unicode_ci',
    [target]
  );
  return rows;
}

export async function listEntries(householdId) {
  const target = householdId || null;
  const [rows] = await pool.query(
    'SELECT id, category_id AS categoryId, period, actual FROM entries WHERE household_id = ?',
    [target]
  );
  return rows.map(row => ({
    ...row,
    actual: Number(row.actual)
  }));
}

export async function createSection(nameInput, householdId) {
  const name = sanitizeName(nameInput);
  if (!name) {
    throw new ValidationError('Nome da seção é obrigatório.', { code: 'SECTION_NAME_REQUIRED' });
  }

  const id = uuidv4();
  await pool.execute(
    'INSERT INTO sections (id, name, household_id) VALUES (?, ?, ?)',
    [id, name, householdId]
  );
  return id;
}

export async function updateSection(sectionId, nameInput, householdId) {
  const name = sanitizeName(nameInput);
  if (!name) {
    throw new ValidationError('Nome da seção é obrigatório.', { code: 'SECTION_NAME_REQUIRED' });
  }

  await pool.execute(
    'UPDATE sections SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?',
    [name, sectionId, householdId]
  );
  return sectionId;
}

export async function deleteSection(sectionId, householdId) {
  await pool.execute(
    'DELETE FROM sections WHERE id = ? AND household_id = ? LIMIT 1',
    [sectionId, householdId]
  );
}

export async function createCategory(nameInput, sectionId, householdId) {
  const name = sanitizeName(nameInput);
  if (!name) {
    throw new ValidationError('Nome da categoria é obrigatório.', { code: 'CATEGORY_NAME_REQUIRED' });
  }
  if (!sectionId) {
    throw new ValidationError('Seção da categoria é obrigatória.', { code: 'CATEGORY_SECTION_REQUIRED' });
  }

  const id = uuidv4();
  await pool.execute(
    'INSERT INTO categories (id, name, section_id, household_id) VALUES (?, ?, ?, ?)',
    [id, name, sectionId, householdId]
  );
  return id;
}

export async function updateCategory(categoryId, nameInput, sectionId, householdId) {
  const name = sanitizeName(nameInput);
  if (!name) {
    throw new ValidationError('Nome da categoria é obrigatório.', { code: 'CATEGORY_NAME_REQUIRED' });
  }
  if (!sectionId) {
    throw new ValidationError('Seção da categoria é obrigatória.', { code: 'CATEGORY_SECTION_REQUIRED' });
  }

  await pool.execute(
    'UPDATE categories SET name = ?, section_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?',
    [name, sectionId, categoryId, householdId]
  );
  return categoryId;
}

export async function deleteCategory(categoryId, householdId) {
  await pool.execute(
    'DELETE FROM categories WHERE id = ? AND household_id = ? LIMIT 1',
    [categoryId, householdId]
  );
}

export async function createEntry(categoryId, periodInput, actualInput, householdId) {
  if (!categoryId) {
    throw new ValidationError('Categoria é obrigatória para o lançamento.', { code: 'ENTRY_CATEGORY_REQUIRED' });
  }

  const period = normalizePeriod(periodInput) || null;
  const actual = toAmount(actualInput);
  const id = uuidv4();

  await pool.execute(
    'INSERT INTO entries (id, category_id, period, actual, household_id) VALUES (?, ?, ?, ?, ?)',
    [id, categoryId, period, actual, householdId]
  );
  return id;
}

export async function updateEntry(entryId, categoryId, periodInput, actualInput, householdId) {
  if (!entryId) {
    throw new ValidationError('Lançamento não identificado.', { code: 'ENTRY_ID_REQUIRED' });
  }
  if (!categoryId) {
    throw new ValidationError('Categoria é obrigatória para o lançamento.', { code: 'ENTRY_CATEGORY_REQUIRED' });
  }

  const period = normalizePeriod(periodInput) || null;
  const actual = toAmount(actualInput);

  await pool.execute(
    'UPDATE entries SET category_id = ?, period = ?, actual = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?',
    [categoryId, period, actual, entryId, householdId]
  );
  return entryId;
}

export async function deleteEntry(entryId, householdId) {
  await pool.execute(
    'DELETE FROM entries WHERE id = ? AND household_id = ? LIMIT 1',
    [entryId, householdId]
  );
}
