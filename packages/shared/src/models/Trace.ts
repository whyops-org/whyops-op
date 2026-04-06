import { DataTypes, Model } from 'sequelize';
import sequelize from '../database';

export interface TraceAttributes {
  id: string; // traceId
  userId: string;
  externalUserId?: string;
  providerId?: string;
  entityId?: string;
  sampledIn?: boolean;
  model?: string;
  systemMessage?: string;          // kept for backward compat; prefer systemMessageHash for new rows
  systemMessageHash?: string;      // FK → content_blobs.hash (Phase 3)
  tools?: any;                     // kept for backward compat; prefer toolsHash for new rows
  toolsHash?: string;              // FK → content_blobs.hash (Phase 3)
  metadata?: Record<string, any>;
  eventsPayload?: Buffer | null;   // brotli-compressed JSON array of normalized events (Phase 4)
  eventsPayloadAt?: Date | null;   // when the payload was last built
  createdAt?: Date;
  updatedAt?: Date;
}

export class Trace extends Model<TraceAttributes> implements TraceAttributes {
  declare id: string;
  declare userId: string;
  declare externalUserId?: string;
  declare providerId?: string;
  declare entityId?: string;
  declare sampledIn?: boolean;
  declare model?: string;
  declare systemMessage?: string;
  declare systemMessageHash?: string;
  declare tools?: any;
  declare toolsHash?: string;
  declare metadata?: Record<string, any>;
  declare eventsPayload?: Buffer | null;
  declare eventsPayloadAt?: Date | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Trace.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'user_id',
    },
    externalUserId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'external_user_id',
    },
    providerId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'provider_id',
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'entities',
        key: 'id',
      },
      field: 'entity_id',
    },
    sampledIn: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true,
      field: 'sampled_in',
    },
    model: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    systemMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'system_message',
    },
    systemMessageHash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'system_message_hash',
    },
    tools: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    toolsHash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'tools_hash',
    },
    eventsPayload: {
      type: DataTypes.BLOB,
      allowNull: true,
      field: 'events_payload',
    },
    eventsPayloadAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'events_payload_at',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
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
    tableName: 'traces',
    timestamps: true,
    underscored: true,
  }
);

export default Trace;
