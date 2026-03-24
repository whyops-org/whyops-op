import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';

export interface LlmCostAttributes {
  id: string;
  model: string;
  inputTokenPricePerMillionToken: number;
  outputTokenPricePerMillionToken: number;
  cachedTokenPricePerMillionToken: number;
  contextWindow?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface LlmCostCreationAttributes extends Optional<LlmCostAttributes, 'id' | 'createdAt' | 'updatedAt' | 'contextWindow'> {}

export class LlmCost extends Model<LlmCostAttributes, LlmCostCreationAttributes> implements LlmCostAttributes {
  declare id: string;
  declare model: string;
  declare inputTokenPricePerMillionToken: number;
  declare outputTokenPricePerMillionToken: number;
  declare cachedTokenPricePerMillionToken: number;
  declare contextWindow: number | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

LlmCost.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    model: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // Assuming model key is unique
    },
    inputTokenPricePerMillionToken: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'input_token_price_per_million_token',
    },
    outputTokenPricePerMillionToken: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'output_token_price_per_million_token',
    },
    cachedTokenPricePerMillionToken: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'cached_token_price_per_million_token',
    },
    contextWindow: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'context_window',
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
    tableName: 'llm_costs',
    timestamps: true,
    indexes: [
      {
        fields: ['model'],
      },
      {
        fields: ['created_at'],
      },
    ],
  }
);

export default LlmCost;
