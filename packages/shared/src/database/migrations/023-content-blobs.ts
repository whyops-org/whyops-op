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

  if (!(await tableExists('content_blobs'))) {
    await queryInterface.createTable('content_blobs', {
      hash: {
        type: DataTypes.STRING(64),
        primaryKey: true,
        allowNull: false,
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      byte_size: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });

    // Apply lz4 compression to the large content column
    await queryInterface.sequelize.query(
      `ALTER TABLE content_blobs ALTER COLUMN content SET COMPRESSION lz4`
    );
  }

  if (!(await columnExists('traces', 'system_message_hash'))) {
    await queryInterface.addColumn('traces', 'system_message_hash', {
      type: DataTypes.STRING(64),
      allowNull: true,
      references: { model: 'content_blobs', key: 'hash' },
    });
  }

  if (!(await columnExists('traces', 'tools_hash'))) {
    await queryInterface.addColumn('traces', 'tools_hash', {
      type: DataTypes.STRING(64),
      allowNull: true,
      references: { model: 'content_blobs', key: 'hash' },
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

  if (await columnExists('traces', 'tools_hash')) {
    await queryInterface.removeColumn('traces', 'tools_hash');
  }
  if (await columnExists('traces', 'system_message_hash')) {
    await queryInterface.removeColumn('traces', 'system_message_hash');
  }

  await queryInterface.dropTable('content_blobs', { cascade: true });
}
