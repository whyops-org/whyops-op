import Agent from './Agent';
import AgentAnalysisConfig from './AgentAnalysisConfig';
import AgentAnalysisFinding from './AgentAnalysisFinding';
import AgentAnalysisRun from './AgentAnalysisRun';
import AgentAnalysisSection from './AgentAnalysisSection';
import AgentKnowledgeProfile from './AgentKnowledgeProfile';
import AnalysisExperiment from './AnalysisExperiment';
import ApiKey from './ApiKey';
import Entity from './Entity';
import { Environment } from './Environment';
import EvalCase from './EvalCase';
import EvalConfig from './EvalConfig';
import EvalRun from './EvalRun';
import LlmCost from './LlmCost';
import LLMEvent from './LLMEvent';
import { Project } from './Project';
import Provider from './Provider';
import RequestLog from './RequestLog';
import Trace from './Trace';
import TraceAnalysis from './TraceAnalysis';
import TraceAnalysisFinding from './TraceAnalysisFinding';
import TraceReplayRun from './TraceReplayRun';
export type { ReplayEvent, ReplayComparison, ReplayVariantConfig, TraceReplayRunStatus } from './TraceReplayRun';
import User from './User';

// Define associations

// User -> Project
User.hasMany(Project, { foreignKey: 'userId', as: 'projects' });
Project.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Project -> Environment
Project.hasMany(Environment, { foreignKey: 'projectId', as: 'environments' });
Environment.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

// User -> Provider
User.hasMany(Provider, { foreignKey: 'userId', as: 'providers' });
Provider.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// User -> ApiKey
User.hasMany(ApiKey, { foreignKey: 'userId', as: 'apiKeys' });
ApiKey.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Project -> ApiKey
Project.hasMany(ApiKey, { foreignKey: 'projectId', as: 'apiKeys' });
ApiKey.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

// Environment -> ApiKey
Environment.hasMany(ApiKey, { foreignKey: 'environmentId', as: 'apiKeys' });
ApiKey.belongsTo(Environment, { foreignKey: 'environmentId', as: 'environment' });

// Provider -> ApiKey (optional)
Provider.hasMany(ApiKey, { foreignKey: 'providerId', as: 'apiKeys' });
ApiKey.belongsTo(Provider, { foreignKey: 'providerId', as: 'provider' });

// Entity -> ApiKey (optional)
Entity.hasMany(ApiKey, { foreignKey: 'entityId', as: 'apiKeys' });
ApiKey.belongsTo(Entity, { foreignKey: 'entityId', as: 'entity' });

// User -> LLMEvent
User.hasMany(LLMEvent, { foreignKey: 'userId', as: 'events' });
LLMEvent.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Provider -> LLMEvent
Provider.hasMany(LLMEvent, { foreignKey: 'providerId', as: 'events' });
LLMEvent.belongsTo(Provider, { foreignKey: 'providerId', as: 'providerDetails' });

// Trace associations
Trace.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Trace, { foreignKey: 'userId', as: 'traces' });

Trace.hasMany(LLMEvent, { foreignKey: 'traceId', sourceKey: 'id', as: 'events' });
LLMEvent.belongsTo(Trace, { foreignKey: 'traceId', targetKey: 'id', as: 'trace' });

Trace.hasMany(TraceAnalysis, { foreignKey: 'traceId', sourceKey: 'id', as: 'analyses' });
TraceAnalysis.belongsTo(Trace, { foreignKey: 'traceId', targetKey: 'id', as: 'trace' });

Trace.hasMany(TraceReplayRun, { foreignKey: 'traceId', sourceKey: 'id', as: 'replayRuns' });
TraceReplayRun.belongsTo(Trace, { foreignKey: 'traceId', targetKey: 'id', as: 'trace' });

TraceAnalysis.hasMany(TraceReplayRun, { foreignKey: 'analysisId', as: 'replayRuns' });
TraceReplayRun.belongsTo(TraceAnalysis, { foreignKey: 'analysisId', as: 'analysis' });

TraceAnalysis.hasMany(TraceAnalysisFinding, { foreignKey: 'analysisId', as: 'findings' });
TraceAnalysisFinding.belongsTo(TraceAnalysis, { foreignKey: 'analysisId', as: 'analysis' });

TraceAnalysis.hasMany(AnalysisExperiment, { foreignKey: 'analysisId', as: 'experiments' });
AnalysisExperiment.belongsTo(TraceAnalysis, { foreignKey: 'analysisId', as: 'analysis' });

