import { z } from 'zod';

// ---------------------------------------------------------------------------
// Eval Validation — scores individual eval quality
// ---------------------------------------------------------------------------

export const EvalValidationScoreSchema = z.object({
  evalIndex: z.number().describe('0-based index of the eval being scored'),
  specificity: z.number().min(0).max(1).describe('How precisely the expected outcome is defined (1 = completely unambiguous)'),
  nonTriviality: z.number().min(0).max(1).describe('Would a basic/naive agent fail this? (1 = very challenging, 0 = trivially easy)'),
  realism: z.number().min(0).max(1).describe('Does this represent a real user scenario? (1 = highly realistic)'),
  coherence: z.number().min(0).max(1).describe('Is the conversation flow natural and logical? (1 = perfectly coherent)'),
  overallScore: z.number().min(0).max(1).describe('Weighted overall quality score'),
  issues: z.array(z.string()).describe('Specific quality issues found (empty if none)'),
  verdict: z.enum(['keep', 'improve', 'discard']).describe('Whether to keep, try improving, or discard this eval'),
});
export type EvalValidationScore = z.infer<typeof EvalValidationScoreSchema>;

export const EvalValidationBatchSchema = z.object({
  scores: z.array(EvalValidationScoreSchema).describe('Quality scores for each eval candidate'),
});
export type EvalValidationBatch = z.infer<typeof EvalValidationBatchSchema>;
