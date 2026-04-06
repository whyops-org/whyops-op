import { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  const columnExists = async (tableName: string, columnName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = '${tableName}' AND column_name = '${columnName}'
      )`
    );
    return (results as any[])[0]?.exists === true;
  };

  const columns: Array<[string, Parameters<typeof queryInterface.addColumn>[2]]> = [
    ['model', { type: DataTypes.STRING(200), allowNull: true }],
    ['prompt_tokens', { type: DataTypes.INTEGER, allowNull: true }],
    ['completion_tokens', { type: DataTypes.INTEGER, allowNull: true }],
    ['cache_read_tokens', { type: DataTypes.INTEGER, allowNull: true }],
    ['cache_write_tokens', { type: DataTypes.INTEGER, allowNull: true }],
    ['latency_ms', { type: DataTypes.INTEGER, allowNull: true }],
    ['finish_reason', { type: DataTypes.STRING(100), allowNull: true }],
  ];

  for (const [column, definition] of columns) {
    if (!(await columnExists('trace_events', column))) {
      await queryInterface.addColumn('trace_events', column, definition);
    }
  }

  // Index for per-trace model breakdown (used in thread detail aggregation)
  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS trace_events_trace_model_idx
      ON trace_events (trace_id, model)
      WHERE model IS NOT NULL;
  `);

  // Index for finish_reason filtering (e.g. error analysis)
  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS trace_events_finish_reason_idx
      ON trace_events (trace_id, finish_reason)
      WHERE finish_reason IS NOT NULL;
  `);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`DROP INDEX IF EXISTS trace_events_trace_model_idx`);
  await queryInterface.sequelize.query(`DROP INDEX IF EXISTS trace_events_finish_reason_idx`);

  for (const column of ['model', 'prompt_tokens', 'completion_tokens', 'cache_read_tokens', 'cache_write_tokens', 'latency_ms', 'finish_reason']) {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'trace_events' AND column_name = '${column}')`
    );
    if ((results as any[])[0]?.exists === true) {
      await queryInterface.removeColumn('trace_events', column);
    }
  }
}
