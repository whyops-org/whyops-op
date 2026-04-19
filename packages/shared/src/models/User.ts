import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';
import type { User as UserType } from '../types';

interface UserCreationAttributes extends Optional<UserType, 'id' | 'createdAt' | 'updatedAt'> {}

export class User extends Model<UserType, UserCreationAttributes> implements UserType {
  declare id: string;
  declare email: string;
  declare passwordHash: string;
  declare name?: string;
  declare organizationId?: string;
  declare isActive: boolean;
  declare metadata?: Record<string, any>;
  declare createdAt: Date;
  declare updatedAt: Date;
}

User.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    organizationId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
    tableName: 'users',
    indexes: [
      {
        unique: true,
        fields: ['email'],
      },
    ],
  }
);

export default User;
