import { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  const tableExists = async (tableName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')`
    );
    return (results as any[])[0]?.exists === true;
  };

  const indexExistsOnColumn = async (tableName: string, columnName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM pg_indexes WHERE tablename = '${tableName}' AND indexdef LIKE '%${columnName}%')`
    );
    return (results as any[])[0]?.exists === true;
  };

  // Create Better Auth user table
  if (!(await tableExists('user'))) {
    await queryInterface.createTable('user', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      emailVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      image: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      organizationId: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    });
  }

  if (!(await indexExistsOnColumn('user', 'email'))) {
    await queryInterface.addIndex('user', ['email']);
  }

  // Create Better Auth session table
  if (!(await tableExists('session'))) {
    await queryInterface.createTable('session', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      token: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      ipAddress: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
          model: 'user',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
    });
  }

  if (!(await indexExistsOnColumn('session', 'userId'))) {
    await queryInterface.addIndex('session', ['userId']);
  }
  if (!(await indexExistsOnColumn('session', 'token'))) {
    await queryInterface.addIndex('session', ['token']);
  }

  // Create Better Auth account table (for OAuth providers)
  if (!(await tableExists('account'))) {
    await queryInterface.createTable('account', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      accountId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      providerId: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      userId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
          model: 'user',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      accessToken: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      refreshToken: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      idToken: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      accessTokenExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      refreshTokenExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      scope: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });
  }

  if (!(await indexExistsOnColumn('account', 'userId'))) {
    await queryInterface.addIndex('account', ['userId']);
  }
  if (!(await indexExistsOnColumn('account', 'accountId'))) {
    await queryInterface.addIndex('account', ['providerId', 'accountId']);
  }

  // Create Better Auth verification table (for OAuth state and magic links)
  if (!(await tableExists('verification'))) {
    await queryInterface.createTable('verification', {
      id: {
        type: DataTypes.STRING,
        primaryKey: true,
      },
      identifier: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      value: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });
  }

  if (!(await indexExistsOnColumn('verification', 'identifier'))) {
    await queryInterface.addIndex('verification', ['identifier']);
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('verification');
  await queryInterface.dropTable('account');
  await queryInterface.dropTable('session');
  await queryInterface.dropTable('user');
}
