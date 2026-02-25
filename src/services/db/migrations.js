import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { pool, withConnection } from './pool.js';
import {
  DEFAULT_HOUSEHOLD_NAME,
  DEFAULT_HOUSEHOLD_SLUG,
  getSeedUserConfig
} from './config.js';
import {
  isDuplicateError,
  isMissingColumnError,
  isMissingTableError
} from './helpers.js';

export async function runMigrations() {
  await withConnection(async connection => {
    const ddlStatements = [
      `CREATE TABLE IF NOT EXISTS households (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(120) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS users (
        id CHAR(36) PRIMARY KEY,
        household_id CHAR(36) NOT NULL,
        username VARCHAR(120) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        is_admin TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP NULL DEFAULT NULL,
        CONSTRAINT fk_users_household FOREIGN KEY(household_id) REFERENCES households(id) ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS sections (
        id CHAR(36) PRIMARY KEY,
        household_id CHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_sections_household FOREIGN KEY(household_id) REFERENCES households(id) ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS categories (
        id CHAR(36) PRIMARY KEY,
        household_id CHAR(36) NOT NULL,
        section_id CHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_categories_household FOREIGN KEY(household_id) REFERENCES households(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_categories_section FOREIGN KEY(section_id) REFERENCES sections(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE IF NOT EXISTS entries (
        id CHAR(36) PRIMARY KEY,
        household_id CHAR(36) NOT NULL,
        category_id CHAR(36) NOT NULL,
        period VARCHAR(32),
        actual DECIMAL(13,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_entries_household FOREIGN KEY(household_id) REFERENCES households(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_entries_category FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    ];

    for (const ddl of ddlStatements) {
      await connection.query(ddl);
    }

    const alterColumnStatements = [
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS household_id CHAR(36) NULL',
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin TINYINT(1) NOT NULL DEFAULT 0',
      'ALTER TABLE sections ADD COLUMN IF NOT EXISTS household_id CHAR(36) NULL',
      'ALTER TABLE categories ADD COLUMN IF NOT EXISTS household_id CHAR(36) NULL',
      'ALTER TABLE entries ADD COLUMN IF NOT EXISTS household_id CHAR(36) NULL'
    ];

    for (const statement of alterColumnStatements) {
      await connection.query(statement);
    }

    const indexStatements = [
      'ALTER TABLE users ADD INDEX idx_users_household (household_id)',
      'ALTER TABLE sections ADD INDEX idx_sections_household (household_id)',
      'ALTER TABLE categories ADD INDEX idx_categories_household (household_id)',
      'ALTER TABLE entries ADD INDEX idx_entries_household (household_id)',
      'ALTER TABLE entries ADD INDEX idx_entries_category (category_id)'
    ];

    for (const statement of indexStatements) {
      try {
        await connection.query(statement);
      } catch (error) {
        if (!isDuplicateError(error)) {
          throw error;
        }
      }
    }

    const foreignKeyStatements = [
      'ALTER TABLE users ADD CONSTRAINT fk_users_household FOREIGN KEY(household_id) REFERENCES households(id) ON DELETE RESTRICT ON UPDATE CASCADE',
      'ALTER TABLE sections ADD CONSTRAINT fk_sections_household FOREIGN KEY(household_id) REFERENCES households(id) ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE categories ADD CONSTRAINT fk_categories_household FOREIGN KEY(household_id) REFERENCES households(id) ON DELETE CASCADE ON UPDATE CASCADE',
      'ALTER TABLE entries ADD CONSTRAINT fk_entries_household FOREIGN KEY(household_id) REFERENCES households(id) ON DELETE CASCADE ON UPDATE CASCADE'
    ];

    for (const statement of foreignKeyStatements) {
      try {
        await connection.query(statement);
      } catch (error) {
        if (!isDuplicateError(error)) {
          throw error;
        }
      }
    }
  });
}

export async function ensureDefaultHousehold() {
  return withConnection(async connection => {
    const [rows] = await connection.execute(
      'SELECT id, name, slug FROM households WHERE slug = ? LIMIT 1',
      [DEFAULT_HOUSEHOLD_SLUG]
    );

    if (rows.length > 0) {
      return rows[0];
    }

    const id = uuidv4();
    await connection.execute(
      'INSERT INTO households (id, name, slug) VALUES (?, ?, ?)',
      [id, DEFAULT_HOUSEHOLD_NAME, DEFAULT_HOUSEHOLD_SLUG]
    );

    return { id, name: DEFAULT_HOUSEHOLD_NAME, slug: DEFAULT_HOUSEHOLD_SLUG };
  });
}

export async function backfillTenantData(defaultHouseholdId) {
  await withConnection(async connection => {
    const statements = [
      'UPDATE users SET household_id = ? WHERE household_id IS NULL OR household_id = ""',
      'UPDATE sections SET household_id = ? WHERE household_id IS NULL OR household_id = ""',
      'UPDATE categories SET household_id = ? WHERE household_id IS NULL OR household_id = ""',
      'UPDATE entries SET household_id = ? WHERE household_id IS NULL OR household_id = ""'
    ];

    for (const statement of statements) {
      await connection.execute(statement, [defaultHouseholdId]);
    }

    await connection.execute('UPDATE users SET is_admin = 0 WHERE is_admin IS NULL');
  });
}

export async function enforceNotNullHouseholdColumns() {
  await withConnection(async connection => {
    const statements = [
      'ALTER TABLE users MODIFY COLUMN household_id CHAR(36) NOT NULL',
      'ALTER TABLE sections MODIFY COLUMN household_id CHAR(36) NOT NULL',
      'ALTER TABLE categories MODIFY COLUMN household_id CHAR(36) NOT NULL',
      'ALTER TABLE entries MODIFY COLUMN household_id CHAR(36) NOT NULL'
    ];

    for (const statement of statements) {
      try {
        await connection.query(statement);
      } catch (error) {
        if (isMissingColumnError(error) || isMissingTableError(error)) {
          continue;
        }
        throw error;
      }
    }
  });
}

export async function bootstrapInitialUsers(defaultHouseholdId) {
  const { envUser, fallbackUsers } = getSeedUserConfig();
  const seededUsers = [];

  if (envUser && (envUser.password || envUser.passwordHash)) {
    seededUsers.push({
      username: envUser.username,
      passwordHash: envUser.passwordHash || bcrypt.hashSync(envUser.password, 10),
      isAdmin: envUser.isAdmin !== false
    });
  }

  for (const user of fallbackUsers) {
    if (!seededUsers.find(item => item.username.toLowerCase() === user.username.toLowerCase())) {
      seededUsers.push({
        username: user.username,
        passwordHash: bcrypt.hashSync(user.password, 10),
        isAdmin: Boolean(user.isAdmin)
      });
    }
  }

  if (!seededUsers.length) {
    return;
  }

  await withConnection(async connection => {
    let created = 0;

    for (const user of seededUsers) {
      const normalizedUsername = user.username.trim();
      if (!normalizedUsername) continue;

      const [rows] = await connection.execute(
        'SELECT id FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1',
        [normalizedUsername]
      );

      if (rows.length > 0) {
        continue;
      }

      await connection.execute(
        'INSERT INTO users (id, username, password_hash, household_id, is_admin) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), normalizedUsername, user.passwordHash, defaultHouseholdId, user.isAdmin ? 1 : 0]
      );
      created += 1;
    }

    if (created > 0) {
      console.warn('Usuarios padrao criados no tenant principal. Acesse /users para revisar ou alterar as senhas.');
    }
  });
}

export async function initializeSchema() {
  await runMigrations();
  const defaultHousehold = await ensureDefaultHousehold();
  await backfillTenantData(defaultHousehold.id);
  await enforceNotNullHouseholdColumns();
  await bootstrapInitialUsers(defaultHousehold.id);
}
