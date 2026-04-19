import { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  const columnExists = async (tableName: string, columnName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = '${columnName}')`
    );
    return (results as any[])[0]?.exists === true;
  };

  if (!(await columnExists('traces', 'events_payload'))) {
    await queryInterface.addColumn('traces', 'events_payload', {
      type: DataTypes.BLOB,
      allowNull: true,
    });
  }

  if (!(await columnExists('traces', 'events_payload_at'))) {
    await queryInterface.addColumn('traces', 'events_payload_at', {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  const columnExists = async (tableName: string, columnName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = '${tableName}' AND column_name = '${columnName}')`
    );
    return (results as any[])[0]?.exists === true;
  };

  if (await columnExists('traces', 'events_payload_at')) {
    await queryInterface.removeColumn('traces', 'events_payload_at');
  }
  if (await columnExists('traces', 'events_payload')) {
    await queryInterface.removeColumn('traces', 'events_payload');
  }
}
