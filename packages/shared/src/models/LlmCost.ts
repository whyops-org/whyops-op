import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';

export interface LlmCostAttributes {
  id: string;
  model: string;
  inputTokenPricePerMillionToken: number;
  outputTokenPricePerMillionToken: number;
  /** Price per million tokens read from cache (cache hit). Typically 0.1× input price. */
  cacheReadTokenPricePerMillionToken: number;
  /** Price per million tokens written to the 5-minute cache. Typically 1.25× input price. Null = not applicable (e.g. OpenAI). */
  cacheWrite5mTokenPricePerMillionToken: number | null;
  /** Price per million tokens written to the 1-hour cache. Typically 2× input price. Null = not applicable. */
  cacheWrite1hTokenPricePerMillionToken: number | null;
  contextWindow?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface LlmCostCreationAttributes extends Optional<
  LlmCostAttributes,
  'id' | 'createdAt' | 'updatedAt' | 'contextWindow' | 'cacheWrite5mTokenPricePerMillionToken' | 'cacheWrite1hTokenPricePerMillionToken'
> {}

export class LlmCost extends Model<LlmCostAttributes, LlmCostCreationAttributes> implements LlmCostAttributes {
  declare id: string;
  declare model: string;
  declare inputTokenPricePerMillionToken: number;
  declare outputTokenPricePerMillionToken: number;
  declare cacheReadTokenPricePerMillionToken: number;
  declare cacheWrite5mTokenPricePerMillionToken: number | null;
  declare cacheWrite1hTokenPricePerMillionToken: number | null;
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
      unique: true,
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
    cacheReadTokenPricePerMillionToken: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
      field: 'cache_read_token_price_per_million_token',
    },
    cacheWrite5mTokenPricePerMillionToken: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'cache_write_5m_token_price_per_million_token',
    },
    cacheWrite1hTokenPricePerMillionToken: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'cache_write_1h_token_price_per_million_token',
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
