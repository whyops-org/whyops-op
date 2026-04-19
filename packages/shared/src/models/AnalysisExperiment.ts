import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';

export interface AnalysisExperimentAttributes {
  id: string;
  analysisId: string;
  hypothesis: string;
  variantConfig?: Record<string, any>;
  runStats?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

interface AnalysisExperimentCreationAttributes
  extends Optional<AnalysisExperimentAttributes, 'id' | 'variantConfig' | 'runStats' | 'createdAt' | 'updatedAt'> {}

export class AnalysisExperiment
  extends Model<AnalysisExperimentAttributes, AnalysisExperimentCreationAttributes>
  implements AnalysisExperimentAttributes
{
  declare id: string;
  declare analysisId: string;
  declare hypothesis: string;
  declare variantConfig?: Record<string, any>;
  declare runStats?: Record<string, any>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

AnalysisExperiment.init(
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
    hypothesis: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    variantConfig: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'variant_config',
      defaultValue: {},
    },
    runStats: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'run_stats',
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
    tableName: 'analysis_experiments',
    indexes: [{ fields: ['analysis_id'] }, { fields: ['created_at'] }],
  }
);

export default AnalysisExperiment;
