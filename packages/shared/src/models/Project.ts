import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';
import type { Project as ProjectType } from '../types';

interface ProjectCreationAttributes extends Optional<ProjectType, 'id' | 'createdAt' | 'updatedAt'> {}

export class Project extends Model<ProjectType, ProjectCreationAttributes> implements ProjectType {
  declare id: string;
  declare userId: string;
  declare name: string;
  declare description?: string;
  declare metadata?: Record<string, any>;
  declare isActive: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Project.init(
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
    name: {
      type: DataTypes.STRING,
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
    tableName: 'projects',
    timestamps: true,
    underscored: true,
  }
);
