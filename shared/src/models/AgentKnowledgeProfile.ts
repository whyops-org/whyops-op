import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';

export interface AgentKnowledgeProfileAttributes {
  id: string;
  agentId: string;
  userId: string;
  projectId: string;
  environmentId: string;
  domain?: string;
  profile: Record<string, any>;
  sources: any[];
  version: number;
  lastBuiltAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface AgentKnowledgeProfileCreationAttributes
  extends Optional<
    AgentKnowledgeProfileAttributes,
    'id' | 'domain' | 'profile' | 'sources' | 'version' | 'lastBuiltAt' | 'createdAt' | 'updatedAt'
  > {}

export class AgentKnowledgeProfile
  extends Model<AgentKnowledgeProfileAttributes, AgentKnowledgeProfileCreationAttributes>
  implements AgentKnowledgeProfileAttributes
{
  declare id: string;
  declare agentId: string;
  declare userId: string;
  declare projectId: string;
  declare environmentId: string;
  declare domain?: string;
  declare profile: Record<string, any>;
  declare sources: any[];
  declare version: number;
  declare lastBuiltAt?: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
}

AgentKnowledgeProfile.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    agentId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'agent_id',
      references: { model: 'agents', key: 'id' },
      onDelete: 'CASCADE',
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'user_id',
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'project_id',
      references: { model: 'projects', key: 'id' },
      onDelete: 'CASCADE',
    },
    environmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'environment_id',
      references: { model: 'environments', key: 'id' },
      onDelete: 'CASCADE',
    },
    domain: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    profile: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    sources: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    lastBuiltAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_built_at',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'agent_knowledge_profiles',
    indexes: [
      { unique: true, fields: ['agent_id'] },
      { fields: ['user_id', 'project_id', 'environment_id'] },
    ],
  }
);

export default AgentKnowledgeProfile;
