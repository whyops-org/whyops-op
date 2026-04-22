import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';

export type TraceReplayRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ReplayEvent {
  stepId: number;
  eventType: string;
  content: any;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface ReplayComparison {
  originalStepCount: number;
  replayStepCount: number;
  originalErrorCount: number;
  replayErrorCount: number;
  originalToolCallCount: number;
  replayToolCallCount: number;
  loopResolved: boolean;
  finalAnswerChanged: boolean;
  score: number;
  summary: string;
}

export interface ReplayVariantConfig {
  systemPrompt?: string;
  toolDescriptions?: Record<string, string>;
  /** Full tool definitions to inject when trace.tools is null */
  tools?: any[];
  analysisId?: string;
  patchSummary?: string;
}

export interface TraceReplayRunAttributes {
  id: string;
  traceId: string;
  analysisId?: string;
  userId: string;
  projectId: string;
  environmentId: string;
  status: TraceReplayRunStatus;
  variantConfig: ReplayVariantConfig;
  replayEvents?: ReplayEvent[];
  comparison?: ReplayComparison;
  score?: number;
  error?: string;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface CreationAttrs
  extends Optional<
    TraceReplayRunAttributes,
    | 'id'
    | 'analysisId'
    | 'status'
    | 'replayEvents'
    | 'comparison'
    | 'score'
    | 'error'
    | 'startedAt'
    | 'finishedAt'
    | 'createdAt'
    | 'updatedAt'
  > {}

export class TraceReplayRun
  extends Model<TraceReplayRunAttributes, CreationAttrs>
  implements TraceReplayRunAttributes
{
  declare id: string;
  declare traceId: string;
  declare analysisId?: string;
  declare userId: string;
  declare projectId: string;
  declare environmentId: string;
  declare status: TraceReplayRunStatus;
  declare variantConfig: ReplayVariantConfig;
  declare replayEvents?: ReplayEvent[];
  declare comparison?: ReplayComparison;
  declare score?: number;
  declare error?: string;
  declare startedAt?: Date;
  declare finishedAt?: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
}

TraceReplayRun.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    traceId: { type: DataTypes.STRING, allowNull: false, field: 'trace_id' },
    analysisId: { type: DataTypes.UUID, allowNull: true, field: 'analysis_id' },
    userId: { type: DataTypes.STRING, allowNull: false, field: 'user_id' },
    projectId: { type: DataTypes.UUID, allowNull: false, field: 'project_id' },
    environmentId: { type: DataTypes.UUID, allowNull: false, field: 'environment_id' },
    status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'pending' },
    variantConfig: { type: DataTypes.JSONB, allowNull: false, defaultValue: {}, field: 'variant_config' },
    replayEvents: { type: DataTypes.JSONB, allowNull: true, field: 'replay_events' },
    comparison: { type: DataTypes.JSONB, allowNull: true },
    score: { type: DataTypes.FLOAT, allowNull: true },
    error: { type: DataTypes.TEXT, allowNull: true },
    startedAt: { type: DataTypes.DATE, allowNull: true, field: 'started_at' },
    finishedAt: { type: DataTypes.DATE, allowNull: true, field: 'finished_at' },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
  },
  {
    sequelize,
    tableName: 'trace_replay_runs',
    indexes: [
      { fields: ['trace_id'] },
      { fields: ['user_id'] },
      { fields: ['created_at'] },
    ],
  }
);

export default TraceReplayRun;
