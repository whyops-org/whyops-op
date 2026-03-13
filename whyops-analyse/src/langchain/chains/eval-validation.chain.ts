import { createServiceLogger } from '@whyops/shared/logger';
import { getJudgeModel, invokeWithInvalidModelRetry } from '../config';
import { evalValidationPrompt } from '../prompts';
import { EvalValidationBatchSchema, type EvalValidationBatch, type EvalValidationScore } from '../schemas/eval-validation.schema';

const logger = createServiceLogger('analyse:langchain:chain:eval-validation');

export interface EvalValidationInput {
  agentName: string;
  toolNames: string;
  evalCandidates: string;
}

export async function runEvalValidationChain(
  input: EvalValidationInput,
  overrideModel?: string
): Promise<EvalValidationScore[]> {
  const model = getJudgeModel(overrideModel);
  const structured = model.withStructuredOutput(EvalValidationBatchSchema);
  const chain = evalValidationPrompt.pipe(structured);

  logger.info({ agentName: input.agentName }, 'Running eval validation chain');

  const raw = await invokeWithInvalidModelRetry({
    chainName: 'eval_validation',
    overrideModel,
    logger,
    invoke: () => chain.invoke(input),
  });

  const result = raw as unknown as EvalValidationBatch;
  logger.info({ scoreCount: result.scores.length }, 'Eval validation chain completed');
  return result.scores;
}
