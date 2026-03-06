import env from '@whyops/shared/env';
import { Agent, Entity } from '@whyops/shared/models';

export interface AgentSettingsRecord {
  agentId: string;
  maxTraces: number;
  maxSpans: number;
  samplingRate: number;
  updatedAt: string;
}

export interface AgentGlobalRuntimeLimits {
  maxAgents: number;
}

function normalizeSamplingRate(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function normalizePositiveInteger(value: number): number {
  const normalized = Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.max(1, normalized);
}

function normalizeMaxAgents(value: number): number {
  return normalizePositiveInteger(value);
}

export class AgentSettingsService {
  static getGlobalRuntimeLimits(): AgentGlobalRuntimeLimits {
    return {
      maxAgents: normalizeMaxAgents(Number(env.MAX_AGENTS_PER_ACCOUNT || env.MAX_AGENTS_PER_PROJECT)),
    };
  }

  static async getAgentSettings(input: {
    userId: string;
    projectId: string;
    environmentId: string;
    agentId: string;
  }): Promise<AgentSettingsRecord | null> {
    const agent = await Agent.findOne({
      where: {
        id: input.agentId,
        userId: input.userId,
        projectId: input.projectId,
        environmentId: input.environmentId,
      },
      attributes: ['id', 'maxTraces', 'maxSpans', 'updatedAt'],
    });

    if (!agent) {
      return null;
    }

    const latestVersion = await Entity.findOne({
      where: { agentId: agent.id },
      order: [['createdAt', 'DESC']],
      attributes: ['samplingRate'],
    });

    return {
      agentId: agent.id,
      maxTraces: normalizePositiveInteger(Number(agent.maxTraces || env.MAX_TRACES_PER_AGENT)),
      maxSpans: normalizePositiveInteger(Number(agent.maxSpans || env.MAX_SPANS_PER_AGENT)),
      samplingRate: normalizeSamplingRate(
        Number(latestVersion?.samplingRate ?? env.DEFAULT_TRACE_SAMPLING_RATE)
      ),
      updatedAt: agent.updatedAt.toISOString(),
    };
  }

  static async updateAgentSettings(input: {
    userId: string;
    projectId: string;
    environmentId: string;
    agentId: string;
    maxTraces?: number;
    maxSpans?: number;
    samplingRate?: number;
  }): Promise<AgentSettingsRecord | null> {
    return Agent.sequelize!.transaction(async (transaction) => {
      const agent = await Agent.findOne({
        where: {
          id: input.agentId,
          userId: input.userId,
          projectId: input.projectId,
          environmentId: input.environmentId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!agent) {
        return null;
      }

      const nextMaxTraces =
        typeof input.maxTraces === 'number'
          ? normalizePositiveInteger(input.maxTraces)
          : normalizePositiveInteger(Number(agent.maxTraces || env.MAX_TRACES_PER_AGENT));

      const nextMaxSpans =
        typeof input.maxSpans === 'number'
          ? normalizePositiveInteger(input.maxSpans)
          : normalizePositiveInteger(Number(agent.maxSpans || env.MAX_SPANS_PER_AGENT));

      await agent.update(
        {
          maxTraces: nextMaxTraces,
          maxSpans: nextMaxSpans,
        },
        { transaction }
      );

      let nextSamplingRate: number;
      if (typeof input.samplingRate === 'number') {
        nextSamplingRate = normalizeSamplingRate(input.samplingRate);
        await Entity.update(
          { samplingRate: nextSamplingRate },
          {
            where: { agentId: agent.id },
            transaction,
          }
        );
      } else {
        const latestVersion = await Entity.findOne({
          where: { agentId: agent.id },
          order: [['createdAt', 'DESC']],
          attributes: ['samplingRate'],
          transaction,
        });
        nextSamplingRate = normalizeSamplingRate(
          Number(latestVersion?.samplingRate ?? env.DEFAULT_TRACE_SAMPLING_RATE)
        );
      }

      return {
        agentId: agent.id,
        maxTraces: nextMaxTraces,
        maxSpans: nextMaxSpans,
        samplingRate: nextSamplingRate,
        updatedAt: agent.updatedAt.toISOString(),
      };
    });
  }

  static async resetAgentSettings(input: {
    userId: string;
    projectId: string;
    environmentId: string;
    agentId: string;
  }): Promise<AgentSettingsRecord | null> {
    return this.updateAgentSettings({
      ...input,
      samplingRate: Number(env.DEFAULT_TRACE_SAMPLING_RATE),
      maxTraces: Number(env.MAX_TRACES_PER_AGENT),
      maxSpans: Number(env.MAX_SPANS_PER_AGENT),
    });
  }
}
