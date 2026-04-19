import { Hono } from 'hono';
import { sequelize } from '@whyops/shared/database';
import { ResponseUtil } from '../utils';

const app = new Hono();

/**
 * Development-only route to reset all tables
 * WARNING: This will delete ALL data from the database!
 * Only available in development mode.
 */
app.post('/reset', async (c) => {
  const env = process.env.NODE_ENV || 'development';

  // Only allow in development
  if (env !== 'development') {
    return ResponseUtil.forbidden(c, 'This endpoint is only available in development mode');
  }

  try {
    // Force sync will drop all tables and recreate them
    await sequelize.sync({ force: true });
    return ResponseUtil.success(c, { message: 'All tables have been reset' });
  } catch (error: any) {
    return ResponseUtil.internalError(c, `Failed to reset database: ${error.message}`);
  }
});

export default app;
