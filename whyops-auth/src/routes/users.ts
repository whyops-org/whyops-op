import { Hono } from 'hono';
import { createServiceLogger } from '@whyops/shared/logger';
import { User } from '@whyops/shared/models';

const logger = createServiceLogger('auth:users');
const app = new Hono();

// GET /api/users/me - Get current user profile
app.get('/me', async (c) => {
  const jwtUser = c.get('user');

  try {
    const user = await User.findByPk(jwtUser.userId, {
      attributes: { exclude: ['passwordHash'] },
    });

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json(user);
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch user');
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

// PUT /api/users/me - Update current user profile
app.put('/me', async (c) => {
  const jwtUser = c.get('user');
  const data = await c.req.json();

  try {
    const user = await User.findByPk(jwtUser.userId);

    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Update allowed fields
    if (data.name) user.name = data.name;
    if (data.metadata) user.metadata = data.metadata;

    await user.save();

    logger.info({ userId: user.id }, 'User updated');

    return c.json({
      id: user.id,
      email: user.email,
      name: user.name,
      metadata: user.metadata,
      updatedAt: user.updatedAt,
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to update user');
    return c.json({ error: 'Failed to update user' }, 500);
  }
});

export default app;
