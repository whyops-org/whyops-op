import { createServiceLogger } from '@whyops/shared/logger';
import { getJudgeModel, invokeWithInvalidModelRetry } from '../config';
import { evalGenerationPrompt } from '../prompts';
import {
  EvalGenerationBatchSchema,
  type EvalGenerationBatch,
  type GeneratedEvalCase,
} from '../schemas/eval-generation.schema';

const logger = createServiceLogger('analyse:langchain:chain:eval-generation');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface EvalGenerationInput {
  agentName: string;
  persona: string;
  systemPrompt: string;
  toolsSummary: string;
  toolCount: number;
  constraints: string;
  category: string;
  evalCount: number;
  domain: string;
  failureModes: string;
  edgeCasePatterns: string;
  userExpectations: string;
  safetyConsiderations: string;
  customPrompt?: string;
}

// ---------------------------------------------------------------------------
// Chain execution
// ---------------------------------------------------------------------------
export async function runEvalGenerationChain(
  input: EvalGenerationInput,
  overrideModel?: string
): Promise<GeneratedEvalCase[]> {
  const model = getJudgeModel(overrideModel);
  const structured = model.withStructuredOutput(EvalGenerationBatchSchema);
  const chain = evalGenerationPrompt.pipe(structured);

  logger.info(
    { agentName: input.agentName, category: input.category, count: input.evalCount },
    'Running eval generation chain'
  );

  const raw = await invokeWithInvalidModelRetry({
    chainName: 'eval_generation',
    overrideModel,
    logger,
    invoke: () =>
      chain.invoke({
        agentName: input.agentName,
        persona: input.persona,
        systemPrompt: input.systemPrompt || '(No system prompt available)',
        toolsSummary: input.toolsSummary || '(No tools defined)',
        toolCount: String(input.toolCount),
        constraints: input.constraints || '(No constraints)',
        category: input.category,
        evalCount: String(input.evalCount),
        domain: input.domain || 'general',
        failureModes: input.failureModes || '(None identified)',
        edgeCasePatterns: input.edgeCasePatterns || '(None identified)',
        userExpectations: input.userExpectations || '(None identified)',
        safetyConsiderations: input.safetyConsiderations || '(None identified)',
        customPrompt: input.customPrompt
          ? `ADDITIONAL CONTEXT / FEATURE REQUIREMENT:\n${input.customPrompt}`
          : '',
      }),
  });

  const result = raw as unknown as EvalGenerationBatch;

  logger.info(
    { category: input.category, generatedCount: result.evals.length },
    'Eval generation chain completed'
  );

  return result.evals;
}
