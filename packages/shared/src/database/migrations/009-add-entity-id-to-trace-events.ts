import { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  const tableExists = async (tableName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')`
    );
    return (results as any[])[0]?.exists === true;
  };

  const columnExists = async (tableName: string, columnName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = '${columnName}')`
    );
    return (results as any[])[0]?.exists === true;
  };

  const indexExists = async (tableName: string, indexName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM pg_indexes WHERE tablename = '${tableName}' AND indexname = '${indexName}')`
    );
    return (results as any[])[0]?.exists === true;
  };

  if (!(await tableExists('trace_events'))) {
    return;
  }

  const hasEntities = await tableExists('entities');
  const hasTraces = await tableExists('traces');

  if (!(await columnExists('trace_events', 'entity_id'))) {
    await queryInterface.addColumn('trace_events', 'entity_id', {
      type: DataTypes.UUID,
      allowNull: true,
      references: hasEntities
        ? {
            model: 'entities',
            key: 'id',
          }
        : undefined,
      onDelete: hasEntities ? 'SET NULL' : undefined,
    });
  }

  if (hasTraces) {
    await queryInterface.sequelize.query(`
      UPDATE trace_events e
      SET entity_id = t.entity_id
      FROM traces t
      WHERE e.trace_id = t.id
        AND e.entity_id IS NULL
        AND t.entity_id IS NOT NULL
    `);
  }

  if (!(await indexExists('trace_events', 'trace_events_entity_id_idx'))) {
    await queryInterface.addIndex('trace_events', ['entity_id'], {
      name: 'trace_events_entity_id_idx',
    });
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  const tableExists = async (tableName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')`
    );
    return (results as any[])[0]?.exists === true;
  };

  const columnExists = async (tableName: string, columnName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = '${columnName}')`
    );
    return (results as any[])[0]?.exists === true;
  };

  const indexExists = async (tableName: string, indexName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM pg_indexes WHERE tablename = '${tableName}' AND indexname = '${indexName}')`
    );
    return (results as any[])[0]?.exists === true;
  };

  if (!(await tableExists('trace_events'))) {
    return;
  }

  if (await indexExists('trace_events', 'trace_events_entity_id_idx')) {
    await queryInterface.removeIndex('trace_events', 'trace_events_entity_id_idx');
  }

  if (await columnExists('trace_events', 'entity_id')) {
    await queryInterface.removeColumn('trace_events', 'entity_id');
  }
}
