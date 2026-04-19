import { QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  const tableExists = async (tableName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')`
    );
    return (results as any[])[0]?.exists === true;
  };

  const indexExists = async (tableName: string, indexName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM pg_indexes WHERE tablename = '${tableName}' AND indexname = '${indexName}')`
    );
    return (results as any[])[0]?.exists === true;
  };

  if (await tableExists('agents')) {
    if (!(await indexExists('agents', 'agents_scope_created_idx'))) {
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS agents_scope_created_idx
        ON agents (user_id, project_id, environment_id, created_at DESC)
      `);
    }

    if (!(await indexExists('agents', 'agents_user_created_idx'))) {
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS agents_user_created_idx
        ON agents (user_id, created_at DESC)
      `);
    }
  }

  if (await tableExists('entities')) {
    if (!(await indexExists('entities', 'entities_agent_created_idx'))) {
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS entities_agent_created_idx
        ON entities (agent_id, created_at DESC)
      `);
    }
  }

  if (await tableExists('traces')) {
    if (!(await indexExists('traces', 'traces_entity_id_idx'))) {
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS traces_entity_id_idx
        ON traces (entity_id)
      `);
    }

    if (!(await indexExists('traces', 'traces_entity_created_idx'))) {
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS traces_entity_created_idx
        ON traces (entity_id, created_at DESC)
      `);
    }
  }

  if (await tableExists('trace_events')) {
    if (!(await indexExists('trace_events', 'trace_events_trace_type_idx'))) {
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS trace_events_trace_type_idx
        ON trace_events (trace_id, event_type)
      `);
    }
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    DROP INDEX IF EXISTS agents_scope_created_idx;
    DROP INDEX IF EXISTS agents_user_created_idx;
    DROP INDEX IF EXISTS entities_agent_created_idx;
    DROP INDEX IF EXISTS traces_entity_id_idx;
    DROP INDEX IF EXISTS traces_entity_created_idx;
    DROP INDEX IF EXISTS trace_events_trace_type_idx;
  `);
}
