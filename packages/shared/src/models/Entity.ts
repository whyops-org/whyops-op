import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export interface EntityAttributes {
  id?: string; // UUID - optional for creation, auto-generated
  agentId?: string;
  userId: string;
  projectId: string;
  environmentId: string;
  name: string; // Agent Name
  hash: string; // Hash of metadata (tools, system prompt, etc.)
  metadata: Record<string, any>; // system prompt, tools, etc.
  samplingRate: number; // Sampling rate (0-1), controls trace storage probability
  createdAt?: Date;
  updatedAt?: Date;
}

export class Entity extends Model<EntityAttributes> implements EntityAttributes {
  declare id: string;
  declare agentId?: string;
  declare userId: string;
  declare projectId: string;
  declare environmentId: string;
  declare name: string;
  declare hash: string;
  declare metadata: Record<string, any>;
  declare samplingRate: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Entity.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agentId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'agent_id',
      references: {
        model: 'agents',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'project_id',
      references: {
        model: 'projects',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    environmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'environment_id',
      references: {
        model: 'environments',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    samplingRate: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0.2,
      field: 'sampling_rate',
      validate: {
        min: 0,
        max: 1,
      },
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
    tableName: 'entities',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['environment_id', 'name', 'hash'],
      },
      {
        fields: ['agent_id'],
      },
      {
         fields: ['user_id', 'project_id']
      },
      {
         fields: ['environment_id']
      }
    ]
  }
);

export default Entity;
