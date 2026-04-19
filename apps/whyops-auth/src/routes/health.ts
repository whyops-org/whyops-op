import { Hono } from 'hono';
import sequelize from '@whyops/shared/database';

const app = new Hono();

app.get('/', async (c) => {
  let dbHealthy = false;
  
  try {
    await sequelize.authenticate();
    dbHealthy = true;
  } catch (error) {
    // Database not healthy
  }

  return c.json({
    status: dbHealthy ? 'healthy' : 'degraded',
    service: 'whyops-auth',
    version: '1.0.0',
    database: dbHealthy ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', async (c) => {
  try {
    await sequelize.authenticate();
    return c.json({ status: 'ready' });
  } catch (error) {
    return c.json({ status: 'not ready', error: 'Database unavailable' }, 503);
  }
});

export default app;
