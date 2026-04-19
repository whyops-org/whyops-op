import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';
import type { RequestLog as RequestLogType } from '../types';

interface RequestLogCreationAttributes extends Optional<RequestLogType, 'id' | 'createdAt'> {}

export class RequestLog extends Model<RequestLogType, RequestLogCreationAttributes> implements RequestLogType {
  declare id: string;
  declare method: string;
  declare path: string;
  declare statusCode: number;
  declare latencyMs: number;
  declare userId?: string;
  declare apiKeyId?: string;
  declare providerId?: string;
  declare userAgent?: string;
  declare ipAddress?: string;
  declare requestBody?: any;
  declare responseBody?: any;
  declare error?: string;
  declare metadata?: Record<string, any>;
  declare timestamp: Date;
  declare createdAt: Date;
}

RequestLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    method: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    path: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    statusCode: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    latencyMs: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    apiKeyId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    providerId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    requestBody: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    responseBody: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'request_logs',
    timestamps: true,
    updatedAt: false,
    indexes: [
      {
        fields: ['timestamp'],
      },
      {
        fields: ['user_id'],
      },
      {
        fields: ['api_key_id'],
      },
      {
        fields: ['status_code'],
      },
    ],
  }
);

export default RequestLog;
