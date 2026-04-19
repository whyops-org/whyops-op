import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { ProjectController } from '../controllers';

const app = new Hono();

// Project schema
const projectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// GET /api/projects - List all projects for user
app.get('/', ProjectController.listProjects);

// GET /api/projects/:id - Get single project
app.get('/:id', ProjectController.getProject);

// POST /api/projects - Create new project with environments and master keys
app.post('/', zValidator('json', projectSchema), ProjectController.createProject);

// PATCH /api/projects/:id - Update project
app.patch('/:id', zValidator('json', projectSchema.partial()), ProjectController.updateProject);

// DELETE /api/projects/:id - Delete project (soft delete by setting isActive to false)
app.delete('/:id', ProjectController.deleteProject);

// GET /api/projects/:projectId/environments - List all environments for a project
app.get('/:projectId/environments', ProjectController.getEnvironments);

export default app;
