import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';
import type { Environment as EnvironmentType, EnvironmentType as EnvType } from '../types';

interface EnvironmentCreationAttributes extends Optional<EnvironmentType, 'id' | 'createdAt' | 'updatedAt'> {}

export class Environment extends Model<EnvironmentType, EnvironmentCreationAttributes> implements EnvironmentType {
  declare id: string;
  declare projectId: string;
  declare name: EnvType;
  declare description?: string;
  declare metadata?: Record<string, any>;
  declare isActive: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Environment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
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
    name: {
      type: DataTypes.ENUM('PRODUCTION', 'STAGING', 'DEVELOPMENT'),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
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
    tableName: 'environments',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['project_id', 'name'],
      },
    ],
  }
);
