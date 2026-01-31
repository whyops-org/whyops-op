import { Sequelize } from 'sequelize';
import env from '../config/env';
import logger from '../utils/logger';
import { parseDatabaseUrl } from '../utils/helpers';

let dbConfig: any;

if (env.DATABASE_URL) {
  const parsed = parseDatabaseUrl(env.DATABASE_URL);
  dbConfig = {
    host: parsed.host,
    port: parsed.port,
    database: parsed.database,
    username: parsed.username,
    password: parsed.password,
  };
} else {
  dbConfig = {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
  };
}

export const sequelize = new Sequelize({
  ...dbConfig,
  dialect: 'postgres',
  logging: env.NODE_ENV === 'development' ? (msg) => logger.debug(msg) : false,
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
    
    if (env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.info('Database synchronized');
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
