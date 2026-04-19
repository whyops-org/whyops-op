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

  const indexExists = async (tableName: string, indexName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM pg_indexes WHERE tablename = '${tableName}' AND indexname = '${indexName}')`
    );
    return (results as any[])[0]?.exists === true;
  };

  const indexExistsOnColumn = async (tableName: string, columnName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM pg_indexes WHERE tablename = '${tableName}' AND indexdef LIKE '%${columnName}%')`
    );
    return (results as any[])[0]?.exists === true;
  };

  const constraintExists = async (constraintName: string): Promise<boolean> => {
    const [results] = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM pg_constraint WHERE conname = '${constraintName}')`
    );
    return (results as any[])[0]?.exists === true;
  };

  const hasUsers = await tableExists('users');
  const hasProjects = await tableExists('projects');
  const hasEnvironments = await tableExists('environments');
  const hasAgents = await tableExists('agents');

  if (hasUsers && !(await tableExists('providers'))) {
    await queryInterface.createTable('providers', {
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
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      base_url: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      api_key: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

  if (
    (await tableExists('providers')) &&
    !(await indexExists('providers', 'providers_user_id_slug_unique_idx'))
  ) {
    await queryInterface.addIndex('providers', ['user_id', 'slug'], {
      unique: true,
      name: 'providers_user_id_slug_unique_idx',
    });
  }

  if (
    hasUsers &&
    hasProjects &&
    hasEnvironments &&
    !(await tableExists('entities'))
  ) {
    await queryInterface.createTable('entities', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      agent_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: hasAgents
          ? {
              model: 'agents',
              key: 'id',
            }
          : undefined,
        onDelete: hasAgents ? 'CASCADE' : undefined,
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
      hash: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      sampling_rate: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 1.0,
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

  if (
    (await tableExists('entities')) &&
    !(await constraintExists('unique_environment_entity'))
  ) {
    await queryInterface.addConstraint('entities', {
      fields: ['environment_id', 'name', 'hash'],
      type: 'unique',
      name: 'unique_environment_entity',
    });
  }

  if ((await tableExists('entities')) && !(await indexExistsOnColumn('entities', 'agent_id'))) {
    await queryInterface.addIndex('entities', ['agent_id'], {
      name: 'entities_agent_id_idx',
    });
  }

  if (
    hasUsers &&
    hasProjects &&
    hasEnvironments &&
    !(await tableExists('api_keys'))
  ) {
    const hasProviders = await tableExists('providers');
    const hasEntities = await tableExists('entities');

    await queryInterface.createTable('api_keys', {
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
      provider_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: hasProviders
          ? {
              model: 'providers',
              key: 'id',
            }
          : undefined,
        onDelete: hasProviders ? 'CASCADE' : undefined,
      },
      entity_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: hasEntities
          ? {
              model: 'entities',
              key: 'id',
            }
          : undefined,
        onDelete: hasEntities ? 'CASCADE' : undefined,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      key_hash: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      key_encrypted: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      key_prefix: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      is_master: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      last_used_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      rate_limit: {
        type: DataTypes.INTEGER,
        allowNull: true,
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
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });
  }

  if (
    (await tableExists('api_keys')) &&
    !(await columnExists('api_keys', 'key_encrypted'))
  ) {
    await queryInterface.addColumn('api_keys', 'key_encrypted', {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Encrypted full API key for explicit reveal endpoint',
    });
  }

  if ((await tableExists('api_keys')) && !(await indexExistsOnColumn('api_keys', 'project_id'))) {
    await queryInterface.addIndex('api_keys', ['project_id'], {
      name: 'api_keys_project_id_idx',
    });
  }

  if (
    (await tableExists('api_keys')) &&
    !(await indexExistsOnColumn('api_keys', 'environment_id'))
  ) {
    await queryInterface.addIndex('api_keys', ['environment_id'], {
      name: 'api_keys_environment_id_idx',
    });
  }

  if ((await tableExists('api_keys')) && !(await indexExistsOnColumn('api_keys', 'is_master'))) {
    await queryInterface.addIndex('api_keys', ['is_master'], {
      name: 'api_keys_is_master_idx',
    });
  }

  if (hasUsers && !(await tableExists('traces'))) {
    const hasEntities = await tableExists('entities');

    await queryInterface.createTable('traces', {
      id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      provider_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      entity_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: hasEntities
          ? {
              model: 'entities',
              key: 'id',
            }
          : undefined,
        onDelete: hasEntities ? 'CASCADE' : undefined,
      },
      sampled_in: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: true,
      },
      model: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      system_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      tools: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
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

  if ((await tableExists('traces')) && !(await indexExists('traces', 'traces_sampled_in_idx'))) {
    await queryInterface.addIndex('traces', ['sampled_in'], {
      name: 'traces_sampled_in_idx',
    });
  }

  if (hasUsers && !(await tableExists('trace_events'))) {
    const hasProviders = await tableExists('providers');

    await queryInterface.createTable('trace_events', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      trace_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      span_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      step_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      parent_step_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      event_type: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      provider_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: hasProviders
          ? {
              model: 'providers',
              key: 'id',
            }
          : undefined,
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      content: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });
  }

  if ((await tableExists('trace_events')) && !(await indexExistsOnColumn('trace_events', 'trace_id'))) {
    await queryInterface.addIndex('trace_events', ['trace_id'], {
      name: 'trace_events_trace_id_idx',
    });
  }
  if ((await tableExists('trace_events')) && !(await indexExistsOnColumn('trace_events', 'user_id'))) {
    await queryInterface.addIndex('trace_events', ['user_id'], {
      name: 'trace_events_user_id_idx',
    });
  }
  if (
    (await tableExists('trace_events')) &&
    !(await indexExistsOnColumn('trace_events', 'provider_id'))
  ) {
    await queryInterface.addIndex('trace_events', ['provider_id'], {
      name: 'trace_events_provider_id_idx',
    });
  }
  if (
    (await tableExists('trace_events')) &&
    !(await indexExistsOnColumn('trace_events', 'timestamp'))
  ) {
    await queryInterface.addIndex('trace_events', ['timestamp'], {
      name: 'trace_events_timestamp_idx',
    });
  }
  if (
    (await tableExists('trace_events')) &&
    !(await indexExists('trace_events', 'trace_events_trace_step_idx'))
  ) {
    await queryInterface.addIndex('trace_events', ['trace_id', 'step_id'], {
      name: 'trace_events_trace_step_idx',
    });
  }

  if (!(await tableExists('request_logs'))) {
    await queryInterface.createTable('request_logs', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      method: {
        type: DataTypes.STRING(10),
        allowNull: false,
      },
      path: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status_code: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      latency_ms: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      api_key_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      provider_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      user_agent: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      request_body: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      response_body: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      error: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });
  }

  if (
    (await tableExists('request_logs')) &&
    !(await indexExistsOnColumn('request_logs', 'timestamp'))
  ) {
    await queryInterface.addIndex('request_logs', ['timestamp'], {
      name: 'request_logs_timestamp_idx',
    });
  }
  if (
    (await tableExists('request_logs')) &&
    !(await indexExistsOnColumn('request_logs', 'user_id'))
  ) {
    await queryInterface.addIndex('request_logs', ['user_id'], {
      name: 'request_logs_user_id_idx',
    });
  }
  if (
    (await tableExists('request_logs')) &&
    !(await indexExistsOnColumn('request_logs', 'api_key_id'))
  ) {
    await queryInterface.addIndex('request_logs', ['api_key_id'], {
      name: 'request_logs_api_key_id_idx',
    });
  }
  if (
    (await tableExists('request_logs')) &&
    !(await indexExistsOnColumn('request_logs', 'status_code'))
  ) {
    await queryInterface.addIndex('request_logs', ['status_code'], {
      name: 'request_logs_status_code_idx',
    });
  }

  if ((await tableExists('traces')) && !(await tableExists('trace_analyses'))) {
    await queryInterface.createTable('trace_analyses', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      trace_id: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
          model: 'traces',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'pending',
      },
      rubric_version: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      judge_model: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      mode: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'standard',
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      finished_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      summary: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
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

  if (
    (await tableExists('trace_analyses')) &&
    !(await indexExists('trace_analyses', 'trace_analyses_trace_id_idx'))
  ) {
    await queryInterface.addIndex('trace_analyses', ['trace_id'], {
      name: 'trace_analyses_trace_id_idx',
    });
  }
  if (
    (await tableExists('trace_analyses')) &&
    !(await indexExists('trace_analyses', 'trace_analyses_status_idx'))
  ) {
    await queryInterface.addIndex('trace_analyses', ['status'], {
      name: 'trace_analyses_status_idx',
    });
  }
  if (
    (await tableExists('trace_analyses')) &&
    !(await indexExists('trace_analyses', 'trace_analyses_created_at_idx'))
  ) {
    await queryInterface.addIndex('trace_analyses', ['created_at'], {
      name: 'trace_analyses_created_at_idx',
    });
  }

  if (
    (await tableExists('trace_analyses')) &&
    !(await tableExists('trace_analysis_findings'))
  ) {
    await queryInterface.createTable('trace_analysis_findings', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      analysis_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'trace_analyses',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      step_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      dimension: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      severity: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      confidence: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: true,
      },
      evidence: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      recommendation: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });
  }

  if (
    (await tableExists('trace_analysis_findings')) &&
    !(await indexExists('trace_analysis_findings', 'trace_analysis_findings_analysis_id_idx'))
  ) {
    await queryInterface.addIndex('trace_analysis_findings', ['analysis_id'], {
      name: 'trace_analysis_findings_analysis_id_idx',
    });
  }
  if (
    (await tableExists('trace_analysis_findings')) &&
    !(await indexExists('trace_analysis_findings', 'trace_analysis_findings_analysis_step_idx'))
  ) {
    await queryInterface.addIndex('trace_analysis_findings', ['analysis_id', 'step_id'], {
      name: 'trace_analysis_findings_analysis_step_idx',
    });
  }
  if (
    (await tableExists('trace_analysis_findings')) &&
    !(await indexExists('trace_analysis_findings', 'trace_analysis_findings_severity_idx'))
  ) {
    await queryInterface.addIndex('trace_analysis_findings', ['severity'], {
      name: 'trace_analysis_findings_severity_idx',
    });
  }
  if (
    (await tableExists('trace_analysis_findings')) &&
    !(await indexExists('trace_analysis_findings', 'trace_analysis_findings_dimension_idx'))
  ) {
    await queryInterface.addIndex('trace_analysis_findings', ['dimension'], {
      name: 'trace_analysis_findings_dimension_idx',
    });
  }

  if (
    (await tableExists('trace_analyses')) &&
    !(await tableExists('analysis_experiments'))
  ) {
    await queryInterface.createTable('analysis_experiments', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      analysis_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'trace_analyses',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      hypothesis: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      variant_config: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      run_stats: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
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

  if (
    (await tableExists('analysis_experiments')) &&
    !(await indexExists('analysis_experiments', 'analysis_experiments_analysis_id_idx'))
  ) {
    await queryInterface.addIndex('analysis_experiments', ['analysis_id'], {
      name: 'analysis_experiments_analysis_id_idx',
    });
  }
  if (
    (await tableExists('analysis_experiments')) &&
    !(await indexExists('analysis_experiments', 'analysis_experiments_created_at_idx'))
  ) {
    await queryInterface.addIndex('analysis_experiments', ['created_at'], {
      name: 'analysis_experiments_created_at_idx',
    });
  }
}

export async function down(): Promise<void> {
  // Intentionally no-op: this migration is a production safety bootstrap.
}
