import { createServiceLogger } from '@whyops/shared/logger';
import { Context } from 'hono';
import { CreateProjectData, ProjectService, UpdateProjectData } from '../services';
import { ResponseUtil } from '../utils';

const logger = createServiceLogger('auth:project-controller');

export class ProjectController {
  /**
   * List all projects for user
   */
  static async listProjects(c: Context) {
    try {
      const user = c.get('user');
      const projects = await ProjectService.listProjects(user.id);
      return ResponseUtil.success(c, { projects });
    } catch (error: any) {
      logger.error({ error }, 'Failed to fetch projects');
      return ResponseUtil.internalError(c, 'Failed to fetch projects');
    }
  }

  /**
   * Get a single project
   */
  static async getProject(c: Context) {
    try {
      const user = c.get('user');
      const projectId = c.req.param('id');
      
      const project = await ProjectService.getProjectById(projectId, user.id);

      if (!project) {
        return ResponseUtil.notFound(c, 'Project not found');
      }

      return ResponseUtil.success(c, { project });
    } catch (error: any) {
      logger.error({ error }, 'Failed to fetch project');
      return ResponseUtil.internalError(c, 'Failed to fetch project');
    }
  }

  /**
   * Create a new project with environments and master keys
   */
  static async createProject(c: Context) {
    try {
      const user = c.get('user');
      const data = await c.req.json();
      
      const result = await ProjectService.createProject({
        userId: user.id,
        ...data,
      } as CreateProjectData);

      return ResponseUtil.created(c, {
        project: {
          id: result.project.id,
          name: result.project.name,
          description: result.project.description,
          isActive: result.project.isActive,
          createdAt: result.project.createdAt,
        },
        environments: result.environments.map((env) => ({
          id: env.id,
          name: env.name,
          description: env.description,
          isActive: env.isActive,
          createdAt: env.createdAt,
        })),
        masterKeys: result.masterKeys,
        warning: 'Save these master API keys securely. You will not be able to retrieve them again.',
      });
    } catch (error: any) {
      logger.error({ error }, 'Failed to create project');

      // Return specific error messages
      if (error.message === 'A project with this name already exists') {
        return ResponseUtil.conflict(c, error.message);
      }

      return ResponseUtil.internalError(c, 'Failed to create project');
    }
  }

  /**
   * Update a project
   */
  static async updateProject(c: Context) {
    try {
      const user = c.get('user');
      const projectId = c.req.param('id');
      const data = await c.req.json() as UpdateProjectData;
      
      const project = await ProjectService.updateProject(projectId, user.id, data);

      return ResponseUtil.success(c, { project });
    } catch (error: any) {
      logger.error({ error }, 'Failed to update project');
      
      if (error.message === 'Project not found') {
        return ResponseUtil.notFound(c, error.message);
      }
      
      return ResponseUtil.internalError(c, 'Failed to update project');
    }
  }

  /**
   * Delete (deactivate) a project
   */
  static async deleteProject(c: Context) {
    try {
      const user = c.get('user');
      const projectId = c.req.param('id');
      
      await ProjectService.deactivateProject(projectId, user.id);

      return ResponseUtil.success(c, { message: 'Project deactivated successfully' });
    } catch (error: any) {
      logger.error({ error }, 'Failed to delete project');
      
      if (error.message === 'Project not found') {
        return ResponseUtil.notFound(c, error.message);
      }
      
      return ResponseUtil.internalError(c, 'Failed to delete project');
    }
  }

  /**
   * Get environments for a project
   */
  static async getEnvironments(c: Context) {
    try {
      const user = c.get('user');
      const projectId = c.req.param('projectId');
      
      const environments = await ProjectService.getEnvironments(projectId, user.id);

      return ResponseUtil.success(c, { environments });
    } catch (error: any) {
      logger.error({ error }, 'Failed to fetch environments');
      
      if (error.message === 'Project not found') {
        return ResponseUtil.notFound(c, error.message);
      }
      
      return ResponseUtil.internalError(c, 'Failed to fetch environments');
    }
  }
}
