import { createServiceLogger } from '@whyops/shared/logger';
import { AgentKnowledgeProfile, User } from '@whyops/shared/models';
import { sendPlainEmail, isMailerooConfigured } from '@whyops/shared/services';
import { runAgentKnowledgeResearchChain } from '../../langchain/chains/agent-knowledge-research.chain';
import type { AgentKnowledgeResearchResult } from '../../langchain/schemas/agent-knowledge-research.schema';
import type { AgentProfile } from './agent-profile-extractor';
import { gatherIntelligence, type IntelligenceFragment } from './intelligence-providers';

const logger = createServiceLogger('analyse:eval:knowledge-builder');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface KnowledgeProfile {
  domain: string;
  domainDescription: string;
  subDomains: string[];
  competitors: Array<{
    name: string;
    description: string;
    strengths: string[];
    weaknesses: string[];
  }>;
  failureModes: Array<{
    code: string;
    description: string;
    severity: string;
    examples: string[];
    mitigations: string[];
  }>;
  bestPractices: Array<{
    area: string;
    practice: string;
    rationale: string;
  }>;
  userExpectations: Array<{
    expectation: string;
    priority: string;
  }>;
  edgeCasePatterns: string[];
  safetyConsiderations: string[];
}

interface BuildKnowledgeInput {
  agentProfile: AgentProfile;
  userId: string;
  projectId: string;
  environmentId: string;
  forceRebuild?: boolean;
  judgeModel?: string;
  sendEmailOnComplete?: boolean;
}

export type KnowledgeBuildStatus = 'ready' | 'building' | 'stale' | 'missing';

// ---------------------------------------------------------------------------
// Staleness — profiles older than 24h are considered stale
// ---------------------------------------------------------------------------
const STALENESS_MS = 24 * 60 * 60 * 1000;

function isStale(lastBuiltAt: Date | null | undefined): boolean {
  if (!lastBuiltAt) return true;
  return Date.now() - new Date(lastBuiltAt).getTime() > STALENESS_MS;
}

// In-memory set of agent IDs currently being built (prevents duplicate jobs)
const buildingAgents = new Set<string>();

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------
function formatToolsSummary(tools: AgentProfile['tools']): string {
  if (tools.length === 0) return '(No tools defined)';
  return tools
    .map((t) => {
      const params = t.parameters?.properties
        ? Object.keys(t.parameters.properties).join(', ')
        : 'none';
      return `- ${t.name}: ${t.description || '(no description)'} [params: ${params}]`;
    })
    .join('\n');
}

function formatIntelligenceForLLM(fragments: IntelligenceFragment[]): string {
  if (fragments.length === 0) return '';

  const grouped: Record<string, IntelligenceFragment[]> = {};
  for (const f of fragments) {
    if (!grouped[f.source]) grouped[f.source] = [];
    grouped[f.source].push(f);
  }

  const sections: string[] = [];
  for (const [source, frags] of Object.entries(grouped)) {
    const items = frags
      .slice(0, 10)
      .map((f) => `  - [${f.type}] ${f.title}: ${f.content.slice(0, 300)}`)
      .join('\n');
    sections.push(`\n### Intelligence from ${source.toUpperCase()}:\n${items}`);
  }

  return `\nREAL-WORLD INTELLIGENCE (gathered from web, social, and code sources):\n${sections.join('\n')}`;
}

function generateSearchQueries(agentProfile: AgentProfile): string[] {
  const queries: string[] = [];
  const name = agentProfile.name;
  const domains = agentProfile.domains;
  const toolNames = agentProfile.tools.slice(0, 5).map((t) => t.name);

  queries.push(`${name} AI agent`);
  queries.push(`${domains[0] || 'AI'} agent problems failures edge cases`);
  queries.push(`${domains[0] || 'AI'} agent best practices evaluation`);
  queries.push(`${domains[0] || 'AI'} chatbot vs alternatives comparison`);

  if (toolNames.length > 0) {
    queries.push(`AI agent ${toolNames.slice(0, 3).join(' ')} tool use issues`);
  }

  queries.push(`LLM agent ${domains[0] || ''} failure modes common bugs`);
  queries.push(`${domains[0] || 'AI'} agent security prompt injection`);

  return queries;
}

