import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export interface EntityAttributes {
  id?: string; // UUID - optional for creation, auto-generated
  userId: string;
  name: string; // Agent Name
  hash: string; // Hash of metadata (tools, system prompt, etc.)
  metadata: Record<string, any>; // system prompt, tools, etc.
  samplingRate: number; // Sampling rate (0-1), controls trace storage probability
  createdAt?: Date;
  updatedAt?: Date;
}

export class Entity extends Model<EntityAttributes> implements EntityAttributes {
  declare id: string;
  declare userId: string;
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
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
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
      defaultValue: 1.0,
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
        fields: ['user_id', 'name', 'hash'], // Composite unique constraint might be needed or just handled in logic
      },
      {
         fields: ['user_id', 'name']
      }
    ]
  }
);

export default Entity;
