import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';

export interface TraceAnalysisAttributes {
  id: string;
  traceId: string;
  status: string;
  rubricVersion?: string;
  judgeModel?: string;
  mode: string;
  startedAt?: Date;
  finishedAt?: Date;
  summary?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

interface TraceAnalysisCreationAttributes
  extends Optional<
    TraceAnalysisAttributes,
    'id' | 'status' | 'mode' | 'rubricVersion' | 'judgeModel' | 'startedAt' | 'finishedAt' | 'summary' | 'createdAt' | 'updatedAt'
  > {}

export class TraceAnalysis
  extends Model<TraceAnalysisAttributes, TraceAnalysisCreationAttributes>
  implements TraceAnalysisAttributes
{
  declare id: string;
  declare traceId: string;
  declare status: string;
  declare rubricVersion?: string;
  declare judgeModel?: string;
  declare mode: string;
  declare startedAt?: Date;
  declare finishedAt?: Date;
  declare summary?: Record<string, any>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

TraceAnalysis.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    traceId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'trace_id',
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
    rubricVersion: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'rubric_version',
    },
    judgeModel: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'judge_model',
    },
    mode: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'standard',
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
    summary: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    tableName: 'trace_analyses',
    indexes: [
      { fields: ['trace_id'] },
      { fields: ['status'] },
      { fields: ['created_at'] },
    ],
  }
);

export default TraceAnalysis;
