import { createServiceLogger } from '@whyops/shared/logger';
import { getJudgeModel, invokeWithInvalidModelRetry } from '../config';
import { agentKnowledgeResearchPrompt } from '../prompts';
import {
  AgentKnowledgeResearchResultSchema,
  type AgentKnowledgeResearchResult,
} from '../schemas/agent-knowledge-research.schema';

const logger = createServiceLogger('analyse:langchain:chain:agent-knowledge-research');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface AgentKnowledgeResearchInput {
  agentName: string;
  persona: string;
  domains: string;
  systemPrompt: string;
  toolsSummary: string;
  toolCount: number;
  constraints: string;
  capabilities: string;
  additionalContext?: string;
}

// ---------------------------------------------------------------------------
// Chain execution
// ---------------------------------------------------------------------------
export async function runAgentKnowledgeResearchChain(
  input: AgentKnowledgeResearchInput,
  overrideModel?: string
): Promise<AgentKnowledgeResearchResult> {
  const model = getJudgeModel(overrideModel);
  const structured = model.withStructuredOutput(AgentKnowledgeResearchResultSchema);
  const chain = agentKnowledgeResearchPrompt.pipe(structured);

  logger.info({ agentName: input.agentName }, 'Running agent knowledge research chain');

  const raw = await invokeWithInvalidModelRetry({
    chainName: 'agent_knowledge_research',
    overrideModel,
    logger,
    invoke: () =>
      chain.invoke({
        agentName: input.agentName,
        persona: input.persona,
        domains: input.domains,
        systemPrompt: input.systemPrompt || '(No system prompt available)',
        toolsSummary: input.toolsSummary || '(No tools defined)',
        toolCount: String(input.toolCount),
        constraints: input.constraints || '(No constraints extracted)',
        capabilities: input.capabilities || '(No capabilities extracted)',
        additionalContext: input.additionalContext || '',
      }),
  });

  const result = raw as unknown as AgentKnowledgeResearchResult;

  logger.info(
    {
      domain: result.domain,
      competitorCount: result.competitors.length,
      failureModeCount: result.failureModes.length,
      bestPracticeCount: result.bestPractices.length,
    },
    'Agent knowledge research chain completed'
  );

  return result;
}
