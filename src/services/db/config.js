const DEFAULTS = Object.freeze({
  householdName: 'Familia Principal',
  householdSlug: 'familia-principal',
  connectionLimit: 10
});

const FALLBACK_USERS = Object.freeze([
  { username: 'junior', password: 'Skate@123', isAdmin: true },
  { username: 'mariele', password: 'Mala25direta', isAdmin: false }
]);

export const DEFAULT_HOUSEHOLD_NAME = DEFAULTS.householdName;
export const DEFAULT_HOUSEHOLD_SLUG = DEFAULTS.householdSlug;

export function getDatabaseConfig() {
  const {
    DB_HOST = 'localhost',
    DB_PORT = '3306',
    DB_USER = 'gestao',
    DB_PASSWORD = 'gestao',
    DB_NAME = 'gestao_financeira',
    DB_CONN_LIMIT = String(DEFAULTS.connectionLimit)
  } = process.env;

  return {
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    connectionLimit: Math.max(Number(DB_CONN_LIMIT) || DEFAULTS.connectionLimit, 1)
  };
}

export function getSeedUserConfig() {
  const {
    AUTH_USERNAME = '',
    AUTH_PASSWORD = '',
    AUTH_PASSWORD_HASH = ''
  } = process.env;

  const envUser = AUTH_USERNAME.trim()
    ? {
        username: AUTH_USERNAME.trim(),
        password: AUTH_PASSWORD,
        passwordHash: AUTH_PASSWORD_HASH,
        isAdmin: true
      }
    : null;

  return {
    envUser,
    fallbackUsers: FALLBACK_USERS
  };
}
