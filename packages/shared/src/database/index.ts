import { Sequelize } from 'sequelize';
import env from '../config/env';
import logger from '../utils/logger';
import { getDatabaseSslConfig, getSequelizeConnectionConfig } from './connection-config';
import { runPendingMigrations } from './run-migrations';

const dbConfig = getSequelizeConnectionConfig();

export const sequelize = new Sequelize({
  ...dbConfig,
  dialect: 'postgres',
  dialectOptions: {
    // Disable prepared statements to avoid "cached plan must not change result type" error
    // which can happen when schema changes or with connection pooling issues in some environments.
    // This forces pg to use simple queries.
    binary: false,
    ssl: getDatabaseSslConfig() || undefined,
  },
  benchmark: true,
  logging: (sql, timingMs) => {
    if (env.NODE_ENV === 'development') {
      logger.debug({ sql, timingMs }, 'SQL query executed');
      return;
    }

    if (typeof timingMs === 'number' && timingMs >= env.DB_SLOW_QUERY_MS) {
      logger.warn({ sql, timingMs }, 'Slow SQL query');
    }
  },
  pool: {
    max: env.DB_POOL_MAX,
    min: env.DB_POOL_MIN,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    underscored: true,
  },
});

export async function initDatabase() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    const executedMigrations = await runPendingMigrations(sequelize);
    if (executedMigrations.length > 0) {
      logger.info({ count: executedMigrations.length, migrations: executedMigrations }, 'Database migrations applied');
    } else {
      logger.info('Database schema already up to date');
    }
  } catch (error) {
    logger.error({ error }, 'Unable to connect to the database');
    throw error;
  }
}

export async function closeDatabase() {
  try {
    await sequelize.close();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error({ error }, 'Error closing database connection');
    throw error;
  }
}

export default sequelize;
