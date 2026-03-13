import { z } from 'zod';

// ---------------------------------------------------------------------------
// Eval Suite Critique — reviews entire suite for gaps and weaknesses
// ---------------------------------------------------------------------------

export const EvalCritiqueResultSchema = z.object({
  overallAssessment: z.string().describe('Brief assessment of the eval suite quality (1-2 sentences)'),
  coverageGaps: z.array(
    z.object({
      area: z.string().describe('What is not covered (e.g., a tool name, a constraint, a scenario type)'),
      severity: z.enum(['low', 'medium', 'high', 'critical']).describe('How important this gap is'),
      suggestedScenario: z.string().describe('A specific scenario that should be added to fill this gap'),
    })
  ).describe('Areas with insufficient eval coverage'),
  tooEasyEvals: z.array(z.number()).describe('Indices of evals that are too trivial and should be replaced'),
  duplicateGroups: z.array(
    z.array(z.number()).describe('Indices of evals that are near-duplicates of each other')
  ).describe('Groups of duplicate/near-duplicate evals (keep best from each group)'),
  improvementSuggestions: z.array(
    z.object({
      evalIndex: z.number().describe('Index of the eval to improve'),
      suggestion: z.string().describe('How to make this eval better'),
    })
  ).describe('Specific improvements for existing evals'),
  missingCategories: z.array(z.string()).describe('Eval categories that have zero or insufficient coverage'),
  regenerationPrompts: z.array(z.string()).describe('Specific prompts to use for generating replacement evals that fill gaps'),
});
export type EvalCritiqueResult = z.infer<typeof EvalCritiqueResultSchema>;
