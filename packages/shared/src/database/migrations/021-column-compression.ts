import { QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE trace_events ALTER COLUMN content SET COMPRESSION lz4;
    ALTER TABLE trace_events ALTER COLUMN metadata SET COMPRESSION lz4;
    ALTER TABLE traces ALTER COLUMN system_message SET COMPRESSION lz4;
    ALTER TABLE traces ALTER COLUMN tools SET COMPRESSION lz4;
  `);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE trace_events ALTER COLUMN content SET COMPRESSION pglz;
    ALTER TABLE trace_events ALTER COLUMN metadata SET COMPRESSION pglz;
    ALTER TABLE traces ALTER COLUMN system_message SET COMPRESSION pglz;
    ALTER TABLE traces ALTER COLUMN tools SET COMPRESSION pglz;
  `);
}
