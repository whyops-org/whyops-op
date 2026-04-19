import fs from 'fs';
import { Client } from 'pg';
import path from 'path';
import type { Sequelize } from 'sequelize';
import { fileURLToPath, pathToFileURL } from 'url';
import { getPgClientConfig } from './connection-config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATION_LOCK_KEY = 286_341_905;

async function withMigrationLock<T>(run: () => Promise<T>): Promise<T> {
  const client = new Client(getPgClientConfig());
  await client.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    return await run();
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    } finally {
      await client.end();
    }
  }
}

export async function runPendingMigrations(sequelize: Sequelize): Promise<string[]> {
  return withMigrationLock(async () => {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
        "name" VARCHAR(255) PRIMARY KEY
      );
    `);

    const [executedMigrations] = await sequelize.query('SELECT "name" FROM "SequelizeMeta"');
    const executedNames = new Set((executedMigrations as Array<{ name: string }>).map((migration) => migration.name));

    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      return [];
    }

    const files = fs.readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.ts') || file.endsWith('.js'))
      .sort();

    const executedNow: string[] = [];

    for (const file of files) {
      if (executedNames.has(file)) {
        continue;
      }

      const migrationUrl = pathToFileURL(path.join(migrationsDir, file)).href;
      const migration = await import(migrationUrl);
      const up =
        (typeof migration?.up === 'function' && migration.up) ||
        (typeof migration?.default?.up === 'function' && migration.default.up);

      if (!up) {
        throw new Error(`Migration ${file} is missing an exported up() function`);
      }

      await up(sequelize.getQueryInterface());
      await sequelize.query(
        'INSERT INTO "SequelizeMeta" ("name") VALUES (:name)',
        { replacements: { name: file } }
      );
      executedNow.push(file);
    }

    return executedNow;
  });
}
