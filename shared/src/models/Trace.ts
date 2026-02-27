import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export interface TraceAttributes {
  id: string; // traceId
  userId: string;
  providerId?: string;
  entityId?: string;
  sampledIn?: boolean;
  model?: string;
  systemMessage?: string;
  tools?: any; // JSON array of tool definitions
  metadata?: Record<string, any>; // generic metadata
  createdAt?: Date;
  updatedAt?: Date;
}

export class Trace extends Model<TraceAttributes> implements TraceAttributes {
  declare id: string;
  declare userId: string;
  declare providerId?: string;
  declare entityId?: string;
  declare sampledIn?: boolean;
  declare model?: string;
  declare systemMessage?: string;
  declare tools?: any;
  declare metadata?: Record<string, any>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Trace.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'user_id',
    },
    providerId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'provider_id',
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'entities',
        key: 'id',
      },
      field: 'entity_id',
    },
    sampledIn: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
      field: 'sampled_in',
    },
    model: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    systemMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'system_message',
    },
    tools: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    tableName: 'traces',
    timestamps: true,
    underscored: true,
  }
);

export default Trace;
