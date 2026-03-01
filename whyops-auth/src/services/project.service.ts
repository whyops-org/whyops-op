import { createServiceLogger } from '@whyops/shared/logger';
import { ApiKey, Environment, Project } from '@whyops/shared/models';
import { encrypt, generateApiKey, hashApiKey } from '@whyops/shared/utils';

const logger = createServiceLogger('auth:project-service');

function isMissingEncryptedColumnError(error: any): boolean {
  const code = error?.original?.code || error?.parent?.code;
  const sql = String(error?.sql || error?.parent?.sql || '');
  return code === '42703' && sql.includes('"key_encrypted"');
}

export interface CreateProjectData {
  userId: string;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface ProjectWithEnvironments {
  project: Project;
  environments: Environment[];
  masterKeys: Array<{
    environmentId: string;
    environmentName: string;
    apiKey: string;
    keyPrefix: string;
    keyId: string;
  }>;
}

export class ProjectService {
  /**
   * List all projects for a user
   */
  static async listProjects(userId: string): Promise<Project[]> {
    const projects = await Project.findAll({
      where: { userId },
      include: [
        {
          model: Environment,
          as: 'environments',
          attributes: ['id', 'name', 'description', 'isActive', 'createdAt'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return projects;
  }

  /**
   * Get project by ID with environments
   */
  static async getProjectById(projectId: string, userId: string): Promise<Project | null> {
    const project = await Project.findOne({
      where: { id: projectId, userId },
      include: [
        {
          model: Environment,
          as: 'environments',
          attributes: ['id', 'name', 'description', 'isActive', 'createdAt', 'updatedAt'],
          include: [
            {
              model: ApiKey,
              as: 'apiKeys',
              where: { isMaster: true },
              required: false,
              attributes: ['id', 'name', 'keyPrefix', 'isMaster', 'isActive', 'createdAt'],
            },
          ],
        },
      ],
    });

    return project;
  }

  /**
   * Create a new project with environments and master keys
   */
  static async createProject(data: CreateProjectData): Promise<ProjectWithEnvironments> {
    // Check for duplicate project name for this user
    const existing = await Project.findOne({
      where: { userId: data.userId, name: data.name },
    });

    if (existing) {
      throw new Error('A project with this name already exists');
    }

    // Create project
    const project = await Project.create({
      userId: data.userId,
      name: data.name,
      description: data.description,
      metadata: data.metadata,
      isActive: true,
    });

    logger.info({ projectId: project.id, userId: data.userId }, 'Project created');

    // Create 3 default environments
    const environmentTypes: ('PRODUCTION' | 'STAGING' | 'DEVELOPMENT')[] = [
      'PRODUCTION',
      'STAGING',
      'DEVELOPMENT',
    ];

    const environments = await Promise.all(
      environmentTypes.map((envType) =>
        Environment.create({
          projectId: project.id,
          name: envType,
          description: `${envType} environment for ${data.name}`,
          isActive: true,
        })
      )
    );

    logger.info(
      { projectId: project.id, environmentCount: environments.length },
      'Environments created'
    );

    // Generate master keys for each environment
    const masterKeys = await Promise.all(
      environments.map(async (env) => {
        const apiKey = generateApiKey('YOPS-');
        const keyHash = hashApiKey(apiKey);
        const keyPrefix = apiKey.substring(0, 12);

        let masterKey: ApiKey;
        try {
          masterKey = await ApiKey.create({
            userId: data.userId,
            projectId: project.id,
            environmentId: env.id,
            name: `${env.name} Master Key`,
            keyHash,
            keyEncrypted: encrypt(apiKey),
            keyPrefix,
            isMaster: true,
            isActive: true,
          });
        } catch (error: any) {
          if (!isMissingEncryptedColumnError(error)) {
            throw error;
          }

          // Backward compatibility for DBs where key_encrypted migration is not applied yet.
          masterKey = await ApiKey.create({
            userId: data.userId,
            projectId: project.id,
            environmentId: env.id,
            name: `${env.name} Master Key`,
            keyHash,
            keyPrefix,
            isMaster: true,
            isActive: true,
          });
        }

        logger.info(
          { apiKeyId: masterKey.id, environmentId: env.id, projectId: project.id },
          'Master API key created'
        );

        return {
          environmentId: env.id,
          environmentName: env.name,
          apiKey,
          keyPrefix,
          keyId: masterKey.id,
        };
      })
    );

    return {
      project,
      environments,
      masterKeys,
    };
  }

  /**
   * Update project
   */
  static async updateProject(
    projectId: string,
    userId: string,
    data: UpdateProjectData
  ): Promise<Project> {
    const project = await Project.findOne({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    await project.update(data);

    logger.info({ projectId: project.id, userId }, 'Project updated');

    return project;
  }

  /**
   * Deactivate project
   */
  static async deactivateProject(projectId: string, userId: string): Promise<void> {
    const project = await Project.findOne({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    await project.update({ isActive: false });

    logger.info({ projectId: project.id, userId }, 'Project deactivated');
  }

  /**
   * Get environments for a project
   */
  static async getEnvironments(projectId: string, userId: string): Promise<Environment[]> {
    // Verify project belongs to user
    const project = await Project.findOne({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const environments = await Environment.findAll({
      where: { projectId },
      include: [
        {
          model: ApiKey,
          as: 'apiKeys',
          attributes: ['id', 'name', 'keyPrefix', 'isMaster', 'isActive', 'createdAt'],
        },
      ],
    });

    return environments;
  }
}
