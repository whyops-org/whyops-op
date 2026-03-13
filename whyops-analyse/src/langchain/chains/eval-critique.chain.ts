import { createServiceLogger } from '@whyops/shared/logger';
import { getJudgeModel, invokeWithInvalidModelRetry } from '../config';
import { evalCritiquePrompt } from '../prompts';
import { EvalCritiqueResultSchema, type EvalCritiqueResult } from '../schemas/eval-critique.schema';

const logger = createServiceLogger('analyse:langchain:chain:eval-critique');

export interface EvalCritiqueInput {
  agentName: string;
  toolNames: string;
  toolCount: number;
  constraints: string;
  categories: string;
  evalCount: number;
  evalSummaries: string;
  toolCoverage: string;
}

export async function runEvalCritiqueChain(
  input: EvalCritiqueInput,
  overrideModel?: string
): Promise<EvalCritiqueResult> {
  const model = getJudgeModel(overrideModel);
  const structured = model.withStructuredOutput(EvalCritiqueResultSchema);
  const chain = evalCritiquePrompt.pipe(structured);

  logger.info({ agentName: input.agentName, evalCount: input.evalCount }, 'Running eval critique chain');

  const raw = await invokeWithInvalidModelRetry({
    chainName: 'eval_critique',
    overrideModel,
    logger,
    invoke: () =>
      chain.invoke({
        ...input,
        toolCount: String(input.toolCount),
        evalCount: String(input.evalCount),
      }),
  });

  const result = raw as unknown as EvalCritiqueResult;

  logger.info(
    {
      gaps: result.coverageGaps.length,
      tooEasy: result.tooEasyEvals.length,
      duplicateGroups: result.duplicateGroups.length,
      regenerationPrompts: result.regenerationPrompts.length,
    },
    'Eval critique chain completed'
  );

  return result;
}
