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

  const hasTraces = await tableExists('traces');

  if (hasTraces && !(await columnExists('traces', 'sampled_in'))) {
    await queryInterface.addColumn('traces', 'sampled_in', {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
    });
  }

  if (hasTraces && !(await indexExists('traces', 'traces_sampled_in_idx'))) {
    await queryInterface.addIndex('traces', ['sampled_in'], {
      name: 'traces_sampled_in_idx',
    });
  }

  if (hasTraces && !(await tableExists('trace_analyses'))) {
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

  const hasTraceAnalyses = await tableExists('trace_analyses');

  if (hasTraceAnalyses && !(await indexExists('trace_analyses', 'trace_analyses_trace_id_idx'))) {
    await queryInterface.addIndex('trace_analyses', ['trace_id'], {
      name: 'trace_analyses_trace_id_idx',
    });
  }

  if (hasTraceAnalyses && !(await indexExists('trace_analyses', 'trace_analyses_status_idx'))) {
    await queryInterface.addIndex('trace_analyses', ['status'], {
      name: 'trace_analyses_status_idx',
    });
  }

  if (hasTraceAnalyses && !(await tableExists('trace_analysis_findings'))) {
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

  const hasTraceAnalysisFindings = await tableExists('trace_analysis_findings');

  if (
    hasTraceAnalysisFindings &&
    !(await indexExists('trace_analysis_findings', 'trace_analysis_findings_analysis_id_idx'))
  ) {
    await queryInterface.addIndex('trace_analysis_findings', ['analysis_id'], {
      name: 'trace_analysis_findings_analysis_id_idx',
    });
  }

  if (
    hasTraceAnalysisFindings &&
    !(await indexExists('trace_analysis_findings', 'trace_analysis_findings_analysis_step_idx'))
  ) {
    await queryInterface.addIndex('trace_analysis_findings', ['analysis_id', 'step_id'], {
      name: 'trace_analysis_findings_analysis_step_idx',
    });
  }

  if (hasTraceAnalyses && !(await tableExists('analysis_experiments'))) {
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
}

export async function down(queryInterface: QueryInterface): Promise<void> {
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

  if (await tableExists('analysis_experiments')) {
    await queryInterface.dropTable('analysis_experiments');
  }

  if (await tableExists('trace_analysis_findings')) {
    await queryInterface.dropTable('trace_analysis_findings');
  }

  if (await tableExists('trace_analyses')) {
    await queryInterface.dropTable('trace_analyses');
  }

  if ((await tableExists('traces')) && (await columnExists('traces', 'sampled_in'))) {
    await queryInterface.removeColumn('traces', 'sampled_in');
  }
}
