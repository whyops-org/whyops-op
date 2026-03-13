import { DataTypes, QueryInterface } from 'sequelize';

async function tableExists(queryInterface: QueryInterface, tableName: string): Promise<boolean> {
  const [results] = await queryInterface.sequelize.query(
    `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')`
  );
  return (results as any[])[0]?.exists === true;
}

async function indexExists(
  queryInterface: QueryInterface,
  tableName: string,
  indexName: string
): Promise<boolean> {
  const [results] = await queryInterface.sequelize.query(
    `SELECT EXISTS (SELECT FROM pg_indexes WHERE tablename = '${tableName}' AND indexname = '${indexName}')`
  );
  return (results as any[])[0]?.exists === true;
}

export async function up(queryInterface: QueryInterface): Promise<void> {
  // -----------------------------------------------------------------------
  // agent_knowledge_profiles — persisted web/social research about agent domain
  // -----------------------------------------------------------------------
  if (!(await tableExists(queryInterface, 'agent_knowledge_profiles'))) {
    await queryInterface.createTable('agent_knowledge_profiles', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      agent_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'agents', key: 'id' },
        onDelete: 'CASCADE',
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
      domain: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      profile: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      sources: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      last_built_at: {
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

  if (!(await indexExists(queryInterface, 'agent_knowledge_profiles', 'agent_knowledge_profiles_agent_id_unique'))) {
    await queryInterface.addIndex('agent_knowledge_profiles', ['agent_id'], {
      unique: true,
      name: 'agent_knowledge_profiles_agent_id_unique',
    });
  }

  if (!(await indexExists(queryInterface, 'agent_knowledge_profiles', 'agent_knowledge_profiles_scope_idx'))) {
    await queryInterface.addIndex('agent_knowledge_profiles', ['user_id', 'project_id', 'environment_id'], {
      name: 'agent_knowledge_profiles_scope_idx',
    });
  }

  // -----------------------------------------------------------------------
  // eval_configs — scheduling config for eval generation
  // -----------------------------------------------------------------------
  if (!(await tableExists(queryInterface, 'eval_configs'))) {
    await queryInterface.createTable('eval_configs', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      agent_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'agents', key: 'id' },
        onDelete: 'CASCADE',
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
      enabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      cron_expr: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: '0 2 * * 1',
      },
      timezone: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'UTC',
      },
      categories: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: ['happy_path', 'edge_case', 'multi_step', 'safety', 'error_handling', 'adversarial'],
      },
      max_evals_per_run: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 50,
      },
      custom_prompt: {
        type: DataTypes.TEXT,
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

  if (!(await indexExists(queryInterface, 'eval_configs', 'eval_configs_agent_id_unique'))) {
    await queryInterface.addIndex('eval_configs', ['agent_id'], {
      unique: true,
      name: 'eval_configs_agent_id_unique',
    });
  }

  if (!(await indexExists(queryInterface, 'eval_configs', 'eval_configs_enabled_idx'))) {
    await queryInterface.addIndex('eval_configs', ['enabled'], {
      name: 'eval_configs_enabled_idx',
    });
  }

  if (!(await indexExists(queryInterface, 'eval_configs', 'eval_configs_scope_idx'))) {
    await queryInterface.addIndex('eval_configs', ['user_id', 'project_id', 'environment_id'], {
      name: 'eval_configs_scope_idx',
    });
  }

  // -----------------------------------------------------------------------
  // eval_runs — each eval generation execution
  // -----------------------------------------------------------------------
  if (!(await tableExists(queryInterface, 'eval_runs'))) {
    await queryInterface.createTable('eval_runs', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      config_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'eval_configs', key: 'id' },
        onDelete: 'SET NULL',
      },
      agent_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'agents', key: 'id' },
        onDelete: 'CASCADE',
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
      entity_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'entities', key: 'id' },
        onDelete: 'SET NULL',
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
      },
      trigger: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'manual',
      },
      custom_prompt: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      eval_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      summary: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
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

  if (!(await indexExists(queryInterface, 'eval_runs', 'eval_runs_agent_created_idx'))) {
    await queryInterface.addIndex('eval_runs', ['agent_id', 'created_at'], {
      name: 'eval_runs_agent_created_idx',
    });
  }

  if (!(await indexExists(queryInterface, 'eval_runs', 'eval_runs_status_idx'))) {
    await queryInterface.addIndex('eval_runs', ['status'], {
      name: 'eval_runs_status_idx',
    });
  }

  if (!(await indexExists(queryInterface, 'eval_runs', 'eval_runs_config_idx'))) {
    await queryInterface.addIndex('eval_runs', ['config_id'], {
      name: 'eval_runs_config_idx',
    });
  }

  if (!(await indexExists(queryInterface, 'eval_runs', 'eval_runs_scope_idx'))) {
    await queryInterface.addIndex('eval_runs', ['user_id', 'project_id', 'environment_id'], {
      name: 'eval_runs_scope_idx',
    });
  }

  // -----------------------------------------------------------------------
  // eval_cases — individual generated eval test cases
  // -----------------------------------------------------------------------
  if (!(await tableExists(queryInterface, 'eval_cases'))) {
    await queryInterface.createTable('eval_cases', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      run_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'eval_runs', key: 'id' },
        onDelete: 'CASCADE',
      },
      agent_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'agents', key: 'id' },
        onDelete: 'CASCADE',
      },
      category: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      subcategory: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      conversation: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      expected_outcome: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      scoring_rubric: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      difficulty: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'basic',
      },
      tools_tested: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });
  }

  if (!(await indexExists(queryInterface, 'eval_cases', 'eval_cases_run_idx'))) {
    await queryInterface.addIndex('eval_cases', ['run_id'], {
      name: 'eval_cases_run_idx',
    });
  }

  if (!(await indexExists(queryInterface, 'eval_cases', 'eval_cases_agent_category_idx'))) {
    await queryInterface.addIndex('eval_cases', ['agent_id', 'category'], {
      name: 'eval_cases_agent_category_idx',
    });
  }

  if (!(await indexExists(queryInterface, 'eval_cases', 'eval_cases_agent_created_idx'))) {
    await queryInterface.addIndex('eval_cases', ['agent_id', 'created_at'], {
      name: 'eval_cases_agent_created_idx',
    });
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  const tables = ['eval_cases', 'eval_runs', 'eval_configs', 'agent_knowledge_profiles'];
  for (const table of tables) {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}')`
    );
    if ((results as any[])[0]?.exists === true) {
      await queryInterface.dropTable(table);
    }
  }
}
