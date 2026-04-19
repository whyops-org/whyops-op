import type { ClientConfig } from 'pg';
import env from '../config/env';
import { buildPgSslConfig, parseDatabaseUrl } from '../utils/helpers';

type BaseDbConfig = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
};

function getBaseDbConfig(): BaseDbConfig {
  if (env.DATABASE_URL) {
    return parseDatabaseUrl(env.DATABASE_URL);
  }

  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
  };
}

export function getSequelizeConnectionConfig(): BaseDbConfig {
  return getBaseDbConfig();
}

export function getDatabaseSslConfig(): false | { rejectUnauthorized: boolean } {
  const baseConfig = getBaseDbConfig();

  return buildPgSslConfig({
    databaseUrl: env.DATABASE_URL,
    dbHost: baseConfig.host,
    explicitSsl: env.DB_SSL,
    rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED,
  });
}

export function getPgClientConfig(): ClientConfig {
  const baseConfig = getBaseDbConfig();

  return {
    host: baseConfig.host,
    port: baseConfig.port,
    database: baseConfig.database,
    user: baseConfig.username,
    password: baseConfig.password,
    ssl: getDatabaseSslConfig() || undefined,
  };
}
