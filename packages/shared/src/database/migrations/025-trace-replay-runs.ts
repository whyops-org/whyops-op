import { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  const tableExists = async (name: string): Promise<boolean> => {
    const [rows] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${name}')`
    );
    return (rows as any[])[0]?.exists === true;
  };

  const indexExists = async (table: string, index: string): Promise<boolean> => {
    const [rows] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM pg_indexes WHERE tablename = '${table}' AND indexname = '${index}')`
    );
    return (rows as any[])[0]?.exists === true;
  };

  if (!(await tableExists('trace_replay_runs'))) {
    await queryInterface.createTable('trace_replay_runs', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      trace_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: { model: 'traces', key: 'id' },
        onDelete: 'CASCADE',
      },
      analysis_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'trace_analyses', key: 'id' },
        onDelete: 'SET NULL',
      },
      user_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      project_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'projects', key: 'id' },
        onDelete: 'CASCADE',
      },
      environment_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'environments', key: 'id' },
        onDelete: 'CASCADE',
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'pending',
      },
      variant_config: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      replay_events: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      comparison: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      score: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      finished_at: {
        type: DataTypes.DATE,
        allowNull: true,
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

  if (!(await indexExists('trace_replay_runs', 'trr_trace_id_idx'))) {
    await queryInterface.addIndex('trace_replay_runs', ['trace_id'], { name: 'trr_trace_id_idx' });
  }
  if (!(await indexExists('trace_replay_runs', 'trr_user_id_idx'))) {
    await queryInterface.addIndex('trace_replay_runs', ['user_id'], { name: 'trr_user_id_idx' });
  }
  if (!(await indexExists('trace_replay_runs', 'trr_created_at_idx'))) {
    await queryInterface.addIndex('trace_replay_runs', ['created_at'], { name: 'trr_created_at_idx' });
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('trace_replay_runs');
}
