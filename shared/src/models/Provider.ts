import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';
import type { ProviderConfig as ProviderConfigType } from '../types';

interface ProviderCreationAttributes extends Optional<ProviderConfigType, 'id' | 'createdAt' | 'updatedAt'> {}

export class Provider extends Model<ProviderConfigType, ProviderCreationAttributes> implements ProviderConfigType {
  declare id: string;
  declare userId: string;
  declare name: string;
  declare type: 'openai' | 'anthropic';
  declare baseUrl: string;
  declare apiKey: string;
  declare metadata?: Record<string, any>;
  declare isActive: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Provider.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('openai', 'anthropic'),
      allowNull: false,
    },
    baseUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    apiKey: {
      type: DataTypes.TEXT,
      allowNull: false,
      // Note: Should be encrypted at application level before storing
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
    tableName: 'providers',
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['type'],
      },
    ],
  }
);

export default Provider;
