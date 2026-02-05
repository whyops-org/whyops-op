import { sequelize } from './index';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Create migrations table if not exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
        "name" VARCHAR(255) PRIMARY KEY
      );
    `);

    // Get executed migrations
    const [executedMigrations] = await sequelize.query('SELECT "name" FROM "SequelizeMeta"');
    const executedNames = new Set((executedMigrations as any[]).map((m: any) => m.name));

    // Get migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found.');
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
      .sort();

    for (const file of files) {
      if (executedNames.has(file)) {
        continue;
      }

      console.log(`Running migration: ${file}`);
      
      // Import the migration file
      // In Bun/ESM, we can import directly
      const migrationPath = path.join(migrationsDir, file);
      const migration = await import(migrationPath);

      if (migration.default && typeof migration.default.up === 'function') {
        await migration.default.up(sequelize.getQueryInterface());
        
        // Record migration
        await sequelize.query(`INSERT INTO "SequelizeMeta" ("name") VALUES ('${file}')`);
        console.log(`Completed migration: ${file}`);
      } else {
        console.error(`Migration ${file} is missing 'up' function.`);
      }
    }

    console.log('All migrations executed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
