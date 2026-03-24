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

  if (!(await columnExists('llm_costs', 'context_window'))) {
    await queryInterface.addColumn('llm_costs', 'context_window', {
      type: DataTypes.BIGINT,
      allowNull: true,
    });
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

  if (await columnExists('llm_costs', 'context_window')) {
    await queryInterface.removeColumn('llm_costs', 'context_window');
  }
}
