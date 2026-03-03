import { QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  const tableExists = async (tableName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')`
    );
    return (results as any[])[0]?.exists === true;
  };

  if (!(await tableExists('providers')) || !(await tableExists('traces')) || !(await tableExists('trace_events'))) {
    return;
  }

  // Backfill traces.provider_id where user has exactly one active provider.
  await queryInterface.sequelize.query(`
    WITH single_provider AS (
      SELECT user_id, (ARRAY_AGG(id ORDER BY id))[1] AS provider_id
      FROM providers
      WHERE is_active = true
      GROUP BY user_id
      HAVING COUNT(*) = 1
    )
    UPDATE traces t
    SET provider_id = sp.provider_id
    FROM single_provider sp
    WHERE t.user_id = sp.user_id
      AND t.provider_id IS NULL
  `);

  // Backfill trace_events.provider_id from trace first, then single-provider fallback.
  await queryInterface.sequelize.query(`
    WITH single_provider AS (
      SELECT user_id, (ARRAY_AGG(id ORDER BY id))[1] AS provider_id
      FROM providers
      WHERE is_active = true
      GROUP BY user_id
      HAVING COUNT(*) = 1
    )
    UPDATE trace_events e
    SET provider_id = COALESCE(
      (SELECT t.provider_id FROM traces t WHERE t.id = e.trace_id),
      (SELECT sp.provider_id FROM single_provider sp WHERE sp.user_id = e.user_id)
    )
    WHERE e.provider_id IS NULL
      AND COALESCE(
        (SELECT t.provider_id FROM traces t WHERE t.id = e.trace_id),
        (SELECT sp.provider_id FROM single_provider sp WHERE sp.user_id = e.user_id)
      ) IS NOT NULL
  `);
}

export async function down(): Promise<void> {
  // Data backfill only; no-op rollback.
}
