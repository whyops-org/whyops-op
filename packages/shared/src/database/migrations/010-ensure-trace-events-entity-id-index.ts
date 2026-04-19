import { QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'trace_events' AND column_name = 'entity_id'
      ) THEN
        CREATE INDEX IF NOT EXISTS trace_events_entity_id_idx
          ON trace_events (entity_id);
      END IF;
    END
    $$;
  `);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS trace_events_entity_id_idx;
  `);
}
