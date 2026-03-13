import { z } from 'zod';

// ---------------------------------------------------------------------------
// Eval Generation — structured output schema
// ---------------------------------------------------------------------------

export const EvalConversationTurnSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']).describe('Role of the speaker in this turn'),
  content: z.string().describe('The message content'),
  expected_tool_calls: z
    .array(
      z.object({
        name: z.string().describe('Tool name to be called'),
        arguments: z.record(z.any()).optional().describe('Expected key arguments'),
      })
    )
    .optional()
    .describe('Tools the agent should call in this turn (only for assistant turns)'),
  expected_behavior: z.string().optional().describe('Description of expected agent behavior'),
});
export type EvalConversationTurn = z.infer<typeof EvalConversationTurnSchema>;

export const EvalExpectedOutcomeSchema = z.object({
  tools_called: z.array(z.string()).optional().describe('Tool names that should be called across the conversation'),
  key_assertions: z.array(z.string()).optional().describe('Key assertions about the response (natural language)'),
  refusal_expected: z.boolean().optional().describe('Whether the agent should refuse this request'),
  quality_criteria: z.array(z.string()).optional().describe('Quality criteria for evaluating the response'),
});
export type EvalExpectedOutcome = z.infer<typeof EvalExpectedOutcomeSchema>;

export const EvalScoringDimensionSchema = z.object({
  name: z.string().describe('Dimension name (e.g. correctness, tool_accuracy, safety)'),
  weight: z.number().min(0).max(1).describe('Weight of this dimension in overall score'),
  criteria: z.string().describe('Detailed criteria for scoring this dimension'),
});

export const EvalScoringRubricSchema = z.object({
  dimensions: z.array(EvalScoringDimensionSchema).describe('Scoring dimensions with weights and criteria'),
});
export type EvalScoringRubric = z.infer<typeof EvalScoringRubricSchema>;

export const GeneratedEvalCaseSchema = z.object({
  category: z
    .enum(['happy_path', 'edge_case', 'multi_step', 'safety', 'error_handling', 'adversarial', 'feature_specific'])
    .describe('Eval category'),
  subcategory: z.string().nullable().describe('Sub-category (e.g. missing_params, prompt_injection)'),
  title: z.string().describe('Short human-readable title for this eval case'),
  description: z.string().describe('What this eval tests and why it matters'),
  conversation: z.array(EvalConversationTurnSchema).describe('The eval conversation (single or multi-turn)'),
  expected_outcome: EvalExpectedOutcomeSchema.describe('Expected outcome of this eval'),
  scoring_rubric: EvalScoringRubricSchema.describe('Scoring rubric for this eval'),
  difficulty: z.enum(['basic', 'intermediate', 'advanced']).describe('Difficulty level'),
  tools_tested: z.array(z.string()).describe('Tool names this eval exercises'),
});
export type GeneratedEvalCase = z.infer<typeof GeneratedEvalCaseSchema>;

export const EvalGenerationBatchSchema = z.object({
  evals: z.array(GeneratedEvalCaseSchema).describe('Array of generated eval cases'),
});
export type EvalGenerationBatch = z.infer<typeof EvalGenerationBatchSchema>;
