import { z } from 'zod';

// ---------------------------------------------------------------------------
// Agent Knowledge Research — structured output schema
// ---------------------------------------------------------------------------

export const CompetitorSchema = z.object({
  name: z.string().describe('Name of the competing product or agent'),
  description: z.string().describe('Brief description of what it does'),
  strengths: z.array(z.string()).describe('Key strengths of this competitor'),
  weaknesses: z.array(z.string()).describe('Known weaknesses or gaps'),
});
export type Competitor = z.infer<typeof CompetitorSchema>;

export const FailureModeSchema = z.object({
  code: z.string().describe('Machine-readable failure mode code, e.g. HALLUCINATION_DOMAIN_FACTS'),
  description: z.string().describe('Human-readable description of the failure mode'),
  severity: z.enum(['low', 'medium', 'high', 'critical']).describe('How impactful this failure mode is'),
  examples: z.array(z.string()).describe('Example scenarios where this failure occurs'),
  mitigations: z.array(z.string()).describe('How to test for or prevent this failure'),
});
export type FailureMode = z.infer<typeof FailureModeSchema>;

export const BestPracticeSchema = z.object({
  area: z.string().describe('Area this practice applies to (e.g. "tool usage", "error handling")'),
  practice: z.string().describe('The best practice description'),
  rationale: z.string().describe('Why this is important'),
});
export type BestPractice = z.infer<typeof BestPracticeSchema>;

export const UserExpectationSchema = z.object({
  expectation: z.string().describe('What users expect from this type of agent'),
  priority: z.enum(['must_have', 'should_have', 'nice_to_have']).describe('Priority level'),
});
export type UserExpectation = z.infer<typeof UserExpectationSchema>;

export const AgentKnowledgeResearchResultSchema = z.object({
  domain: z.string().describe('Primary domain classification (e.g. customer_support, coding_assistant)'),
  domainDescription: z.string().describe('Detailed description of what this domain entails'),
  subDomains: z.array(z.string()).describe('Sub-domains or specializations detected'),
  competitors: z.array(CompetitorSchema).describe('Known competitors or similar products'),
  failureModes: z.array(FailureModeSchema).describe('Common failure modes for this type of agent'),
  bestPractices: z.array(BestPracticeSchema).describe('Industry best practices for this agent type'),
  userExpectations: z.array(UserExpectationSchema).describe('What end-users typically expect'),
  edgeCasePatterns: z.array(z.string()).describe('Common edge case patterns to test'),
  safetyConsiderations: z.array(z.string()).describe('Safety and compliance considerations for this domain'),
  searchQueries: z.array(z.string()).describe('Suggested web search queries to deepen knowledge'),
});
export type AgentKnowledgeResearchResult = z.infer<typeof AgentKnowledgeResearchResultSchema>;
