import mysql from 'mysql2/promise';
import { getDatabaseConfig } from './config.js';

const databaseConfig = getDatabaseConfig();

export const pool = mysql.createPool({
  host: databaseConfig.host,
  port: databaseConfig.port,
  user: databaseConfig.user,
  password: databaseConfig.password,
  database: databaseConfig.database,
  waitForConnections: true,
  connectionLimit: databaseConfig.connectionLimit,
  namedPlaceholders: true
});

export async function withConnection(callback) {
  const connection = await pool.getConnection();
  try {
    return await callback(connection);
  } finally {
    connection.release();
  }
}
