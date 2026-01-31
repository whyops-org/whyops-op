import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => {
  return c.json({
    status: 'healthy',
    service: 'whyops-proxy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', (c) => {
  // Add database health check if needed
  return c.json({ status: 'ready' });
});

export default app;