// Entity associations
User.hasMany(Entity, { foreignKey: 'userId', as: 'entities' });
Entity.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Agent, { foreignKey: 'userId', as: 'agents' });
Agent.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Project -> Entity
Project.hasMany(Entity, { foreignKey: 'projectId', as: 'entities' });
Entity.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

Project.hasMany(Agent, { foreignKey: 'projectId', as: 'agents' });
Agent.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

// Environment -> Entity
Environment.hasMany(Entity, { foreignKey: 'environmentId', as: 'entities' });
Entity.belongsTo(Environment, { foreignKey: 'environmentId', as: 'environment' });

Environment.hasMany(Agent, { foreignKey: 'environmentId', as: 'agents' });
Agent.belongsTo(Environment, { foreignKey: 'environmentId', as: 'environment' });

Agent.hasMany(Entity, { foreignKey: 'agentId', as: 'versions' });
Entity.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });

LLMEvent.belongsTo(Entity, { foreignKey: 'entityId', as: 'entity' });

Trace.belongsTo(Entity, { foreignKey: 'entityId', as: 'entity' });
Entity.hasMany(Trace, { foreignKey: 'entityId', as: 'traces' });

Agent.hasMany(AgentAnalysisConfig, { foreignKey: 'agentId', as: 'analysisConfigs' });
AgentAnalysisConfig.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });

AgentAnalysisConfig.hasMany(AgentAnalysisRun, { foreignKey: 'configId', as: 'runs' });
AgentAnalysisRun.belongsTo(AgentAnalysisConfig, { foreignKey: 'configId', as: 'config' });

Agent.hasMany(AgentAnalysisRun, { foreignKey: 'agentId', as: 'analysisRuns' });
AgentAnalysisRun.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });

AgentAnalysisRun.hasMany(AgentAnalysisSection, { foreignKey: 'runId', as: 'sections' });
AgentAnalysisSection.belongsTo(AgentAnalysisRun, { foreignKey: 'runId', as: 'run' });

AgentAnalysisRun.hasMany(AgentAnalysisFinding, { foreignKey: 'runId', as: 'findings' });
AgentAnalysisFinding.belongsTo(AgentAnalysisRun, { foreignKey: 'runId', as: 'run' });

Agent.hasOne(AgentKnowledgeProfile, { foreignKey: 'agentId', as: 'knowledgeProfile' });
AgentKnowledgeProfile.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });

Agent.hasOne(EvalConfig, { foreignKey: 'agentId', as: 'evalConfig' });
EvalConfig.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });

EvalConfig.hasMany(EvalRun, { foreignKey: 'configId', as: 'runs' });
EvalRun.belongsTo(EvalConfig, { foreignKey: 'configId', as: 'config' });

Agent.hasMany(EvalRun, { foreignKey: 'agentId', as: 'evalRuns' });
EvalRun.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });

EvalRun.hasMany(EvalCase, { foreignKey: 'runId', as: 'cases' });
EvalCase.belongsTo(EvalRun, { foreignKey: 'runId', as: 'run' });

Agent.hasMany(EvalCase, { foreignKey: 'agentId', as: 'evalCases' });
EvalCase.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });

export {
  Agent,
  AgentAnalysisConfig,
  AgentAnalysisFinding,
  AgentAnalysisRun,
  AgentAnalysisSection,
  AgentKnowledgeProfile,
  AnalysisExperiment,
  ApiKey,
  Entity,
  Environment,
  EvalCase,
  EvalConfig,
  EvalRun,
  LlmCost,
  LLMEvent,
  Project,
  Provider,
  RequestLog,
  Trace,
  TraceAnalysis,
  TraceAnalysisFinding,
  TraceReplayRun,
  User,
};

export const models = {
  User,
  Agent,
  AgentAnalysisConfig,
  AgentAnalysisFinding,
  AgentAnalysisRun,
  AgentAnalysisSection,
  AgentKnowledgeProfile,
  AnalysisExperiment,
  Provider,
  ApiKey,
  LLMEvent,
  RequestLog,
  Trace,
  TraceAnalysis,
  TraceAnalysisFinding,
  TraceReplayRun,
  Entity,
  EvalCase,
  EvalConfig,
  EvalRun,
  LlmCost,
  Project,
  Environment,
};

export default models;
