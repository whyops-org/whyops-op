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

  if (!(await columnExists('traces', 'external_user_id'))) {
    await queryInterface.addColumn('traces', 'external_user_id', {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  if (!(await columnExists('trace_events', 'external_user_id'))) {
    await queryInterface.addColumn('trace_events', 'external_user_id', {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  if (!(await columnExists('trace_events', 'external_user_id'))) {
    await queryInterface.addIndex('trace_events', ['external_user_id']);
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  const columnExists = async (tableName: string, columnName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = '${tableName}' AND column_name = '${columnName}'
      )`
    );
    return (results as any[])[0]?.exists === true;
  };

  if (await columnExists('trace_events', 'external_user_id')) {
    await queryInterface.removeColumn('trace_events', 'external_user_id');
  }

  if (await columnExists('traces', 'external_user_id')) {
    await queryInterface.removeColumn('traces', 'external_user_id');
  }
}
