import { DataTypes, QueryInterface } from 'sequelize';

async function tableExists(queryInterface: QueryInterface, tableName: string): Promise<boolean> {
  const [results] = await queryInterface.sequelize.query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')`
  );
  return (results as any[])[0]?.exists === true;
}

async function columnExists(
  queryInterface: QueryInterface,
  tableName: string,
  columnName: string
): Promise<boolean> {
  const [results] = await queryInterface.sequelize.query(
    `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = '${columnName}')`
  );
  return (results as any[])[0]?.exists === true;
}

async function constraintExists(
  queryInterface: QueryInterface,
  constraintName: string
): Promise<boolean> {
  const [results] = await queryInterface.sequelize.query(
    `SELECT EXISTS (SELECT FROM pg_constraint WHERE conname = '${constraintName}')`
  );
  return (results as any[])[0]?.exists === true;
}

async function traceEventsTraceFkExists(queryInterface: QueryInterface): Promise<boolean> {
  const [results] = await queryInterface.sequelize.query(`
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class tbl ON tbl.oid = c.conrelid
      JOIN pg_class ref ON ref.oid = c.confrelid
      JOIN unnest(c.conkey) AS key_col(attnum) ON true
      JOIN pg_attribute attr ON attr.attrelid = tbl.oid AND attr.attnum = key_col.attnum
      WHERE c.contype = 'f'
        AND tbl.relname = 'trace_events'
        AND ref.relname = 'traces'
        AND attr.attname = 'trace_id'
    )
  `);
  return (results as any[])[0]?.exists === true;
}

export async function up(queryInterface: QueryInterface): Promise<void> {
  if (await tableExists(queryInterface, 'entities')) {
    if (await columnExists(queryInterface, 'entities', 'sampling_rate')) {
      await queryInterface.changeColumn('entities', 'sampling_rate', {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 0.2,
      });
    }
  }

  const hasTraceEvents = await tableExists(queryInterface, 'trace_events');
  const hasTraces = await tableExists(queryInterface, 'traces');
  const hasTraceIdColumn = await columnExists(queryInterface, 'trace_events', 'trace_id');
  if (!hasTraceEvents || !hasTraces || !hasTraceIdColumn) {
    return;
  }

  await queryInterface.sequelize.query(`
    DELETE FROM trace_events e
    WHERE NOT EXISTS (
      SELECT 1
      FROM traces t
      WHERE t.id = e.trace_id
    )
  `);

  const fkName = 'trace_events_trace_id_fk_cascade';
  const hasAnyTraceFk = await traceEventsTraceFkExists(queryInterface);
  if (!hasAnyTraceFk) {
    await queryInterface.sequelize.query(`
      ALTER TABLE trace_events
      ADD CONSTRAINT ${fkName}
      FOREIGN KEY (trace_id)
      REFERENCES traces(id)
      ON DELETE CASCADE
      NOT VALID
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE trace_events
      VALIDATE CONSTRAINT ${fkName}
    `);
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  if (await tableExists(queryInterface, 'entities')) {
    if (await columnExists(queryInterface, 'entities', 'sampling_rate')) {
      await queryInterface.changeColumn('entities', 'sampling_rate', {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 1.0,
      });
    }
  }

  const fkName = 'trace_events_trace_id_fk_cascade';
  if (await constraintExists(queryInterface, fkName)) {
    await queryInterface.sequelize.query(`
      ALTER TABLE trace_events
      DROP CONSTRAINT ${fkName}
    `);
  }
}
