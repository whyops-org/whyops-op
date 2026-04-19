import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';
import type { ApiKey as ApiKeyType } from '../types';

interface ApiKeyCreationAttributes extends Optional<ApiKeyType, 'id' | 'createdAt' | 'updatedAt'> {}

export class ApiKey extends Model<ApiKeyType, ApiKeyCreationAttributes> implements ApiKeyType {
  declare id: string;
  declare userId: string;
  declare projectId: string;
  declare environmentId: string;
  declare providerId?: string;
  declare name: string;
  declare keyHash: string;
  declare keyEncrypted?: string;
  declare keyPrefix: string;
  declare isMaster: boolean;
  declare entityId?: string;
  declare lastUsedAt?: Date;
  declare expiresAt?: Date;
  declare isActive: boolean;
  declare rateLimit?: number;
  declare metadata?: Record<string, any>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

ApiKey.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'projects',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    environmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'environments',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    providerId: {
      type: DataTypes.UUID,
      allowNull: true, // Optional for master keys
      references: {
        model: 'providers',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: true, // Optional: specific entity key
      references: {
        model: 'entities',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    keyHash: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    keyEncrypted: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Encrypted full API key for explicit user reveal action',
    },
    keyPrefix: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    isMaster: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'True if this is an environment master key',
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    rateLimit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Requests per minute',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'api_keys',
    indexes: [
      {
        unique: true,
        fields: ['key_hash'],
      },
      {
        fields: ['user_id'],
      },
      {
        fields: ['project_id'],
      },
      {
        fields: ['environment_id'],
      },
      {
        fields: ['provider_id'],
      },
      {
        fields: ['is_active'],
      },
      {
        fields: ['is_master'],
      },
    ],
  }
);

export default ApiKey;
