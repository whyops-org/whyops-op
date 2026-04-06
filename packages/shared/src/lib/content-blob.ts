import { createHash } from 'crypto';
import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../database';

// ---------------------------------------------------------------------------
// Sequelize model
// ---------------------------------------------------------------------------

interface ContentBlobAttributes {
  hash: string;
  content: string;
  byteSize: number;
  createdAt?: Date;
}

interface ContentBlobCreationAttributes extends Optional<ContentBlobAttributes, 'createdAt'> {}

export class ContentBlob extends Model<ContentBlobAttributes, ContentBlobCreationAttributes> implements ContentBlobAttributes {
  declare hash: string;
  declare content: string;
  declare byteSize: number;
  declare createdAt: Date;
}

ContentBlob.init(
  {
    hash: {
      type: DataTypes.STRING(64),
      primaryKey: true,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    byteSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'byte_size',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },
  },
  {
    sequelize,
    tableName: 'content_blobs',
    timestamps: true,
    updatedAt: false,
    createdAt: 'createdAt',
  }
);

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Upsert a content blob and return its SHA-256 hash.
 * Uses findOrCreate so concurrent calls with the same content are safe.
 */
export async function upsertBlob(content: string): Promise<string> {
  const hash = createHash('sha256').update(content, 'utf8').digest('hex');
  const byteSize = Buffer.byteLength(content, 'utf8');
  await ContentBlob.findOrCreate({
    where: { hash },
    defaults: { hash, content, byteSize },
  });
  return hash;
}

/**
 * Retrieve content by hash. Returns null if not found.
 */
export async function getBlobContent(hash: string): Promise<string | null> {
  const blob = await ContentBlob.findByPk(hash, { attributes: ['content'] });
  return blob?.content ?? null;
}

export default ContentBlob;
