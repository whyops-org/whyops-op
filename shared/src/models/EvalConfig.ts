import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';

export interface EvalConfigAttributes {
  id: string;
  agentId: string;
  userId: string;
  projectId: string;
  environmentId: string;
  enabled: boolean;
  cronExpr: string;
  timezone: string;
  categories: string[];
  maxEvalsPerRun: number;
  customPrompt?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface EvalConfigCreationAttributes
  extends Optional<
    EvalConfigAttributes,
    'id' | 'enabled' | 'cronExpr' | 'timezone' | 'categories' | 'maxEvalsPerRun' | 'customPrompt' | 'createdAt' | 'updatedAt'
  > {}

export class EvalConfig
  extends Model<EvalConfigAttributes, EvalConfigCreationAttributes>
  implements EvalConfigAttributes
{
  declare id: string;
  declare agentId: string;
  declare userId: string;
  declare projectId: string;
  declare environmentId: string;
  declare enabled: boolean;
  declare cronExpr: string;
  declare timezone: string;
  declare categories: string[];
  declare maxEvalsPerRun: number;
  declare customPrompt?: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

EvalConfig.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agentId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'agent_id',
      references: { model: 'agents', key: 'id' },
      onDelete: 'CASCADE',
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'user_id',
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'project_id',
      references: { model: 'projects', key: 'id' },
      onDelete: 'CASCADE',
    },
    environmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'environment_id',
      references: { model: 'environments', key: 'id' },
      onDelete: 'CASCADE',
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    cronExpr: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '0 2 * * 1',
      field: 'cron_expr',
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
    maxEvalsPerRun: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 50,
      field: 'max_evals_per_run',
      validate: { min: 1, max: 200 },
    },
    customPrompt: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'custom_prompt',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'eval_configs',
    indexes: [
      { unique: true, fields: ['agent_id'] },
      { fields: ['enabled'] },
      { fields: ['user_id', 'project_id', 'environment_id'] },
    ],
  }
);

export default EvalConfig;
