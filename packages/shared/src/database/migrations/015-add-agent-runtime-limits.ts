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

export async function up(queryInterface: QueryInterface): Promise<void> {
  if (!(await tableExists(queryInterface, 'agents'))) {
    return;
  }

  if (!(await columnExists(queryInterface, 'agents', 'max_traces'))) {
    await queryInterface.addColumn('agents', 'max_traces', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10000,
    });
  }

  if (!(await columnExists(queryInterface, 'agents', 'max_spans'))) {
    await queryInterface.addColumn('agents', 'max_spans', {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1000,
    });
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  if (!(await tableExists(queryInterface, 'agents'))) {
    return;
  }

  if (await columnExists(queryInterface, 'agents', 'max_spans')) {
    await queryInterface.removeColumn('agents', 'max_spans');
  }

  if (await columnExists(queryInterface, 'agents', 'max_traces')) {
    await queryInterface.removeColumn('agents', 'max_traces');
  }
}
