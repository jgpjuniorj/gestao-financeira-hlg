const DUPLICATE_ERROR_CODES = new Set(['ER_DUP_KEYNAME', 'ER_DUP_ENTRY', 'ER_DUP_FIELDNAME']);
const DUPLICATE_ERRNOS = new Set([1060, 1061, 1062]);
const MISSING_COLUMN_ERRNOS = new Set([1054]);
const MISSING_TABLE_ERRNOS = new Set([1146]);

export function isDuplicateError(error) {
  if (!error) return false;
  if (DUPLICATE_ERROR_CODES.has(error.code)) return true;
  if (DUPLICATE_ERRNOS.has(error.errno)) return true;
  const message = String(error.message || '').toLowerCase();
  return message.includes('duplicate') || message.includes('already exists');
}

export function isMissingColumnError(error) {
  if (!error) return false;
  if (MISSING_COLUMN_ERRNOS.has(error.errno)) return true;
  const message = String(error.message || '').toLowerCase();
  return message.includes('unknown column') || message.includes("doesn't exist");
}

export function isMissingTableError(error) {
  if (!error) return false;
  if (MISSING_TABLE_ERRNOS.has(error.errno)) return true;
  const message = String(error.message || '').toLowerCase();
  return message.includes("doesn't exist");
}

export function sanitizeName(value) {
  return (value || '').trim();
}

export function ensureRequired(value, errorFactory) {
  const sanitized = sanitizeName(value);
  if (!sanitized) {
    throw errorFactory();
  }
  return sanitized;
}

export function slugify(value) {
  const base = (value || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

  return base || 'tenant';
}

export function clampSlug(slug) {
  return (slug || '').slice(0, 120) || 'tenant';
}

export function normalizePeriod(value) {
  if (typeof value === 'string') {
    return value.trim();
  }
  return value ?? null;
}

export function toAmount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : 0;
}
