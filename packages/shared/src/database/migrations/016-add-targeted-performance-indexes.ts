import { QueryInterface } from 'sequelize';

async function tableExists(queryInterface: QueryInterface, tableName: string): Promise<boolean> {
  const [results] = await queryInterface.sequelize.query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')`
  );
  return (results as any[])[0]?.exists === true;
}

async function indexExists(
  queryInterface: QueryInterface,
  tableName: string,
  indexName: string
): Promise<boolean> {
  const [results] = await queryInterface.sequelize.query(
    `SELECT EXISTS (SELECT FROM pg_indexes WHERE tablename = '${tableName}' AND indexname = '${indexName}')`
  );
  return (results as any[])[0]?.exists === true;
}

export async function up(queryInterface: QueryInterface): Promise<void> {
  if (await tableExists(queryInterface, 'agents')) {
    if (!(await indexExists(queryInterface, 'agents', 'agents_scope_name_idx'))) {
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS agents_scope_name_idx
        ON agents (user_id, project_id, environment_id, name)
      `);
    }
  }

  if (await tableExists(queryInterface, 'api_keys')) {
    if (!(await indexExists(queryInterface, 'api_keys', 'api_keys_user_master_active_created_idx'))) {
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS api_keys_user_master_active_created_idx
        ON api_keys (user_id, is_master, is_active, created_at DESC)
      `);
    }
  }

  if (await tableExists(queryInterface, 'trace_events')) {
    if (!(await indexExists(queryInterface, 'trace_events', 'trace_events_trace_id_timestamp_idx'))) {
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS trace_events_trace_id_timestamp_idx
        ON trace_events (trace_id, "timestamp")
      `);
    }

    if (!(await indexExists(queryInterface, 'trace_events', 'trace_events_trace_id_timestamp_error_idx'))) {
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS trace_events_trace_id_timestamp_error_idx
        ON trace_events (trace_id, "timestamp", event_type)
      `);
    }
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS agents_scope_name_idx;
    DROP INDEX IF EXISTS api_keys_user_master_active_created_idx;
    DROP INDEX IF EXISTS trace_events_trace_id_timestamp_idx;
    DROP INDEX IF EXISTS trace_events_trace_id_timestamp_error_idx;
  `);
}
