import { Hono } from 'hono';
import { UserController } from '../controllers';

const app = new Hono();

// GET /api/auth/me - Get current user (Better Auth session)
app.get('/me', UserController.getCurrentUser);

export default app;
