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

  // Rename cached_token_price_per_million_token → cache_read_token_price_per_million_token
  if (
    (await columnExists('llm_costs', 'cached_token_price_per_million_token')) &&
    !(await columnExists('llm_costs', 'cache_read_token_price_per_million_token'))
  ) {
    await queryInterface.renameColumn(
      'llm_costs',
      'cached_token_price_per_million_token',
      'cache_read_token_price_per_million_token'
    );
  }

  if (!(await columnExists('llm_costs', 'cache_write_5m_token_price_per_million_token'))) {
    await queryInterface.addColumn('llm_costs', 'cache_write_5m_token_price_per_million_token', {
      type: DataTypes.FLOAT,
      allowNull: true,
    });
  }

  if (!(await columnExists('llm_costs', 'cache_write_1h_token_price_per_million_token'))) {
    await queryInterface.addColumn('llm_costs', 'cache_write_1h_token_price_per_million_token', {
      type: DataTypes.FLOAT,
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

  if (await columnExists('llm_costs', 'cache_write_1h_token_price_per_million_token')) {
    await queryInterface.removeColumn('llm_costs', 'cache_write_1h_token_price_per_million_token');
  }

  if (await columnExists('llm_costs', 'cache_write_5m_token_price_per_million_token')) {
    await queryInterface.removeColumn('llm_costs', 'cache_write_5m_token_price_per_million_token');
  }

  if (
    (await columnExists('llm_costs', 'cache_read_token_price_per_million_token')) &&
    !(await columnExists('llm_costs', 'cached_token_price_per_million_token'))
  ) {
    await queryInterface.renameColumn(
      'llm_costs',
      'cache_read_token_price_per_million_token',
      'cached_token_price_per_million_token'
    );
  }
}
