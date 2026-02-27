import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';

export interface TraceAnalysisFindingAttributes {
  id: string;
  analysisId: string;
  stepId?: number;
  dimension: string;
  severity: string;
  confidence?: number;
  evidence?: Record<string, any>;
  recommendation?: Record<string, any>;
  createdAt: Date;
}

interface TraceAnalysisFindingCreationAttributes
  extends Optional<
    TraceAnalysisFindingAttributes,
    'id' | 'stepId' | 'confidence' | 'evidence' | 'recommendation' | 'createdAt'
  > {}

export class TraceAnalysisFinding
  extends Model<TraceAnalysisFindingAttributes, TraceAnalysisFindingCreationAttributes>
  implements TraceAnalysisFindingAttributes
{
  declare id: string;
  declare analysisId: string;
  declare stepId?: number;
  declare dimension: string;
  declare severity: string;
  declare confidence?: number;
  declare evidence?: Record<string, any>;
  declare recommendation?: Record<string, any>;
  declare createdAt: Date;
}

TraceAnalysisFinding.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    analysisId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'analysis_id',
      references: {
        model: 'trace_analyses',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    stepId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'step_id',
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
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },
  },
  {
    sequelize,
    tableName: 'trace_analysis_findings',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['analysis_id'] },
      { fields: ['analysis_id', 'step_id'] },
      { fields: ['severity'] },
      { fields: ['dimension'] },
    ],
  }
);

export default TraceAnalysisFinding;
