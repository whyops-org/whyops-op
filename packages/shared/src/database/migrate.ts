import { sequelize } from './index';
import { runPendingMigrations } from './run-migrations';

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');
    const executedMigrations = await runPendingMigrations(sequelize);
    if (executedMigrations.length === 0) {
      console.log('No pending migrations.');
    } else {
      for (const file of executedMigrations) {
        console.log(`Completed migration: ${file}`);
      }
      console.log('All migrations executed successfully.');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

migrate();
