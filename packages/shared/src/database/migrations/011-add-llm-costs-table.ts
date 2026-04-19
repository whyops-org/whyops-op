import { DataTypes, QueryInterface } from 'sequelize';

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

  if (!(await tableExists('llm_costs'))) {
    await queryInterface.createTable('llm_costs', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      model: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      input_token_price_per_million_token: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      output_token_price_per_million_token: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      cached_token_price_per_million_token: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });
  }

  if (!(await indexExists('llm_costs', 'llm_costs_model_unique_idx'))) {
    await queryInterface.addIndex('llm_costs', ['model'], {
      unique: true,
      name: 'llm_costs_model_unique_idx',
    });
  }

  if (!(await indexExists('llm_costs', 'llm_costs_created_at_idx'))) {
    await queryInterface.addIndex('llm_costs', ['created_at'], {
      name: 'llm_costs_created_at_idx',
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

  if (await tableExists('llm_costs')) {
    await queryInterface.dropTable('llm_costs');
  }
}
