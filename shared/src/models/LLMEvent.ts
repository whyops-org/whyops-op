import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';
import type { LLMCallEvent as LLMCallEventType } from '../types';

interface EventCreationAttributes extends Optional<LLMCallEventType, 'id' | 'createdAt'> {}

export class LLMEvent extends Model<LLMCallEventType, EventCreationAttributes> implements LLMCallEventType {
  declare id: string;
  declare eventType: 'llm_call';
  declare threadId: string;
  declare stepId: number;
  declare parentStepId?: number;
  declare spanId?: string;
  declare timestamp: Date;
  declare metadata?: Record<string, any>;
  declare userId: string;
  declare providerId: string;
  declare provider: 'openai' | 'anthropic';
  declare model: string;
  declare systemPrompt?: string;
  declare messages: any[];
  declare tools?: any[];
  declare temperature?: number;
  declare maxTokens?: number;
  declare response?: {
    content?: string;
    toolCalls?: any[];
    finishReason?: string;
  };
  declare usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  declare latencyMs?: number;
  declare error?: string;
  declare createdAt: Date;
}

LLMEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    eventType: {
      type: DataTypes.STRING,
      defaultValue: 'llm_call',
      allowNull: false,
    },
    threadId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    stepId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    parentStepId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    spanId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    providerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'providers',
        key: 'id',
      },
    },
    provider: {
      type: DataTypes.ENUM('openai', 'anthropic'),
      allowNull: false,
    },
    model: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    systemPrompt: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    messages: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    tools: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    temperature: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    maxTokens: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    response: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    usage: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    latencyMs: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'llm_events',
    timestamps: true,
    updatedAt: false,
    indexes: [
      {
        fields: ['thread_id'],
      },
      {
        fields: ['user_id'],
      },
      {
        fields: ['provider_id'],
      },
      {
        fields: ['timestamp'],
      },
      {
        fields: ['thread_id', 'step_id'],
      },
    ],
  }
);

export default LLMEvent;
