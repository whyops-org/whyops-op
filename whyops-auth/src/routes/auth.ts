import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { createServiceLogger } from '@whyops/shared/logger';
import { User } from '@whyops/shared/models';
import { generateJWT } from '../middleware/jwtAuth';

const logger = createServiceLogger('auth:routes');
const app = new Hono();

// Register schema
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

// Login schema
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// POST /api/auth/register - Register new user
app.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, password, name } = c.req.valid('json');

  try {
    // Check if user exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return c.json({ error: 'User already exists' }, 400);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      email,
      passwordHash,
      name,
      isActive: true,
    });

    logger.info({ userId: user.id, email }, 'User registered');

    // Generate JWT
    const token = generateJWT({
      userId: user.id,
      email: user.email,
    });

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    }, 201);
  } catch (error: any) {
    logger.error({ error }, 'Registration failed');
    return c.json({ error: 'Registration failed' }, 500);
  }
});

// POST /api/auth/login - Login user
app.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  try {
    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Check if active
    if (!user.isActive) {
      return c.json({ error: 'Account is inactive' }, 401);
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    logger.info({ userId: user.id, email }, 'User logged in');

    // Generate JWT
    const token = generateJWT({
      userId: user.id,
      email: user.email,
    });

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    });
  } catch (error: any) {
    logger.error({ error }, 'Login failed');
    return c.json({ error: 'Login failed' }, 500);
  }
});

// GET /api/auth/me - Get current user (requires JWT middleware)
app.get('/me', async (c) => {
  const jwtUser = c.get('user');

  try {
    const user = await User.findByPk(jwtUser.userId);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to fetch user');
    return c.json({ error: 'Failed to fetch user' }, 500);
  }
});

export default app;
