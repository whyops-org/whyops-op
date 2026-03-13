import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';

export type EvalRunStatus = 'pending' | 'running' | 'completed' | 'failed';
export type EvalRunTrigger = 'manual' | 'scheduled' | 'entity_change';

export interface EvalRunAttributes {
  id: string;
  configId?: string;
  agentId: string;
  userId: string;
  projectId: string;
  environmentId: string;
  entityId?: string;
  status: EvalRunStatus;
  trigger: EvalRunTrigger;
  customPrompt?: string;
  evalCount: number;
  summary?: Record<string, any>;
  error?: string;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface EvalRunCreationAttributes
  extends Optional<
    EvalRunAttributes,
    | 'id'
    | 'configId'
    | 'entityId'
    | 'status'
    | 'trigger'
    | 'customPrompt'
    | 'evalCount'
    | 'summary'
    | 'error'
    | 'startedAt'
    | 'finishedAt'
    | 'createdAt'
    | 'updatedAt'
  > {}

export class EvalRun
  extends Model<EvalRunAttributes, EvalRunCreationAttributes>
  implements EvalRunAttributes
{
  declare id: string;
  declare configId?: string;
  declare agentId: string;
  declare userId: string;
  declare projectId: string;
  declare environmentId: string;
  declare entityId?: string;
  declare status: EvalRunStatus;
  declare trigger: EvalRunTrigger;
  declare customPrompt?: string;
  declare evalCount: number;
  declare summary?: Record<string, any>;
  declare error?: string;
  declare startedAt?: Date;
  declare finishedAt?: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
}

EvalRun.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    configId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'config_id',
      references: { model: 'eval_configs', key: 'id' },
      onDelete: 'SET NULL',
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
    entityId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'entity_id',
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
    customPrompt: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'custom_prompt',
    },
    evalCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'eval_count',
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
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'started_at',
    },
    finishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'finished_at',
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
    tableName: 'eval_runs',
    indexes: [
      { fields: ['agent_id', 'created_at'] },
      { fields: ['status'] },
      { fields: ['config_id'] },
      { fields: ['user_id', 'project_id', 'environment_id'] },
    ],
  }
);

export default EvalRun;
