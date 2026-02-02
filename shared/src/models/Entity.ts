import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export interface EntityAttributes {
  id: string; // UUID
  userId: string;
  name: string; // Agent Name
  hash: string; // Hash of metadata (tools, system prompt, etc.)
  metadata: Record<string, any>; // system prompt, tools, etc.
  createdAt?: Date;
  updatedAt?: Date;
}

export class Entity extends Model<EntityAttributes> implements EntityAttributes {
  declare id: string;
  declare userId: string;
  declare name: string;
  declare hash: string;
  declare metadata: Record<string, any>;
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
