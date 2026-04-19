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

  const constraintExists = async (tableName: string, constraintName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM pg_constraint WHERE conname = '${constraintName}')`
    );
    return (results as any[])[0]?.exists === true;
  };

  const indexExistsOnColumn = async (tableName: string, columnName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM pg_indexes WHERE tablename = '${tableName}' AND indexdef LIKE '%${columnName}%')`
    );
    return (results as any[])[0]?.exists === true;
  };

  const hasEntities = await tableExists('entities');

  if (!(await tableExists('agents'))) {
    await queryInterface.createTable('agents', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      project_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'projects',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      environment_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'environments',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
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

  if (!(await constraintExists('agents', 'unique_environment_agent_name'))) {
    await queryInterface.addConstraint('agents', {
      fields: ['environment_id', 'name'],
      type: 'unique',
      name: 'unique_environment_agent_name',
    });
  }

  if (hasEntities) {
    if (!(await columnExists('entities', 'agent_id'))) {
      await queryInterface.addColumn('entities', 'agent_id', {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'agents',
          key: 'id',
        },
        onDelete: 'CASCADE',
      });
    }

    if (!(await indexExistsOnColumn('entities', 'agent_id'))) {
      await queryInterface.addIndex('entities', ['agent_id']);
    }
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeIndex('entities', ['agent_id']);
  await queryInterface.removeColumn('entities', 'agent_id');
  await queryInterface.removeConstraint('agents', 'unique_environment_agent_name');
  await queryInterface.dropTable('agents');
}