// ---------------------------------------------------------------------------
// Core build logic
// ---------------------------------------------------------------------------
async function executeBuild(input: BuildKnowledgeInput): Promise<KnowledgeProfile> {
  const { agentProfile, userId, projectId, environmentId, judgeModel } = input;

  // Step 1: Generate search queries from agent profile
  const searchQueries = generateSearchQueries(agentProfile);

  logger.info(
    { agentId: agentProfile.agentId, queryCount: searchQueries.length },
    'Gathering real-world intelligence'
  );

  // Step 2: Gather intelligence from all configured sources
  const intelligence = await gatherIntelligence(searchQueries);

  // Step 3: Format intelligence as additional context for the LLM chain
  const additionalContext = formatIntelligenceForLLM(intelligence.fragments);

  // Step 4: Run the knowledge research chain with real intelligence
  const result: AgentKnowledgeResearchResult = await runAgentKnowledgeResearchChain(
    {
      agentName: agentProfile.name,
      persona: agentProfile.persona,
      domains: agentProfile.domains.join(', '),
      systemPrompt: agentProfile.systemPrompt.fullText,
      toolsSummary: formatToolsSummary(agentProfile.tools),
      toolCount: agentProfile.tools.length,
      constraints: agentProfile.constraints.length > 0
        ? agentProfile.constraints.map((c) => `- ${c}`).join('\n')
        : '(No constraints extracted)',
      capabilities: agentProfile.capabilities.length > 0
        ? agentProfile.capabilities.map((c) => `- ${c}`).join('\n')
        : '(No capabilities extracted)',
      additionalContext,
    },
    judgeModel
  );

  // Step 5: Build the structured profile
  const profile: KnowledgeProfile = {
    domain: result.domain,
    domainDescription: result.domainDescription,
    subDomains: result.subDomains,
    competitors: result.competitors,
    failureModes: result.failureModes,
    bestPractices: result.bestPractices,
    userExpectations: result.userExpectations,
    edgeCasePatterns: result.edgeCasePatterns,
    safetyConsiderations: result.safetyConsiderations,
  };

  const sources = intelligence.sourcesUsed.map((s) => ({
    type: s,
    fragmentCount: intelligence.fragments.filter((f) => f.source === s).length,
  }));

  // Step 6: Persist
  const existing = await AgentKnowledgeProfile.findOne({
    where: { agentId: agentProfile.agentId },
  });

  if (existing) {
    await existing.update({
      domain: result.domain,
      profile,
      sources,
      version: existing.version + 1,
      lastBuiltAt: new Date(),
    });
    logger.info({ agentId: agentProfile.agentId, version: existing.version + 1 }, 'Knowledge profile updated');
  } else {
    await AgentKnowledgeProfile.create({
      agentId: agentProfile.agentId,
      userId,
      projectId,
      environmentId,
      domain: result.domain,
      profile,
      sources,
      version: 1,
      lastBuiltAt: new Date(),
    });
    logger.info({ agentId: agentProfile.agentId }, 'Knowledge profile created');
  }

  return profile;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the status of intelligence for an agent.
 */
export function getKnowledgeBuildStatus(agentId: string): KnowledgeBuildStatus {
  if (buildingAgents.has(agentId)) return 'building';
  return 'ready'; // actual staleness checked in getCachedOrNull
}

/**
 * Returns cached profile if fresh, null if missing/stale.
 */
export async function getCachedKnowledgeProfile(agentId: string): Promise<KnowledgeProfile | null> {
  const record = await AgentKnowledgeProfile.findOne({ where: { agentId } });
  if (!record) return null;
  if (isStale(record.lastBuiltAt)) return null;
  return record.profile as KnowledgeProfile;
}

export async function getKnowledgeProfile(agentId: string): Promise<KnowledgeProfile | null> {
  const record = await AgentKnowledgeProfile.findOne({ where: { agentId } });
  return record ? (record.profile as KnowledgeProfile) : null;
}

/**
 * Build knowledge profile synchronously (used within background job).
 */
export async function buildKnowledgeProfile(input: BuildKnowledgeInput): Promise<KnowledgeProfile> {
  const { agentProfile, forceRebuild } = input;

  // Check cache
  if (!forceRebuild) {
    const cached = await getCachedKnowledgeProfile(agentProfile.agentId);
    if (cached) {
      logger.info({ agentId: agentProfile.agentId }, 'Using cached knowledge profile');
      return cached;
    }
  }

  return executeBuild(input);
}

/**
 * Start knowledge building in background. Returns immediately.
 * Sends email notification on completion if configured.
 */
export function startBackgroundKnowledgeBuild(input: BuildKnowledgeInput): void {
  const agentId = input.agentProfile.agentId;

  if (buildingAgents.has(agentId)) {
    logger.info({ agentId }, 'Knowledge build already in progress');
    return;
  }

  buildingAgents.add(agentId);

  void (async () => {
    try {
      logger.info({ agentId }, 'Starting background knowledge build');
      await executeBuild(input);

      // Send email notification
      if (input.sendEmailOnComplete && isMailerooConfigured()) {
        try {
          const user = await User.findByPk(input.userId);
          if (user?.email) {
            await sendPlainEmail({
              to: user.email,
              subject: `WhyOps: Intelligence ready for ${input.agentProfile.name}`,
              plain: [
                `Hi${user.name ? ' ' + user.name : ''},`,
                '',
                `Intelligence gathering for your agent "${input.agentProfile.name}" is complete.`,
                `You can now generate evaluation test cases from the WhyOps dashboard.`,
                '',
                '— WhyOps',
              ].join('\n'),
              tags: { type: 'intelligence_ready', agent: agentId },
            });
          }
        } catch (emailError) {
          logger.warn({ emailError, agentId }, 'Failed to send intelligence ready email');
        }
      }
    } catch (error) {
      logger.error({ error, agentId }, 'Background knowledge build failed');
    } finally {
      buildingAgents.delete(agentId);
    }
  })();
}

/**
 * Check if a background build is in progress.
 */
export function isKnowledgeBuildInProgress(agentId: string): boolean {
  return buildingAgents.has(agentId);
}
